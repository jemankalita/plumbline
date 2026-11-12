"use client";

// Catches an unexpected failure inside the workspace, so a judge sees a way forward instead of a blank page.
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
    <Card className="grid max-w-xl gap-3 p-6">
      <p className="kicker">Something went wrong</p>
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">This page didn&apos;t load.</h1>
      <p className="text-[15px] text-muted">
        Nothing you saved is lost: decisions and drafts are stored as you make them. Try again, or go back to the review queue.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => retry()}>
          Try again
        </Button>
        <Link href="/queue" className="inline-flex h-10 items-center rounded-lg px-4 text-[15px] font-medium text-ink ring-1 ring-inset ring-ash-200 hover:bg-ash-50">
          Review queue
        </Link>
      </div>
    </Card>
    </div>
  );
}
