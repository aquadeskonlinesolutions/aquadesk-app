import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-[9px] overflow-hidden">
            <img src="/logo.png" alt="AquaDesk" className="w-full h-full object-contain" />
          </div>
          <span className="font-display text-2xl text-navy">
            Aqua<span className="text-teal">Desk</span>
          </span>
        </div>
        <div className="bg-white rounded-card-lg shadow-card border border-gray-200 p-8">
          <h1 className="font-display text-xl text-navy mb-6">Sign in</h1>
          {params.suspended && (
            <p className="text-sm text-red mb-4">
              This dive center&apos;s account is suspended. Contact AquaDesk support for help.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
