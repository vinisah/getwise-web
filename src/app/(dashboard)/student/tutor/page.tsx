"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/gw/primitives";
import { Bot, Send, Plus } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Can you help me practice my daily routine?",
  "What's the difference between 'since' and 'for'?",
  "Help me with the present perfect tense",
  "Let's have a conversation about traveling",
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((p) => [...p, { role: "assistant", content: data.reply ?? "Sorry, something went wrong." }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Oops! Connection hiccup. Let's try again 🙂" }]);
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="gw-card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 168px)", overflow: "hidden" }}>
      {/* header */}
      <div className="gw-chat-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "var(--r-sm)", background: "var(--violet-soft)", color: "var(--violet)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={22} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>Wise Tutor</div>
            <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--success)" }} /> Online · responde na hora
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setMessages([]); setInput(""); setSessionId(null); }}>
          <Plus size={15} /> Nova conversa
        </Button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="gw-chat-body">
        {empty ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 460, padding: "20px 0" }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: "var(--violet-soft)", color: "var(--violet)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <Bot size={36} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>Your English Tutor is ready!</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>
              Ask anything — grammar, vocabulary, pronunciation — or just start a conversation in English.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 22 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="gw-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760, margin: "0 auto", width: "100%" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 11, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                {m.role === "user" ? <Avatar initials="EU" size={34} tone="brand" /> : <BotAvatar />}
                <div className={`gw-bubble ${m.role === "user" ? "user" : "bot"}`}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 11 }}>
                <BotAvatar />
                <div className="gw-bubble bot" style={{ display: "flex", gap: 5 }}>
                  <span className="gw-typing" /><span className="gw-typing" /><span className="gw-typing" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="gw-chat-foot">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="gw-composer">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message in English..." autoFocus />
          <Button type="submit" variant="accent" disabled={!input.trim() || loading} style={{ padding: "10px 14px" }}>
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
