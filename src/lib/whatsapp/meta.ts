import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(body: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

export async function sendMetaTemplate(
  config: MetaConfig,
  to: string,
  template: string,
  parameters: string[],
  language = "pt_BR"
): Promise<string> {
  if (!config.accessToken || !/^\d+$/.test(config.phoneNumberId) || !/^v\d+\.0$/.test(config.apiVersion)) {
    throw new Error("Configuração da Meta Cloud API incompleta");
  }
  if (!/^\d{8,15}$/.test(to)) throw new Error("Telefone deve conter código do país e somente dígitos");
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: parameters.length
          ? [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }]
          : [],
      },
    }),
  });
  if (!response.ok) throw new Error(`Meta rejeitou o envio (HTTP ${response.status})`);
  const result = await response.json();
  const id = result.messages?.[0]?.id;
  if (typeof id !== "string" || !id) throw new Error("Meta retornou uma resposta sem identificador");
  return id;
}
