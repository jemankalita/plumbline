import { BrandKitEditor } from "@/components/BrandKitEditor";
import { can } from "@/lib/auth-shared";
import { currentRole } from "@/lib/auth";
import { getKit } from "@/lib/db/repo";

export const metadata = { title: "Brand Kit" };

export default async function KitPage() {
  const [kit, role] = await Promise.all([getKit(), currentRole()]);
  return <BrandKitEditor kit={kit} canEdit={can(role, "editKit")} aiOn={!!process.env.GEMINI_API_KEY?.trim()} today={new Date().toISOString().slice(0, 10)} />;
}
