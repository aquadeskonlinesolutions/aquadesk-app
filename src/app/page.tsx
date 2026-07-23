import { redirect } from "next/navigation";

// Marketing site decision deferred per blueprint Stage 1b — could live
// entirely outside this app. For now the root just routes into the product.
export default function Home() {
  redirect("/login");
}
