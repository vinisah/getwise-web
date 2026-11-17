import { SchoolUnitEditor } from "@/components/enrollment/school-units";
import { getSchoolUnit } from "@/lib/pre-enrollment/school-unit";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SchoolUnitEditor initial={await getSchoolUnit((await params).id)} />;
}
