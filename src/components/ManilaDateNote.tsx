// Small muted note shown next to date pickers: every date in AquaDesk is a
// Manila calendar date, whatever timezone the device is set to.
export function ManilaDateNote({ className = "" }: { className?: string }) {
  return <span className={`text-sm text-gray-600 ${className}`}>Dates in Manila time (PHT)</span>;
}
