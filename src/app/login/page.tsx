import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-[9px] bg-navy flex items-center justify-center font-display text-lg text-white">
            A
          </div>
          <span className="font-display text-2xl text-navy">
            Aqua<span className="text-teal">Desk</span>
          </span>
        </div>
        <div className="bg-white rounded-card-lg shadow-card border border-gray-200 p-8">
          <h1 className="font-display text-xl text-navy mb-6">Sign in</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
