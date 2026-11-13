"use client";

import { memo, useEffect, useRef, useState, type PropsWithChildren } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Root, Element, ElementContent, Text } from "hast";
import styles from "./tutor.module.css";
import { usePreferences } from "@/components/preferences/preferences-provider";
import type { UiPrefs } from "@/lib/theme";

// Parse the complete Markdown first: emphasis and tables never flash raw syntax
// while words appear. Only generated text spans receive animation styles.
function revealWords() {
  return (tree: Root) => {
    let total = 0;
    function collect(parent: Root | Element) {
      for (const child of parent.children) {
        if (child.type === "text") total += child.value.match(/\S+/gu)?.length ?? 0;
        else if (child.type === "element") collect(child);
      }
    }
    collect(tree);
    let index = 0;
    // Walk in reading order, including inline emphasis inside a paragraph.
    function wrap(parent: Root | Element) {
      parent.children = parent.children.flatMap((child): ElementContent[] => {
        if (child.type === "doctype") return [];
        if (child.type === "element") {
          wrap(child);
          return [child];
        }
        if (child.type !== "text") return [child];
        return (child.value.match(/\s+|\S+/gu) ?? []).map((word): Element | Text => {
          if (/^\s+$/u.test(word)) return { type: "text", value: word };
          const delay = Math.round(index++ * Math.min(65, 9000 / Math.max(total, 1)));
          return {
            type: "element",
            tagName: "span",
            properties: { className: ["tutor-word"], style: `--reveal-delay:${delay}ms` },
            children: [{ type: "text", value: word }],
          };
        });
      });
    }
    wrap(tree);
  };
}

const plugins = [revealWords];
const gfm = [remarkGfm];

function TutorTable({ children }: PropsWithChildren) {
  const region = useRef<HTMLElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, []);
  // Only overflowing tables enter the tab order, so arrow keys can scroll them.
  return (
    <section
      ref={region}
      className={styles.tableScroll}
      aria-label="Tabela da resposta"
      tabIndex={overflows ? 0 : undefined}
    >
      <table>{children}</table>
    </section>
  );
}

const components: Components = {
  a: ({ href, children }) =>
    /^https?:\/\//i.test(href ?? "") ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
  table: TutorTable,
};

export const TutorMessage = memo(function TutorMessage({
  content,
  animate = false,
  pace,
  reduceMotion,
}: {
  content: string;
  animate?: boolean;
  pace?: UiPrefs["tutorPace"];
  reduceMotion?: boolean;
}) {
  const { prefs } = usePreferences();
  const speed = (pace ?? prefs.tutorPace) === "quick" ? 0.46 : 1;
  const immediate = (pace ?? prefs.tutorPace) === "instant" || (reduceMotion ?? prefs.motion === "reduced");
  const [complete, setComplete] = useState(!animate || immediate);
  const duration = Math.min(9000, (content.match(/\S+/gu)?.length ?? 0) * 65) * speed + 400;

  useEffect(() => {
    if (!animate || complete) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setComplete(true);
    if (media.matches || immediate) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, duration);
    const onPreference = () => {
      if (media.matches) finish();
    };
    media.addEventListener("change", onPreference);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", onPreference);
    };
  }, [animate, complete, duration, immediate]);

  return (
    <div
      className={`${styles.message} ${!complete && !immediate ? styles.revealing : ""}`}
      style={{ "--tutor-speed": speed } as React.CSSProperties}
    >
      {animate && (
        <div className={styles.revealControls}>
          {!complete && (
            <button type="button" className={styles.revealButton} onClick={() => setComplete(true)}>
              Mostrar tudo agora
            </button>
          )}
        </div>
      )}
      <Markdown remarkPlugins={gfm} rehypePlugins={plugins} skipHtml components={components}>
        {content}
      </Markdown>
    </div>
  );
});
