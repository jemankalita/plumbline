import { notFound } from "next/navigation";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { currentSession } from "@/lib/auth";
import { getKit, getSubmission } from "@/lib/db/repo";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { kitId } = await currentSession();
  const d = await getSubmission(kitId, id);
  return { title: d?.submission.title ?? "Draft" };
}

export default async function SubmissionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { kitId, role } = await currentSession();
  const [detail, kit] = await Promise.all([getSubmission(kitId, id), getKit(kitId)]);
  if (!detail) notFound();
  return <ReviewWorkspace detail={detail} palette={kit.palette} role={role} />;
}
