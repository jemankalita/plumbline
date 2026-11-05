import { Landing } from "@/components/landing/Landing";
import type { BoardRow, KitColumn } from "@/components/landing/data";
import { ROLES } from "@/lib/auth-shared";
import { DEMO_KIT, DEMO_SUBMISSIONS } from "@/lib/db/seed";
import { runReview } from "@/lib/engine";
import type { Citation } from "@/lib/types";

export const dynamic = "force-dynamic"; // reads the AI setting and runs a fresh check at request time

const PASS_LABEL = { rules: "Rules pass", claims: "Claims pass", judgement: "AI judgement", image: "Image pass" } as const;
const BOARD_ROWS = 9;

function citedTitle(c: Citation): string {
  if (c.kind === "rule") return DEMO_KIT.rules.find((r) => r.id === c.id)?.title ?? c.excerpt;
  if (c.kind === "fact") return DEMO_KIT.facts.find((f) => f.id === c.id)?.statement ?? c.excerpt;
  return c.excerpt;
}

/** The landing board shows a real, deterministic engine run over the demo drafts that still need work. */
async function liveBoard(): Promise<{ rows: BoardRow[]; ms: number }> {
  const drafts = DEMO_SUBMISSIONS.filter((s) => s.status !== "approved").slice(0, 3);
  const t0 = Date.now();
  const runs = await Promise.all(drafts.map((d) => runReview({ text: d.text, kit: DEMO_KIT, channel: d.channel })));
  const ms = Date.now() - t0;
  const rows = runs.flatMap((r, i) =>
    r.findings.map((f) => ({
      id: `${i}-${f.id}`,
      draft: drafts[i].channel,
      quote: f.quote,
      cite: f.cites.label,
      title: citedTitle(f.cites),
      pass: PASS_LABEL[f.pass],
      severity: f.severity,
      message: f.message,
      fix: f.fix ?? null,
    }))
  );
  return { rows: rows.slice(0, BOARD_ROWS), ms };
}

function kitColumns(): KitColumn[] {
  const visual = new Set(["accessibility", "visual"]);
  return [
    { kind: "Voice and claims", names: DEMO_KIT.rules.filter((r) => !visual.has(r.category)).slice(0, 8).map((r) => r.title) },
    { kind: "Approved facts", names: DEMO_KIT.facts.map((f) => f.statement) },
    { kind: "Images", names: [...DEMO_KIT.rules.filter((r) => visual.has(r.category)).map((r) => r.title), ...DEMO_KIT.palette.map((p) => `${p.name} ${p.hex}`)] },
    { kind: "People who decide", names: ROLES.map((r) => `${r.person.split(" · ")[0]}, ${r.name.toLowerCase()}`) },
  ];
}

export default async function Home() {
  const board = await liveBoard();
  return <Landing aiOn={!!process.env.GEMINI_API_KEY?.trim()} board={board.rows} boardMs={board.ms} columns={kitColumns()} />;
}
