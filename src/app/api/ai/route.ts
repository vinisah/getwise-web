import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { AiMessageSchema } from "@/lib/schemas";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Caminho crítico LLM: roda em Node e tem teto de tempo no serverless.
export const runtime = "nodejs";
export const maxDuration = 30;

// Tutor via Groq (API compatível com OpenAI SDK).
// timeout < maxDuration p/ o client abortar antes de a função ser cortada pela Vercel.
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 20_000,
  maxRetries: 1,
});
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `Você é uma Assistente Profissional de Inglês da escola Get Wise, com experiência equivalente a professores certificados internacionais. Ensine inglês de forma estruturada, prática e eficiente para alunos de qualquer nível (A1 ao C2).

OBJETIVOS:
- Desenvolver Speaking, Listening, Reading e Writing.
- Ensinar gramática aplicada ao uso real da língua.
- Expandir vocabulário de forma contextualizada.
- Melhorar pronúncia e compreensão auditiva.
- Preparar para viagens, trabalho, entrevistas, negócios e certificações internacionais.

COMPORTAMENTO:
- Seja paciente, didática e objetiva. Explique de forma simples e progressiva.
- Adapte o ensino ao nível do aluno. Corrija erros explicando o motivo.
- Identifique padrões de erro e trabalhe neles.
- Incentive o aluno a produzir respostas em inglês sempre que possível.

METODOLOGIA:
1. Avalie o nível do aluno (A1–C2).
2. Crie um plano de aprendizagem personalizado.
3. Estruture cada aula: Revisão rápida → Conteúdo novo → Exemplos práticos → Exercícios → Correção detalhada → Resumo final.
4. Use situações reais do cotidiano. Reforce conteúdos anteriores periodicamente.

CORREÇÕES — sempre use este formato:
❌ Frase Original:
[texto]
✅ Correção:
[texto corrigido]
📚 Explicação:
[explicação simples e objetiva]

VOCABULÁRIO — ao apresentar palavra nova, informe: Tradução · Pronúncia simplificada · Classe gramatical · Exemplo em inglês · Tradução do exemplo.

EXERCÍCIOS DISPONÍVEIS: múltipla escolha, completar frases, tradução, associação de palavras, ordenação de frases, conversação guiada, interpretação de texto, pronúncia, simulação de situações reais.

CONVERSAÇÃO: converse prioritariamente em inglês, adapte a dificuldade ao nível, corrija erros importantes após a resposta, mantenha a conversa natural.

REGRA PRINCIPAL: gere aprendizado real e progressivo. Não apenas forneça respostas — ensine, corrija, acompanhe a evolução e adapte as aulas conforme o desempenho do aluno.

Use português para explicações quando ajudar a clareza, mas incentive a imersão em inglês.

Keep responses concise and engaging. Use examples, exercises, and real-world contexts.`;

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  // Anti-abuso de custo: limita chamadas pagas à Groq por usuário.
  const { allowed, retryAfter } = await checkRateLimit(`ai:${session.user.id}`, LIMITS.AI_CHAT.max, LIMITS.AI_CHAT.windowMs);
  if (!allowed) {
    return NextResponse.json({ error: `Muitas mensagens. Aguarde ${retryAfter}s.` }, { status: 429 });
  }

  const parsed = AiMessageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { message, sessionId } = parsed.data;

  let chatSession = sessionId
    ? await prisma.chatSession.findUnique({
        where: { id: sessionId, studentId: session.user.id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      })
    : null;

  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        studentId: session.user.id,
        title: message.slice(0, 50),
      },
      include: { messages: true },
    });
  }

  const userMsg = await prisma.chatMessage.create({
    data: {
      sessionId: chatSession.id,
      role: "user",
      content: message,
    },
  });

  const history = chatSession.messages.map((m: any) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
  } catch (e) {
    // Falha/timeout do provedor: remove a mensagem do usuário órfã (sem resposta) e
    // responde 503 — não vaza 500 cru nem deixa o histórico inconsistente.
    await prisma.chatMessage.delete({ where: { id: userMsg.id } }).catch(() => {});
    console.error("[AI] Groq indisponível:", e);
    return NextResponse.json(
      { error: "Tutor indisponível no momento. Tente novamente em instantes." },
      { status: 503 }
    );
  }

  const reply = completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";

  await prisma.chatMessage.create({
    data: {
      sessionId: chatSession.id,
      role: "assistant",
      content: reply,
      tokens: completion.usage?.total_tokens,
    },
  });

  await audit({ userId: session.user.id, action: "AI_CHAT", entity: "ChatSession", entityId: chatSession.id });

  return NextResponse.json({
    reply,
    sessionId: chatSession.id,
    tokens: completion.usage?.total_tokens,
  });
});

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await requireAuth();

  const sessions = await prisma.chatSession.findMany({
    where: { studentId: session.user.id },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(sessions);
});
