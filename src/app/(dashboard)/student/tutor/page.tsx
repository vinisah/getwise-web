"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/gw/primitives";
import { Bot, Send, Plus } from "lucide-react";
import { TutorMessage } from "@/components/tutor/tutor-message";
import styles from "@/components/tutor/tutor.module.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  animate?: boolean;
}

const SUGGESTIONS = [
  { title: "Conversar sem pressa", description: "Um diálogo leve, no seu nível.", prompt: "Let's have a calm, simple conversation about my daily routine. Ask me one question at a time." },
  { title: "Entender a gramática", description: "Explicações simples, com exemplos.", prompt: "Can you explain the difference between since and for with a simple example?" },
  { title: "Cuidar da minha escrita", description: "Correções gentis para ganhar confiança.", prompt: "Help me practice writing in English. Give me a short prompt and gently correct my answer." },
  { title: "Descobrir novas palavras", description: "Vocabulário para usar na vida real.", prompt: "Teach me three useful English words for traveling, with pronunciation and examples." },
];

function BotAvatar() {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 11, background: "var(--violet-soft)", color: "var(--violet)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Bot size={18} />
    </div>
  );
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessage = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !followMessages.current) return;
    if (messages.length === 0) { container.scrollTop = 0; return; }
    if (lastMessage.current) {
      container.scrollTop += lastMessage.current.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
    } else container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    followMessages.current = true;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(data.error ?? "Não consegui responder agora. Podemos tentar novamente?");
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((p) => [...p, { role: "assistant", content: data.reply ?? "Vamos tentar novamente?", animate: true }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessages((p) => [...p, { role: "assistant", content: error instanceof Error ? error.message : "A conexão oscilou um pouquinho. Vamos tentar novamente?" }]);
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }

  const empty = messages.length === 0;

  return (
    <div className={`gw-card ${styles.shell}`}>
      {/* header */}
      <div className={`gw-chat-head ${styles.header}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "var(--r-sm)", background: "var(--violet-soft)", color: "var(--violet)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={22} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>Wise Tutor</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              No seu ritmo, uma conversa de cada vez
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { request.current?.abort(); request.current = null; setLoading(false); setMessages([]); setInput(""); setSessionId(null); followMessages.current = true; }}>
          <Plus size={15} /> Nova conversa
        </Button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className={`gw-chat-body ${styles.body}`} onScroll={(e) => { const el = e.currentTarget; followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}>
        {empty ? (
          <div className={styles.welcome}>
            <div className={styles.eyebrow}>Um espaço para aprender com calma</div>
            <h1>Olá, eu sou a Wise.<br />Vamos aprender no seu ritmo?</h1>
            <div className={styles.intro}>
              <TutorMessage animate content={"Estou aqui para ajudar você a se sentir **mais confiante no inglês**, um passo de cada vez. Podemos conversar, explorar a gramática, descobrir palavras ou cuidar da sua escrita.\n\nNão precisa acertar tudo. **Vamos praticar juntos, com calma.**"} />
            </div>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s, index) => (
                <button key={s.title} className={styles.suggestion} style={{ animationDelay: `${600 + index * 180}ms` }} onClick={() => send(s.prompt)}><strong>{s.title}</strong><span>{s.description}</span></button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.conversation} aria-live="polite" aria-relevant="additions">
            {messages.map((m, i) => (
              <div key={i} ref={i === messages.length - 1 ? lastMessage : undefined} className={`${styles.row} ${m.role === "user" ? styles.userRow : ""}`}>
                {m.role === "user" ? <Avatar initials="EU" size={34} tone="brand" /> : <BotAvatar />}
                <div className={`gw-bubble ${styles.bubble} ${m.role === "user" ? `user ${styles.userBubble}` : "bot"}`}>{m.role === "assistant" ? <TutorMessage content={m.content} animate={m.animate} /> : m.content}</div>
              </div>
            ))}
            {loading && (
              <div className={styles.row} role="status">
                <BotAvatar />
                <div className={`gw-bubble bot ${styles.thinking}`}>
                  <span className="gw-typing" /><span className="gw-typing" /><span className="gw-typing" />
                  <span className={styles.thinkingText}>Preparando sua resposta com cuidado…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="gw-chat-foot">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className={`gw-composer ${styles.composer}`}>
          <input aria-label="Sua mensagem para a Wise" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva em inglês ou português…" maxLength={2000} />
          <Button aria-label="Enviar mensagem" type="submit" variant="accent" disabled={!input.trim() || loading} style={{ padding: "10px 14px" }}>
            <Send size={18} />
          </Button>
        </form>
        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 9 }}>
          Suas conversas são salvas para acompanhar seu progresso · IA pode cometer erros
        </p>
      </div>
    </div>
  );
}
