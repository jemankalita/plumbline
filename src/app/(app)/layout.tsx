import { Shell } from "@/components/Shell";
import { currentSession } from "@/lib/auth";
import { store } from "@/lib/db/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, kitId } = await currentSession();
  const status = { ai: !!process.env.GEMINI_API_KEY?.trim(), db: store().kind };
  return (
    <Shell role={role} kitId={kitId} status={status}>
      {children}
    </Shell>
  );
}
