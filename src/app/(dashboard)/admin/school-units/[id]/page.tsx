import { SchoolUnitDetail } from "@/components/enrollment/school-units";
import { getSchoolUnit } from "@/lib/pre-enrollment/school-unit";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SchoolUnitDetail unit={await getSchoolUnit((await params).id)} />;
}
