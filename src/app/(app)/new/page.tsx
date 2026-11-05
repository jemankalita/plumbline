import { NewDraftForm } from "@/components/NewDraftForm";
import { can } from "@/lib/auth-shared";
import { currentRole } from "@/lib/auth";

export const metadata = { title: "New draft" };

export default async function NewDraftPage() {
  const role = await currentRole();
  return (
    <div className="grid gap-6">
      <div>
        <p className="kicker">Step 1 of 3 · Submit</p>
        <h1 className="mt-1 font-serif text-[40px] leading-none tracking-tight text-navy sm:text-5xl">Check a new draft</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Paste or upload your copy. Plumbline runs the rules pass, checks every claim against approved facts, asks AI only for tone and messaging, and drops any AI
          finding it can&apos;t verify. Usually takes a few seconds.
        </p>
      </div>
      <NewDraftForm canSubmit={can(role, "submit")} role={role} />
    </div>
  );
}
