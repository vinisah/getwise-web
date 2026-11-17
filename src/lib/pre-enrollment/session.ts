import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
export async function applicantSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError(401, "Entre para acompanhar sua pré-matrícula.");
  return session;
}
