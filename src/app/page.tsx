import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/lib/dal";
import { LandingPage } from "./LandingPage";

// resolveLandingPath() returns "/login" specifically when there's no
// authenticated user — reused here as the signal for "show the public
// marketing site" instead of bouncing straight to the login form. Any
// other return value means a real session exists, so it still routes
// straight into the product as before.
export default async function Home() {
  const landingPath = await resolveLandingPath();
  if (landingPath !== "/login") {
    redirect(landingPath);
  }
  return <LandingPage />;
}
