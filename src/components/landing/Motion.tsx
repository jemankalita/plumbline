"use client";

/**
 * Scroll and pointer motion for the landing page, adapted from patterns in Magic UI
 * (Scroll Progress, Blur Fade, Marquee), Aceternity (Spotlight)
 * and motion.dev's scroll-linked examples. Every piece falls back to a still layout
 * when the reader asks for reduced motion.
 */

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx, Logo } from "../ui";
import { EASE } from "./data";

/** A thin lime bar along the top edge that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-lime" style={{ scaleX }} />;
}

/** A section heading whose words rise and un-blur one after another as it scrolls into view. */
export function WordsReveal({ text, className, as = "h2" }: { text: string; className?: string; as?: "h2" | "h3" | "p" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const words = text.split(" ");
  return (
    <Tag className={className} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.6 }} transition={{ staggerChildren: 0.06 }} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block whitespace-pre"
          variants={
            reduce
              ? undefined
              : {
                  hidden: { opacity: 0, y: "0.4em", filter: "blur(8px)" },
                  shown: { opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } },
                }
          }
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}

/** An endless strip of items. It pauses on hover and stands still for reduced motion. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (hidden: boolean) => (
    <ul className="marquee-track flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-10 whitespace-nowrap">
          <span>{t}</span>
          <span className="size-1.5 rotate-45 bg-lime" aria-hidden />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={className}>
      <div className="marquee flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}


/** Content that drifts up and fades a little as the reader scrolls past it. */
export function Parallax({ children, className, distance = 80 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y, opacity }}>
      {children}
    </motion.div>
  );
}

/**
 * The page's one navigation bar: a plain sticky strip with the wordmark, five links and one action.
 * The link for the section being read is underlined. On a phone the links sit in a row under the
 * wordmark that scrolls sideways inside itself.
 */
export function SiteNav({ links }: { links: { href: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        setActive(ids.find((id) => seen.get(id)) ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [links]);

  const link = (l: { href: string; label: string }) => {
    const on = active === l.href.slice(1);
    return (
      <a
        key={l.href}
        href={l.href}
        aria-current={on ? "location" : undefined}
        className={cx(
          "relative whitespace-nowrap py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:origin-left after:bg-lime after:transition-transform after:duration-300",
          on ? "text-white after:scale-x-100" : "text-ash-300 after:scale-x-0 hover:text-white hover:after:scale-x-100"
        )}
      >
        {l.label}
      </a>
    );
  };

  return (
    <header className="on-soot sticky top-0 z-40 bg-soot text-[15px]">
      <div className="flex h-14 items-center gap-8 px-[var(--margin)] md:h-16">
        <a href="#top" aria-label="Plumbline, back to top" className="shrink-0">
          <Logo tone="paper" />
        </a>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Page">
          {links.map(link)}
        </nav>
        <Link href="/queue" className="shine lift ml-auto inline-flex h-9 shrink-0 items-center bg-lime px-3.5 font-medium text-soot hover:bg-lime-600 md:h-10 md:px-4">
          Open the <span className="hidden sm:inline">&nbsp;workspace</span>
          <span className="sm:hidden">&nbsp;app</span>
        </Link>
      </div>
      <nav
        className="flex gap-5 overflow-x-auto px-[var(--margin)] pb-2.5 text-[14px] [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:hidden"
        aria-label="Page sections"
      >
        {links.map(link)}
      </nav>
    </header>
  );
}
