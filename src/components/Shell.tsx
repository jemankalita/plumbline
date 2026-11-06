"use client";

import { AnimatePresence, motion } from "motion/react";
import { BarChart3, BookMarked, Check, ChevronDown, Inbox, Menu, PenLine, ScrollText, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ROLES } from "@/lib/auth-shared";
import type { Role } from "@/lib/types";
import { AiStatus } from "./AiStatus";
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
              "relative flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors duration-150",
              active ? "font-medium text-soot" : "text-ash-300 hover:bg-soot-3 hover:text-white"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg bg-lime"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className={cx("relative size-4", active ? "text-soot" : "text-ash-400")} aria-hidden />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="grid gap-2 rounded-lg bg-soot-2 p-3 text-[13px]">
      <AiStatus configured={status.ai} />
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="on-soot sticky top-0 hidden h-screen flex-col gap-8 bg-soot px-4 py-6 lg:flex">
        <Link href="/" className="px-3" aria-label="Plumbline home">
          <Logo tone="paper" />
        </Link>
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-white px-4 sm:px-8">
          <button className="grid size-9 place-items-center rounded-lg hover:bg-ash-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="ml-auto">
            <RoleSwitcher role={role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-8 lg:py-10">{children}</main>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-soot/50" onClick={() => setOpen(false)} />
            <motion.aside
              className="on-soot absolute inset-y-0 left-0 flex w-72 flex-col gap-8 bg-soot p-5"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="flex items-center justify-between">
                <Logo tone="paper" />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-lg text-white hover:bg-soot-3">
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
        className="flex h-11 items-center gap-2.5 rounded-lg bg-ash-50 py-1 pl-1.5 pr-3 text-left transition-colors hover:bg-ash-100"
      >
        <span className="grid size-8 place-items-center rounded-md bg-soot font-display text-[15px] font-semibold text-lime">{current.name[0]}</span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-medium text-ink">{current.person}</span>
          <span className="block text-[13px] text-muted">Acting as {current.name}</span>
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
            className="absolute right-0 top-13 z-40 w-[340px] origin-top-right rounded-lg bg-white p-1.5 shadow-lift"
          >
            <p className="px-2.5 pb-1 pt-2 kicker">Demo sign-in · switch role</p>
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="menuitemradio"
                aria-checked={r.id === role}
                onClick={() => pick(r.id)}
                className="flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-ash-50"
              >
                <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg font-display text-[15px]", r.id === role ? "bg-soot text-lime" : "bg-ash-100 text-ink")}>
                  {r.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    {r.name} <span className="font-normal text-muted">· {r.person.split(" · ")[0]}</span>
                    {r.id === role && <Check className="ml-auto size-4 text-ink" />}
                  </span>
                  <span className="block text-[13px] leading-snug text-muted">{r.blurb}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
