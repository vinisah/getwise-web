import { redirect } from "next/navigation";

/**
 * O roteamento por papel acontece no middleware (lê o JWT e redireciona direto
 * para a home do papel). Esta página só é alcançada sem sessão → vai pro login.
 */
export default function RootPage() {
  redirect("/login");
}
