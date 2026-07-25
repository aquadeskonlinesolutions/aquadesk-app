"use client";

export function DaySelector({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <label className="text-sm font-medium text-gray-600">Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md px-2.5 py-1.5 text-sm"
      />
    </div>
  );
}
