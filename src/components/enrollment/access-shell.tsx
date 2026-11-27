import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/gw/logo";
import { BookOpen, ClipboardCheck, MessagesSquare } from "lucide-react";
import { DEFAULT_PREFS, themeVars } from "@/lib/theme";
import s from "@/app/(auth)/login/login.module.css";
const loginTheme = { ...themeVars(DEFAULT_PREFS), "--r": "22px" } as CSSProperties;
export function AccessShell({ children, titleId }: { children: ReactNode; titleId?: string }) {
  return (
    <main className={s.surface} style={loginTheme}>
      <aside className={s.brand} aria-label="Get Wise">
        <Logo white height={53} />
        <div>
          <h2>
            Um novo idioma.
            <br />
            <span>Mais possibilidades.</span>
          </h2>
          <p className={s.brandCopy}>Seu espaço para aprender, acompanhar as aulas e se conectar com a Get Wise.</p>
          <ul className={s.benefits}>
            <li>
              <BookOpen size={17} aria-hidden="true" />
              Aulas e materiais
            </li>
            <li>
              <MessagesSquare size={17} aria-hidden="true" />
              Aprendizado e prática
            </li>
            <li>
              <ClipboardCheck size={17} aria-hidden="true" />
              Acompanhamento da pré-matrícula
            </li>
          </ul>
        </div>
        <p className={s.brandFoot}>
          Uma etapa de cada vez.
          <br />A gente segue com você.
        </p>
      </aside>
      <div className={s.right}>
        <header className={s.mobileHeader}>
          <Logo white height={47} />
          <span>
            Seu portal
            <br />
            de aprendizado
          </span>
        </header>
        <div className={s.access}>
          <section className={s.card} aria-labelledby={titleId}>
            {children}
          </section>
          <p className={s.footnote}>Get Wise — Speak English</p>
        </div>
      </div>
    </main>
  );
}
