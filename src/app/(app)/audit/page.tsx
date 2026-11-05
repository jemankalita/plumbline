import Link from "next/link";
import { listAudit } from "@/lib/db/repo";

export const metadata = { title: "Audit log" };

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

const TONE: Record<string, string> = {
  overridden: "bg-coral",
  approved: "bg-mint",
  accepted: "bg-mint",
  cleared: "bg-mint",
  dismissed: "bg-amber",
  disputed: "bg-amber",
  changes_requested: "bg-amber",
};

export default async function AuditPage() {
  const entries = await listAudit(300);
  return (
    <div className="grid gap-6">
      <div>
        <p className="kicker">Accountability</p>
        <h1 className="mt-1 font-serif text-[40px] leading-none tracking-tight text-navy sm:text-5xl">Audit log</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">Every check, decision, override and Brand Kit change, newest first. Append-only: nothing here can be edited from the app.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-navy/80 text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-sky-700">
                <th className="px-5 py-2.5 font-medium">When (IST)</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Event</th>
                <th className="px-5 py-2.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const key = e.action.split(".").pop() ?? "";
                return (
                  <tr key={e.id} className="border-b border-hair align-top last:border-0">
                    <td className="num whitespace-nowrap px-5 py-3 text-muted">{fmt.format(new Date(e.at))}</td>
                    <td className="px-3 py-3 capitalize text-navy">{e.role}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink">
                        <span className={`size-1.5 rounded-full ${TONE[key] ?? "bg-sky-400"}`} aria-hidden />
                        {e.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink">
                      {e.submissionId && e.title && (
                        <Link href={`/s/${e.submissionId}`} className="mr-1.5 font-medium text-navy hover:text-sky-700 hover:underline">
                          {e.title}
                        </Link>
                      )}
                      {e.detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
