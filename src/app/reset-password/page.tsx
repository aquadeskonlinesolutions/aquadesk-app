"use client";

import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setPassword } from "@/lib/actions/account";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [state, action, pending] = useActionState(setPassword, undefined);

  useEffect(() => {
    async function init() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") || "";
      const type = params.get("type");
      const error = params.get("error");

      if (error || type !== "recovery" || !accessToken) {
        setStatus("invalid");
        return;
      }

      const supabase = createClient();
      let sessionSet = false;

      // Try verifyOtp first (handles short OTP-style tokens), then fall
      // back to setSession for JWT-style tokens — mirrors the live app's
      // reset-password.html, which needs both for different Supabase
      // token formats.
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        token_hash: accessToken,
        type: "recovery",
      });
      if (!otpError && otpData?.session) sessionSet = true;

      if (!sessionSet) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!sessionError && sessionData?.session) sessionSet = true;
      }

      setStatus(sessionSet ? "ready" : "invalid");
    }
    init();
  }, []);

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
          {status === "checking" && (
            <p className="text-sm text-gray-500">Checking your reset link…</p>
          )}

          {status === "invalid" && (
            <div>
              <h1 className="font-display text-xl text-navy mb-3">Link expired or invalid</h1>
              <p className="text-sm text-gray-500 mb-4">
                This password reset link is no longer valid. Request a new one from the sign-in page.
              </p>
              <a
                href="/login"
                className="block w-full text-center rounded-card bg-navy text-white py-2 text-sm font-medium hover:bg-navy-dark transition-colors"
              >
                Back to sign in
              </a>
            </div>
          )}

          {status === "ready" && (
            <div>
              <h1 className="font-display text-xl text-navy mb-6">Set a new password</h1>
              <form action={action} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                  />
                </div>
                {state?.error && <p className="text-sm text-red">{state.error}</p>}
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-card bg-navy text-white py-2 text-sm font-medium hover:bg-navy-dark transition-colors disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save password"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
