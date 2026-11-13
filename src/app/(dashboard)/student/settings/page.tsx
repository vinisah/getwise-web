import type { Metadata } from "next";
import { getCachedSession, getEffectiveUser } from "@/lib/effective-user";
import { PreferencesEditor } from "@/components/preferences/preferences-editor";

export const metadata: Metadata = { title: "Minhas preferências | Get Wise" };

export default async function PreferencesPage() {
  const session = await getCachedSession();
  const effective = await getEffectiveUser();
  return <PreferencesEditor accountName={session?.user?.name ?? "Aluno"} preview={effective?.isPreview} />;
}
