"use client";

import { useState, useTransition } from "react";
import { generateCrewToken } from "../actions";

export function CrewCodeSection({
  crewTokenToday,
}: {
  diveCenterId: string;
  crewTokenToday: string | null;
}) {
  const [token, setToken] = useState(crewTokenToday);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateCrewToken();
      if (res.error) setError(res.error);
      else setToken(res.token ?? null);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="font-display text-lg text-navy mb-1">Today&apos;s Crew Code</div>
      <p className="text-gray-600 text-sm mb-3">
        Share this code with divemasters, instructors, and crew so they can
        check today&apos;s schedule at <code className="text-xs">/crew</code> without
        needing a login. A new code is needed each day.
      </p>
      {error && <div className="text-sm text-red mb-2">{error}</div>}
      <div className="flex items-center gap-3 flex-wrap">
        {token ? (
          <code className="text-2xl font-mono font-bold tracking-widest bg-off-white border border-gray-200 rounded-lg px-4 py-2 text-navy">
            {token}
          </code>
        ) : (
          <span className="text-sm text-gray-400">No code generated yet today.</span>
        )}
        <button
          onClick={generate}
          disabled={pending}
          className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-mid transition-colors disabled:opacity-60"
        >
          {pending ? "Generating…" : token ? "Regenerate Code" : "Generate Today's Crew Code"}
        </button>
      </div>
    </div>
  );
}
