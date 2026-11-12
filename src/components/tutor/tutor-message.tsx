"use client";

import { memo, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Root, Element, ElementContent, Text } from "hast";
import styles from "./tutor.module.css";

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
        if (child.type === "element") { wrap(child); return [child]; }
        if (child.type !== "text") return [child];
        return (child.value.match(/\s+|\S+/gu) ?? []).map((word): Element | Text => {
          if (/^\s+$/u.test(word)) return { type: "text", value: word };
          const delay = Math.round(index++ * Math.min(65, 9000 / Math.max(total, 1)));
          return { type: "element", tagName: "span", properties: { className: ["tutor-word"], style: `--reveal-delay:${delay}ms` }, children: [{ type: "text", value: word }] };
        });
      });
    }
    wrap(tree);
  };
}

const plugins = [revealWords];
const gfm = [remarkGfm];

export const TutorMessage = memo(function TutorMessage({ content, animate = false }: { content: string; animate?: boolean }) {
  const [complete, setComplete] = useState(!animate);
  const duration = Math.min(9000, (content.match(/\S+/gu)?.length ?? 0) * 65) + 400;

  useEffect(() => {
    if (!animate || complete) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setComplete(true);
    if (media.matches) { finish(); return; }
    const timer = window.setTimeout(finish, duration);
    const onPreference = () => { if (media.matches) finish(); };
    media.addEventListener("change", onPreference);
    return () => { window.clearTimeout(timer); media.removeEventListener("change", onPreference); };
  }, [animate, complete, duration]);

  return (
    <div className={`${styles.message} ${!complete ? styles.revealing : ""}`}>
      {animate && <div className={styles.revealControls}>{!complete && <button type="button" className={styles.revealButton} onClick={() => setComplete(true)}>Mostrar tudo agora</button>}</div>}
      <Markdown remarkPlugins={gfm} rehypePlugins={plugins} skipHtml components={{
        a: ({ href, children }) => /^https?:\/\//i.test(href ?? "") ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        img: () => null,
        table: ({ children }) => <div className={styles.tableScroll} role="region" aria-label="Tabela da resposta" tabIndex={0}><table>{children}</table></div>,
      }}>{content}</Markdown>
    </div>
  );
});
