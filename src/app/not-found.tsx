import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata = { title: "Not found" };

// A missing page or a draft that no longer exists (for example after the demo data was reset).
export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 py-16">
      <div className="grid max-w-md justify-items-start gap-4">
        <Link href="/" aria-label="Plumbline home">
          <Logo />
        </Link>
        <p className="kicker">404 · not found</p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">There&apos;s nothing at this address.</h1>
        <p className="text-[16px] text-muted">
          The link may be mistyped, or the draft it pointed to is gone. Demo data is reset from time to time, and each organisation sees only its own drafts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/queue" className="inline-flex h-11 items-center rounded-lg bg-lime px-4 text-[15px] font-medium text-soot hover:bg-lime-600">
            Open the review queue
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-lg px-4 text-[15px] font-medium text-ink ring-1 ring-inset ring-ash-200 hover:bg-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
