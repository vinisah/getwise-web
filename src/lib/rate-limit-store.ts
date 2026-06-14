/**
 * Store plugável para rate-limit e locks de submissão.
 *
 * - Default: in-memory (single-process) — adequado para dev e single-instance.
 * - Distribuído: adapter Upstash REST (via fetch, sem dependência) — ativa quando
 *   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` estão setados (ex.: Vercel).
 *   No serverless cada invocação é isolada; o in-memory NÃO protege entre instâncias,
 *   então em produção use Upstash para que rate-limit/lock sejam efetivos.
 */

export interface RateLimitStore {
  /** Incrementa o contador da janela e devolve a contagem atual + quando reseta (epoch ms). */
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Zera o contador (ex.: após login bem-sucedido). */
  reset(key: string): Promise<void>;
  /** Adquire lock atômico com TTL; true se conseguiu, false se já existe. */
  lock(key: string, ttlMs: number): Promise<boolean>;
  /** Libera o lock. */
  unlock(key: string): Promise<void>;
}

// ─── In-memory ──────────────────────────────────────────────────────────────

class InMemoryStore implements RateLimitStore {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private locks = new Map<string, number>(); // key → expiresAt (epoch ms)

  constructor() {
    // Limpeza periódica de entradas expiradas (evita memory leak). unref: não segura o processo.
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of this.counters) if (now > v.resetAt) this.counters.delete(k);
        for (const [k, exp] of this.locks) if (now > exp) this.locks.delete(k);
      }, 5 * 60 * 1000);
      (timer as { unref?: () => void }).unref?.();
    }
  }

  async incr(key: string, windowMs: number) {
    const now = Date.now();
    const cur = this.counters.get(key);
    if (!cur || now > cur.resetAt) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.counters.set(key, fresh);
      return fresh;
    }
    cur.count += 1;
    return cur;
  }

  async reset(key: string) {
    this.counters.delete(key);
  }

  async lock(key: string, ttlMs: number) {
    const now = Date.now();
    const exp = this.locks.get(key);
    if (exp && now < exp) return false;
    this.locks.set(key, now + ttlMs);
    return true;
  }

  async unlock(key: string) {
    this.locks.delete(key);
  }
}

// ─── Upstash REST ───────────────────────────────────────────────────────────

class UpstashStore implements RateLimitStore {
  constructor(private url: string, private token: string) {}

  private async cmd<T = unknown>(args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      // Falha de rede não deve travar a request por muito tempo.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const json = (await res.json()) as { result: T };
    return json.result;
  }

  private async pipeline<T = unknown>(cmds: (string | number)[][]): Promise<T[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Upstash pipeline ${res.status}`);
    const json = (await res.json()) as { result: T }[];
    return json.map((r) => r.result);
  }

  async incr(key: string, windowMs: number) {
    const [count, pttl] = await this.pipeline<number>([
      ["INCR", key],
      ["PTTL", key],
    ]);
    let ttl = pttl;
    if (ttl < 0) {
      // Sem TTL (chave nova ou sem expiração) → define a janela.
      await this.cmd(["PEXPIRE", key, windowMs]);
      ttl = windowMs;
    }
    return { count, resetAt: Date.now() + ttl };
  }

  async reset(key: string) {
    await this.cmd(["DEL", key]);
  }

  async lock(key: string, ttlMs: number) {
    // SET key 1 NX PX ttl → "OK" se setou (lock adquirido), null se já existia.
    const r = await this.cmd<string | null>(["SET", key, "1", "NX", "PX", ttlMs]);
    return r === "OK";
  }

  async unlock(key: string) {
    await this.cmd(["DEL", key]);
  }
}

// ─── Factory (singleton) ──────────────────────────────────────────────────────

let store: RateLimitStore | null = null;

export function getStore(): RateLimitStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashStore(url, token) : new InMemoryStore();
  return store;
}
