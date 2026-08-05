"use client";

import { useState } from "react";
import Link from "next/link";

// Public marketing site for AquaDesk itself (not a tenant-facing operator
// screen like every other page in this app) — ported from the reference
// D:\Rebuild\index.html into this app's own Tailwind/font-token
// conventions rather than importing its ~800 lines of hand-rolled CSS
// wholesale, matching how every other page here is built.
//
// The demo-request form's submit button is intentionally disabled: the
// reference file's Web3Forms integration used an API key hardcoded in
// public source with the file's own comment saying to rotate it before
// launch — reusing an already-exposed key wasn't worth the risk. Wire a
// fresh key up when one exists.

const FEATURES = [
  { icon: "📱", title: "Digital diver registration", desc: "Send divers a registration link before they arrive. They fill it out on their phone — personal info, certifications, emergency contacts, and digital waiver signature." },
  { icon: "📋", title: "Smart diver form", desc: "Secretary searches a diver, loads their record, adds activity rows, and the bill calculates automatically. Supports PHP, USD, and EUR with custom exchange rates." },
  { icon: "🖨️", title: "Invoice printing", desc: "Generate a clean, formatted invoice for any diver in one click. Shows all activity line items, payment breakdown, and totals. Password-protected once paid." },
  { icon: "🚤", title: "Dive scheduling board", desc: "Plan tomorrow's dives on a digital board. Assign divers to boats and divemasters, calculate air and nitrox tanks, and save — diver forms update automatically." },
  { icon: "⚡", title: "Bulk activity updates", desc: "When a boat returns, select it and mark all divers as completed at once. No more searching each diver individually after every dive." },
  { icon: "📊", title: "Owner dashboard", desc: "Real-time revenue today, this week, and this month. Active divers, boats out, pending bills, low tank alerts — everything at a glance from any device." },
  { icon: "👥", title: "Group bookings", desc: "Send one registration link to a group of 40 divers. Track who has registered, who hasn't, and schedule the entire group in bulk." },
  { icon: "💼", title: "Staff & payroll", desc: "Track divemaster commissions automatically. Manage salary, daily rate, and per-dive commission. Generate payroll summaries every two weeks." },
  { icon: "🏪", title: "Equipment & tank inventory", desc: "Track BCDs, wetsuits, and all rental equipment. Monitor air and nitrox tank counts with low-stock alerts before operations begin." },
] as const;

const PAIN_POINTS = [
  { icon: "📋", title: "Paper registration forms", desc: "Divers fill out forms at the front desk. Handwriting is illegible. Forms get lost. Information has to be re-entered manually." },
  { icon: "🧮", title: "Manual billing calculations", desc: "Secretaries add up dive rates, taxes, and surcharges by hand. Errors happen. Disputes follow. Time is wasted." },
  { icon: "🪣", title: "Whiteboard scheduling", desc: "Tomorrow's dive plan is written on a board. Boats, divemasters, tank counts — all done manually every single morning." },
  { icon: "📁", title: "No diver history", desc: "A returning diver fills out the same form again. There's no record of their previous visits, certifications, or preferences." },
  { icon: "💸", title: "Lost revenue", desc: "No system means no reporting. Owners have no idea how much money was made today, this week, or this month without counting receipts." },
  { icon: "😤", title: "Overwhelmed secretaries", desc: "Front desk staff are buried in paperwork instead of helping divers. Peak hours are chaotic. Mistakes are inevitable." },
] as const;

const STEPS = [
  { num: 1, title: "We onboard your dive center", desc: "We configure AquaDesk with your boats, staff, activity rates, and branding. Takes a few hours." },
  { num: 2, title: "We train your secretaries", desc: "A hands-on session with your front desk team. Simple enough that anyone can learn in under an hour." },
  { num: 3, title: "Divers register before arrival", desc: "Send your registration link via WhatsApp or email. Divers arrive already in the system." },
  { num: 4, title: "Operations run themselves", desc: "Scheduling, billing, reporting — all automated. Your team focuses on divers, not paperwork." },
] as const;

const PRICING_FEATURES = [
  "Digital diver registration — mobile optimized",
  "Smart diver form with automatic billing",
  "Multi-currency support — PHP, USD, EUR",
  "Invoice printing — password protected",
  "Daily scheduling board with tank calculator",
  "Bulk activity updates when boats return",
  "Owner dashboard with revenue reporting",
  "Group booking management",
  "Staff commissions and payroll",
  "Equipment and tank inventory",
  "Unlimited secretaries and divers",
  "Personal WhatsApp support",
] as const;

function NavIcon() {
  return (
    <div className="w-9 h-9 rounded-[9px] overflow-hidden shrink-0">
      <img src="/logo.png" alt="AquaDesk" className="w-full h-full object-contain" />
    </div>
  );
}

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [errors, setErrors] = useState<{ name?: boolean; email?: boolean; whatsapp?: boolean }>({});

  if (!open) return null;

  function validate() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const next = {
      name: !name.trim(),
      email: !email.trim() || !emailRegex.test(email.trim()),
      whatsapp: !whatsapp.trim(),
    };
    setErrors(next);
    return !next.name && !next.email && !next.whatsapp;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card-lg w-full max-w-[440px] shadow-2xl p-8 pt-10">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-5 text-2xl leading-none text-gray-400 hover:text-dark"
        >
          ×
        </button>
        <h2 className="font-display text-2xl text-navy mb-1">Request a Free Demo</h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          We&apos;ll reach out within 24 hours to set up your personalised walkthrough.
        </p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            validate();
          }}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <label htmlFor="dmName" className="text-sm font-semibold text-gray-700">
              Full Name
            </label>
            <input
              id="dmName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan dela Cruz"
              autoComplete="name"
              className={`px-4 py-3 rounded-card border-[1.5px] bg-off-white text-sm outline-none focus:border-teal focus:bg-white focus:ring-3 focus:ring-teal/10 ${errors.name ? "border-red" : "border-gray-200"}`}
            />
            {errors.name && <span className="text-xs text-red">Please enter your full name.</span>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="dmEmail" className="text-sm font-semibold text-gray-700">
              Email
            </label>
            <input
              id="dmEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@divecenter.ph"
              autoComplete="email"
              className={`px-4 py-3 rounded-card border-[1.5px] bg-off-white text-sm outline-none focus:border-teal focus:bg-white focus:ring-3 focus:ring-teal/10 ${errors.email ? "border-red" : "border-gray-200"}`}
            />
            {errors.email && <span className="text-xs text-red">Please enter a valid email address.</span>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="dmWhatsApp" className="text-sm font-semibold text-gray-700">
              WhatsApp Number
            </label>
            <input
              id="dmWhatsApp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+63 917 123 4567"
              autoComplete="tel"
              className={`px-4 py-3 rounded-card border-[1.5px] bg-off-white text-sm outline-none focus:border-teal focus:bg-white focus:ring-3 focus:ring-teal/10 ${errors.whatsapp ? "border-red" : "border-gray-200"}`}
            />
            {errors.whatsapp && <span className="text-xs text-red">Please enter your WhatsApp number.</span>}
          </div>

          <button
            type="submit"
            disabled
            title="Demo requests aren't connected yet — reach out directly using the contact details in the footer."
            className="w-full py-3.5 mt-1 bg-navy text-white rounded-card font-semibold text-sm cursor-not-allowed opacity-50"
          >
            Send Request
          </button>
          <p className="text-xs text-gray-400 text-center -mt-2">
            Demo requests aren&apos;t wired up yet — reach out directly via the contact details in the footer below.
          </p>
        </form>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="text-dark">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-40 h-16 px-4 sm:px-8 flex items-center justify-between bg-white/95 backdrop-blur-md border-b border-gray-200">
        <a href="#" className="flex items-center gap-2.5">
          <NavIcon />
          <span className="font-display text-xl text-navy">
            Aqua<span className="text-teal">Desk</span>
          </span>
        </a>
        <ul className="hidden md:flex items-center gap-8 list-none">
          <li>
            <a href="#features" className="text-sm text-gray-600 hover:text-navy transition-colors">
              Features
            </a>
          </li>
          <li>
            <a href="#how" className="text-sm text-gray-600 hover:text-navy transition-colors">
              How it works
            </a>
          </li>
          <li>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-navy transition-colors">
              Pricing
            </a>
          </li>
        </ul>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="px-3 sm:px-5 py-2 text-sm font-medium text-navy border-[1.5px] border-gray-200 rounded-lg hover:border-navy hover:bg-gray-100 transition-colors"
          >
            Sign in
          </Link>
          <a
            href="https://aquadesk-demo.netlify.app/demo.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex px-5 py-2 text-sm font-medium text-teal border-[1.5px] border-teal rounded-lg hover:bg-gray-100 transition-colors"
          >
            Explore Demo
          </a>
          <button
            onClick={() => setDemoOpen(true)}
            className="px-3 sm:px-5 py-2 text-sm font-medium text-white bg-navy rounded-lg hover:bg-navy-dark transition-colors inline-flex items-center gap-1.5"
          >
            Request a demo <span aria-hidden>→</span>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-16 sm:pt-36 sm:pb-20 px-4 sm:px-8 max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-teal-light border border-teal/20 rounded-full text-sm font-medium text-teal-mid mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            Built for Philippine dive centers
          </div>
          <h1 className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.1] tracking-tight text-navy mb-5">
            The paper forms
            <br />
            stop <em className="not-italic italic text-teal">here.</em>
          </h1>
          <p className="text-[1.05rem] text-gray-600 leading-relaxed mb-8 max-w-[440px]">
            AquaDesk is a complete operations system for dive centers — digital diver registration, automatic
            billing, daily scheduling, and real-time reporting. All in one place.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => setDemoOpen(true)}
              className="px-8 py-3.5 bg-navy text-white rounded-[10px] font-medium inline-flex items-center gap-1.5 hover:bg-navy-dark transition-colors"
            >
              Request a free demo <span aria-hidden>→</span>
            </button>
            <a
              href="https://aquadesk-demo.netlify.app/demo.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-[10px] font-medium text-teal border-[1.5px] border-teal inline-flex items-center gap-1.5 hover:bg-navy hover:text-white hover:border-navy transition-colors"
            >
              Explore Demo
            </a>
            <a
              href="#how"
              className="px-8 py-3.5 rounded-[10px] font-medium text-navy border-[1.5px] border-navy inline-flex items-center gap-1.5 hover:bg-navy hover:text-white transition-colors"
            >
              See how it works
            </a>
          </div>
          <div className="text-sm text-gray-400 mt-4 flex items-center gap-1.5 flex-wrap">
            ✓ 14-day free trial &nbsp;·&nbsp; ✓ No credit card required &nbsp;·&nbsp; ✓ Setup in 1 day
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute -top-6 -right-6 z-10 bg-white border border-gray-200 rounded-[10px] px-3.5 py-2.5 shadow-lg flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <span className="w-7 h-7 rounded-lg bg-teal-light flex items-center justify-center">✅</span>
            New diver registered
          </div>
          <div className="bg-white border border-gray-200 rounded-card-lg overflow-hidden shadow-[0_20px_60px_rgba(26,60,94,0.12)]">
            <div className="bg-navy px-5 py-4 flex items-center justify-between">
              <span className="font-display text-[0.95rem] text-white">AquaDesk · Dashboard</span>
              <span className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/20" />
                <span className="w-2 h-2 rounded-full bg-white/20" />
                <span className="w-2 h-2 rounded-full bg-white/20" />
              </span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-off-white border border-gray-200 rounded-lg p-3 text-center">
                  <div className="font-display text-2xl text-navy leading-none mb-1">24</div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">
                    Active divers
                  </div>
                </div>
                <div className="bg-off-white border border-gray-200 rounded-lg p-3 text-center">
                  <div className="font-display text-2xl text-navy leading-none mb-1">3</div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">Boats out</div>
                </div>
                <div className="bg-off-white border border-gray-200 rounded-lg p-3 text-center">
                  <div className="font-display text-2xl text-teal leading-none mb-1">₱68k</div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400">Today</div>
                </div>
              </div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Active divers
              </div>
              {[
                { initials: "JS", bg: "bg-navy", name: "Juan Santos", cert: "Advanced Open Water", badgeClass: "bg-teal-light text-teal-mid", badge: "Diving" },
                { initials: "MC", bg: "bg-teal", name: "Maria Cruz", cert: "Open Water", badgeClass: "bg-green-light text-green", badge: "Paid" },
                { initials: "DL", bg: "bg-[#7C3AED]", name: "David Lee", cert: "Rescue Diver", badgeClass: "bg-orange-light text-orange", badge: "Pending" },
              ].map((row) => (
                <div key={row.name} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div
                    className={`w-7 h-7 rounded-full ${row.bg} text-white flex items-center justify-center text-[0.7rem] font-semibold shrink-0`}
                  >
                    {row.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-medium text-dark truncate">{row.name}</div>
                    <div className="text-[0.72rem] text-gray-400 truncate">{row.cert}</div>
                  </div>
                  <span className={`text-[0.68rem] px-2 py-0.5 rounded-full font-medium shrink-0 ${row.badgeClass}`}>
                    {row.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-6 z-10 bg-white border border-gray-200 rounded-[10px] px-3.5 py-2.5 shadow-lg flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <span className="w-7 h-7 rounded-lg bg-[#FEF9C3] flex items-center justify-center">💰</span>
            Bill settled · ₱7,700
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <div className="bg-navy py-16 px-4 sm:px-8">
        <div className="text-center max-w-[600px] mx-auto mb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal mb-3">Sound familiar?</div>
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-tight tracking-tight text-white">
            Every dive center faces the same problems
          </h2>
        </div>
        <div className="max-w-[1100px] mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className="bg-white/5 border border-white/[0.08] rounded-card p-6">
              <div className="text-2xl mb-3.5 opacity-80">{p.icon}</div>
              <div className="text-base font-semibold text-white mb-2">{p.title}</div>
              <div className="text-sm text-white/50 leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 sm:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal mb-3 text-center">
            Everything you need
          </div>
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-tight text-navy text-center mb-4">
            One system. Every operation.
          </h2>
          <p className="text-base text-gray-600 text-center max-w-[540px] mx-auto mb-14 leading-relaxed">
            AquaDesk replaces every manual process in your dive center with a clean, fast, and reliable digital
            system.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-gray-200 rounded-card p-6 transition-shadow hover:shadow-[0_4px_20px_rgba(26,60,94,0.08)] hover:border-teal"
              >
                <div className="w-11 h-11 bg-teal-light rounded-[10px] flex items-center justify-center text-xl mb-4">
                  {f.icon}
                </div>
                <div className="text-base font-semibold text-navy mb-2">{f.title}</div>
                <div className="text-sm text-gray-600 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-4 sm:px-8 bg-off-white">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal mb-3 text-center">
            How it works
          </div>
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-tight text-navy text-center mb-4">
            Up and running in one day
          </h2>
          <p className="text-base text-gray-600 text-center max-w-[540px] mx-auto mb-14 leading-relaxed">
            We set everything up for you. Your team gets trained. Operations start the next morning.
          </p>
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="hidden lg:block absolute top-7 left-[15%] right-[15%] h-px bg-gray-200" />
            {STEPS.map((s) => (
              <div key={s.num} className="relative z-10 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-white border-2 border-teal rounded-full flex items-center justify-center font-display text-xl text-teal">
                  {s.num}
                </div>
                <div className="text-[0.95rem] font-semibold text-navy mb-1.5">{s.title}</div>
                <div className="text-[0.82rem] text-gray-600 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <div className="bg-teal-light border-y border-teal/15 py-16 px-4 sm:px-8">
        <div className="max-w-[700px] mx-auto text-center">
          <p className="font-display italic text-[clamp(1.4rem,2.5vw,2rem)] leading-snug tracking-tight text-navy mb-6">
            &ldquo;Built by someone who has worked in Malapascua dive centers. Every feature was designed around how
            Philippine dive operations actually work — not how a software company thinks they work.&rdquo;
          </p>
          <div className="text-sm text-gray-600">
            — Martin King Lomosad, Founder · AquaDesk Solutions · Malapascua Island
          </div>
        </div>
      </div>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-4 sm:px-8">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal mb-3 text-center">
            Simple pricing
          </div>
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-tight text-navy text-center mb-4">
            One plan. Everything included.
          </h2>
          <p className="text-base text-gray-600 text-center max-w-[540px] mx-auto mb-14 leading-relaxed">
            No tiers, no hidden fees, no surprises. Every dive center gets the full system.
          </p>

          <div className="max-w-[480px] mx-auto bg-white border-2 border-navy rounded-card-lg overflow-hidden shadow-[0_20px_60px_rgba(26,60,94,0.12)]">
            <div className="bg-navy px-8 sm:px-10 py-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal mb-2">
                AquaDesk Complete
              </div>
              <div className="font-display text-5xl text-white tracking-tight leading-none mb-1">
                ₱4,000 <span className="text-xl text-white/60">/mo</span>
              </div>
              <div className="text-sm text-white/50">Everything included · Cancel anytime</div>
            </div>
            <div className="px-8 sm:px-10 py-8">
              <div className="bg-off-white border border-gray-200 rounded-[10px] px-5 py-4 mb-6 text-center">
                <div className="text-sm text-gray-600">NO ACTIVATION OR SETUP FEE.</div>
              </div>
              <ul className="list-none mb-7">
                {PRICING_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 py-2 text-sm text-gray-700 border-b border-gray-100 last:border-0"
                  >
                    <span className="w-[18px] h-[18px] bg-green-light text-green rounded-full flex items-center justify-center text-[0.65rem] shrink-0 mt-0.5">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setDemoOpen(true)}
                className="w-full py-3.5 bg-navy text-white rounded-[10px] font-medium text-base hover:bg-navy-dark transition-colors"
              >
                Request a free demo →
              </button>
              <div className="text-center text-[0.82rem] text-gray-400 mt-4">
                14-day free trial · No credit card required
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="bg-navy py-20 px-4 sm:px-8 text-center">
        <h2 className="font-display text-[clamp(2rem,3.5vw,3rem)] leading-tight tracking-tight text-white mb-4">
          Ready to go <em className="not-italic italic text-teal">paperless?</em>
        </h2>
        <p className="text-base text-white/55 max-w-[480px] mx-auto mb-10 leading-relaxed">
          Join the first dive centers in the Philippines running on AquaDesk. Setup takes one day. Results start
          immediately.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => setDemoOpen(true)}
            className="px-8 py-3.5 bg-teal text-navy rounded-[10px] font-medium inline-flex items-center gap-1.5 hover:bg-[#009396] transition-colors"
          >
            Request a demo <span aria-hidden>→</span>
          </button>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-[10px] font-medium text-white border-[1.5px] border-white/30 hover:bg-white/10 hover:border-white/50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-navy-dark py-8 px-4 text-center">
        <div className="font-display text-lg text-white/60 mb-2">
          Aqua<span className="text-teal">Desk</span> Solutions
        </div>
        <div className="text-sm text-white/30">
          aquadesk.online · mkbusiness.ai@gmail.com · Built in Malapascua Island, Philippines · © 2026
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
