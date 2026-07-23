import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/lib/dal";

// Marketing site decision deferred per blueprint Stage 1b — could live
// entirely outside this app. For now the root just routes into the product.
export default async function Home() {
  redirect(await resolveLandingPath());
}
