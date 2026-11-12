/**
 * A short placeholder for a result panel that has nothing to show yet.
 * It previews what the check will look at, so the box earns its space without taking a third of a phone screen.
 */
export function EmptyResult({ title, body, rows }: { title: string; body?: string; rows: string[] }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">{title}</p>
        {body && <p className="mt-1.5 max-w-[40ch] text-[15px] text-muted">{body}</p>}
      </div>
      <ul className="grid gap-1.5" aria-label="What it checks">
        {rows.map((r) => (
          <li key={r} className="flex items-center gap-2.5 rounded-lg border border-dashed border-ash-200 px-3 py-2 text-[14px] text-muted">
            <span className="size-4 shrink-0 rounded-full border border-ash-300" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
