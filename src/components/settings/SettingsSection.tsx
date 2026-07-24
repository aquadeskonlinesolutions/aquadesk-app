export function SettingsSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-navy">{title}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-teal-light text-sm text-navy rounded-lg px-4 py-3 mb-4">
      {children}
    </div>
  );
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-orange-light text-sm text-orange rounded-lg px-4 py-3 mb-4">
      {children}
    </div>
  );
}

export function ChargeTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: "per_dive" | "per_day";
  onChange: (v: "per_dive" | "per_day") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex border border-gray-200 rounded-md overflow-hidden shrink-0">
      {(["per_dive", "per_day"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt
              ? "bg-navy text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          {opt === "per_dive" ? "Per Dive" : "Per Day"}
        </button>
      ))}
    </div>
  );
}
