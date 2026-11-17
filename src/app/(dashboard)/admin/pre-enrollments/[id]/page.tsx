import { ApplicationDetail } from "@/components/enrollment/application-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ApplicationDetail id={(await params).id} admin />;
}
