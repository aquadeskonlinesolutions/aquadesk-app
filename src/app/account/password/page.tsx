import { SetPasswordForm } from "./SetPasswordForm";

export default function AccountPasswordPage() {
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
          <h1 className="font-display text-xl text-navy mb-2">
            Set your password
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Choose a password for your account. You&apos;ll use this to sign
            in from now on.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
