"use client";

import { useEffect, useState } from "react";
import { getCertCardSignedUrl } from "../actions";

export function CertCardModal({ certCardPath, onClose }: { certCardPath: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCertCardSignedUrl(certCardPath).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setUrl(res.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [certCardPath]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-display text-xl text-navy">Certification Card</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6 flex items-center justify-center min-h-[200px]">
          {error && <div className="text-sm text-red">{error}</div>}
          {!error && !url && <div className="text-sm text-gray-400">Loading…</div>}
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Certification card" className="max-w-full max-h-[60vh] rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}
