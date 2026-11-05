"use client";

import { AnimatePresence, motion } from "motion/react";
import { BarChart3, BookMarked, Check, ChevronDown, Inbox, Menu, PenLine, ScrollText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ROLES } from "@/lib/auth-shared";
import type { Role } from "@/lib/types";
import { api, cx, Logo } from "./ui";

const NAV = [
  { href: "/queue", label: "Review queue", icon: Inbox },
  { href: "/new", label: "New draft", icon: PenLine },
  { href: "/kit", label: "Brand Kit", icon: BookMarked },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

export function Shell({ role, status, children }: { role: Role; status: { ai: boolean; db: "supabase" | "file" }; children: ReactNode }) {
  const path = usePathname();
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);

  const nav = (
    <nav className="grid gap-0.5" aria-label="Workspace">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href === "/queue" && path.startsWith("/s/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
              active ? "font-medium text-navy" : "text-ink hover:bg-sky-100/60 hover:text-navy"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-white shadow-soft ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className={cx("relative size-4", active ? "text-sky-600" : "text-muted")} aria-hidden />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="grid gap-2 rounded-xl border border-line bg-white/70 p-3 text-xs">
      <p className="kicker !text-[9.5px]">System</p>
      <StatusLine on={status.ai} label={status.ai ? "AI judgement: Gemini" : "AI judgement off"} />
      <StatusLine on label={status.db === "supabase" ? "Database: Supabase" : "Database: local file"} />
      <StatusLine on label="Verifier: on" />
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-sky-50/70 px-4 py-5 lg:flex">
        <Link href="/" className="px-1.5" aria-label="Plumbline home">
          <Logo />
        </Link>
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-sky-25/85 px-4 backdrop-blur-md sm:px-6">
          <button className="grid size-9 place-items-center rounded-lg hover:bg-sky-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto">
            <RoleSwitcher role={role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-navy/30" onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-sky-50 p-5"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-lg hover:bg-sky-100">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
              <div className="mt-auto">{footer}</div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusLine({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-ink">
      <span className={cx("size-1.5 rounded-full", on ? "bg-mint" : "bg-muted/50")} aria-hidden />
      {label}
    </span>
  );
}

function RoleSwitcher({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const current = ROLES.find((r) => r.id === role)!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pick = (id: Role) => {
    setOpen(false);
    start(async () => {
      await api("/api/role", { body: { role: id } });
      router.refresh();
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-white py-1 pl-1.5 pr-3 text-left shadow-soft transition-colors hover:border-sky-300"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-navy font-serif text-[15px] text-white">{current.name[0]}</span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-medium text-navy">{current.person}</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-sky-600">Acting as {current.name}</span>
        </span>
        <ChevronDown className={cx("size-4 text-muted transition-transform", open && "rotate-180", pending && "animate-pulse")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-40 w-[320px] origin-top-right rounded-2xl border border-line bg-white p-1.5 shadow-lift"
          >
            <p className="px-2.5 pb-1 pt-2 kicker">Demo sign-in · switch role</p>
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="menuitemradio"
                aria-checked={r.id === role}
                onClick={() => pick(r.id)}
                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-sky-50"
              >
                <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg font-serif text-[15px]", r.id === role ? "bg-navy text-white" : "bg-sky-100 text-sky-700")}>
                  {r.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-navy">
                    {r.name} <span className="font-normal text-muted">· {r.person.split(" · ")[0]}</span>
                    {r.id === role && <Check className="ml-auto size-4 text-sky-600" />}
                  </span>
                  <span className="block text-xs leading-snug text-muted">{r.blurb}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
