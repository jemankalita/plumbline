import { notFound } from "next/navigation";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { currentRole } from "@/lib/auth";
import { getKit, getSubmission } from "@/lib/db/repo";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const d = await getSubmission(id);
  return { title: d?.submission.title ?? "Draft" };
}

export default async function SubmissionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [detail, kit, role] = await Promise.all([getSubmission(id), getKit(), currentRole()]);
  if (!detail) notFound();
  return <ReviewWorkspace detail={detail} palette={kit.palette} role={role} />;
}
