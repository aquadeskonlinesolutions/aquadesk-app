import Link from "next/link";

// Shared chrome for the public legal pages (/terms, /privacy,
// /refund-policy) — no auth, no DB reads, just a minimal header/footer
// wrapping static content so Paddle's domain review (and anyone else)
// can reach these without signing in.
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-off-white">
      <header className="h-16 shrink-0 px-4 sm:px-8 flex items-center justify-between bg-white border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[9px] overflow-hidden shrink-0">
            <img src="/logo.png" alt="AquaDesk" className="w-full h-full object-contain" />
          </div>
          <span className="font-display text-xl text-navy">
            Aqua<span className="text-teal">Desk</span>
          </span>
        </Link>
        <Link href="/" className="text-sm text-gray-600 hover:text-navy transition-colors">
          ← Back to home
        </Link>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-14">
        <div className="max-w-[720px] mx-auto">{children}</div>
      </main>

      <footer className="bg-navy-dark py-8 px-4 text-center">
        <div className="font-display text-lg text-white/60 mb-2">
          Aqua<span className="text-teal">Desk</span> Solutions
        </div>
        <div className="text-sm text-white/30 mb-3">
          aquadesk.online · aquadeskonline@gmail.com · Built in Malapascua Island, Philippines · © 2026
        </div>
        <div className="flex justify-center gap-4 text-xs text-white/30">
          <Link href="/terms" className="hover:text-white/60 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white/60 transition-colors">
            Privacy
          </Link>
          <Link href="/refund-policy" className="hover:text-white/60 transition-colors">
            Refund Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
