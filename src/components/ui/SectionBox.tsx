// Matches scheduling.html's real .section-block treatment — a bordered,
// individually-labeled sub-box, used to chunk a long form into scannable
// sections instead of one flat stack of fields.
export function SectionBox({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-gray-200 rounded-lg p-4 bg-white ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-extrabold uppercase tracking-wide text-navy">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
