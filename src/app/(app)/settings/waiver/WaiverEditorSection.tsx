"use client";

import { useRef, useState, useTransition } from "react";
import { SettingsSection, InfoBox } from "@/components/settings/SettingsSection";
import { saveWaiverContent } from "./actions";
import { sanitizeWaiverHtml } from "@/lib/sanitizeWaiverHtml";

const TOOLBAR: { label: string; command: string; style?: React.CSSProperties }[] = [
  { label: "B", command: "bold", style: { fontWeight: 700 } },
  { label: "I", command: "italic", style: { fontStyle: "italic" } },
  { label: "¶ Paragraph", command: "insertParagraph" },
  { label: "• List", command: "insertUnorderedList" },
  { label: "1. List", command: "insertOrderedList" },
  { label: "→ Indent", command: "indent" },
  { label: "← Outdent", command: "outdent" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "Not set yet.";
  return (
    "Last updated: " +
    new Date(iso).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );
}

export function WaiverEditorSection({
  waiverContent,
  waiverUpdatedAt,
}: {
  waiverContent: string;
  waiverUpdatedAt: string | null;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [lastUpdated, setLastUpdated] = useState(formatDate(waiverUpdatedAt));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function exec(command: string) {
    editorRef.current?.focus();
    document.execCommand(command, false);
  }

  function save() {
    const html = editorRef.current?.innerHTML ?? "";
    startTransition(async () => {
      const res = await saveWaiverContent(html);
      if (res.error) {
        setError(res.error);
        setSuccess(false);
      } else {
        setError(null);
        setSuccess(true);
        setLastUpdated(formatDate(new Date().toISOString()));
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeWaiverHtml(html);
        }
      }
    });
  }

  return (
    <SettingsSection
      title="Liability Waiver"
      subtitle="Appears on the diver registration form — updating does not affect already-signed waivers"
      action={
        <button
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-md hover:bg-navy-dark transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Waiver"}
        </button>
      }
    >
      <InfoBox>
        This text is shown to divers before they sign the waiver during
        registration. Updating it here does not change already-signed
        waivers on file.
      </InfoBox>
      {error && <div className="mb-3 text-sm text-red">{error}</div>}
      {success && <div className="mb-3 text-sm text-green">Waiver saved.</div>}
      <div className="text-xs text-gray-400 mb-3">{lastUpdated}</div>

      <div className="flex flex-wrap gap-1 p-2 bg-gray-100 border border-gray-200 border-b-0 rounded-t-lg">
        {TOOLBAR.map((btn) => (
          <button
            key={btn.command}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(btn.command)}
            style={btn.style}
            className="px-2.5 py-1 text-sm text-gray-700 rounded hover:bg-gray-200"
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: waiverContent }}
        className="min-h-[260px] p-4 border border-gray-200 rounded-b-lg bg-white text-sm leading-relaxed outline-none focus:border-teal"
      />
    </SettingsSection>
  );
}
