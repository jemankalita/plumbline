import { Shell } from "@/components/Shell";
import { currentRole } from "@/lib/auth";
import { store } from "@/lib/db/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await currentRole();
  const status = { ai: !!process.env.GEMINI_API_KEY?.trim(), db: store().kind };
  return (
    <Shell role={role} status={status}>
      {children}
    </Shell>
  );
}
