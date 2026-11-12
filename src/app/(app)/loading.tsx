// Shown inside the workspace while a page loads its data, so a click never looks ignored.
export default function Loading() {
  return (
    <div className="grid gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-2">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-8 w-72 rounded" />
        <div className="skeleton h-4 w-full max-w-xl rounded" />
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
