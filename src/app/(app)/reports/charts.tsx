// Hand-built chart primitives for the Reports Overview tab — no charting
// library, matching this file's own established convention (Money
// Snapshot's conic-gradient donut, BarList's flex/grid bars). MonthlyBarChart
// stays CSS/div-based like BarList; MonthlyLineChart uses inline SVG
// (polylines) since a connected trend line has no clean CSS-only
// equivalent; SimplePieChart generalizes the donut's conic-gradient
// technique from 2 fixed slices to N data-driven ones.

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Pure string parsing, never a Date object — a "YYYY-MM" string has no
// timezone to misalign, but round-tripping through `new Date(ym)` would
// interpret it as UTC midnight and can shift the displayed month by one
// under some local offsets. Same caution as this project's other
// Manila-anchoring lessons, just avoided outright here.
function monthShortLabel(ym: string): string {
  const month = Number(ym.split("-")[1]);
  return MONTH_ABBR[month - 1] ?? ym;
}

export type ChartSeries = { key: string; label: string; color: string };
export type MonthlyChartRow = { month: string; [seriesKey: string]: number | string };

function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex items-center gap-4 mb-3 flex-wrap">
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

export function MonthlyBarChart({
  data,
  series,
  formatValue = (v: number) => String(Math.round(v)),
}: {
  data: MonthlyChartRow[];
  series: ChartSeries[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  return (
    <div>
      <Legend series={series} />
      <div className="flex items-end gap-2 h-[180px] border-b border-gray-200 pb-1">
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex items-end justify-center gap-0.5 h-full">
            {series.map((s) => {
              const value = Number(d[s.key]) || 0;
              const pct = value > 0 ? Math.max(2, (value / max) * 100) : 0;
              return (
                <div
                  key={s.key}
                  className="flex-1 rounded-t-sm min-w-1"
                  style={{ height: `${pct}%`, background: s.color }}
                  title={`${monthShortLabel(d.month)} — ${s.label}: ${formatValue(value)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        {data.map((d) => (
          <div key={d.month} className="flex-1 text-center text-[10px] text-gray-500 truncate">
            {monthShortLabel(d.month)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyLineChart({
  data,
  series,
  formatValue = (v: number) => String(Math.round(v)),
}: {
  data: MonthlyChartRow[];
  series: ChartSeries[];
  formatValue?: (v: number) => string;
}) {
  const width = 720;
  const height = 200;
  const padding = { top: 10, right: 8, bottom: 8, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const yFor = (v: number) => padding.top + innerH - ((v - min) / range) * innerH;
  const pointsFor = (key: string) =>
    data.map((d, i) => `${padding.left + i * stepX},${yFor(Number(d[key]) || 0)}`).join(" ");
  const zeroY = yFor(0);

  return (
    <div>
      <Legend series={series} />
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]" preserveAspectRatio="none">
        {min < 0 && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        )}
        {series.map((s) => (
          <polyline
            key={s.key}
            points={pointsFor(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) =>
          data.map((d, i) => (
            // aria-label, not a nested <title> — an SVG <title> child inside
            // an element repeated many times in a loop is a known React/
            // browser-parser hydration-mismatch hazard (the HTML parser's
            // special RAWTEXT handling for the <title> tag name doesn't
            // always stay correctly scoped to SVG "foreign content" mode
            // across server-rendered chunk boundaries) — this caused a real,
            // reproducible hydration failure on this exact chart. aria-label
            // gives the same accessible name with no such risk.
            <circle
              key={`${s.key}-${d.month}`}
              cx={padding.left + i * stepX}
              cy={yFor(Number(d[s.key]) || 0)}
              r={2.5}
              fill={s.color}
              aria-label={`${monthShortLabel(d.month)} — ${s.label}: ${formatValue(Number(d[s.key]) || 0)}`}
            />
          )),
        )}
      </svg>
      <div className="flex mt-1">
        {data.map((d) => (
          <div key={d.month} className="text-center text-[10px] text-gray-500" style={{ flex: "1 1 0" }}>
            {monthShortLabel(d.month)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimplePieChart({
  data,
  colors,
  formatValue = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  colors: string[];
  formatValue?: (v: number) => string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <div className="text-center py-6 text-gray-500 text-sm">No data yet for this year.</div>;
  }

  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  // Cumulative running sums as a precomputed array, not a mutated closure
  // variable — avoids reassigning an outer-scope variable from inside the
  // render-time .map callback below.
  const cumulativeSums = data.reduce<number[]>((acc, d) => {
    acc.push((acc[acc.length - 1] ?? 0) + d.value);
    return acc;
  }, []);
  const stops = data.map((d, i) => {
    const startDeg = ((cumulativeSums[i - 1] ?? 0) / total) * 360;
    const endDeg = (cumulativeSums[i] / total) * 360;
    return `${colors[i % colors.length]} ${startDeg}deg ${endDeg}deg`;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-full max-w-[150px] aspect-square rounded-full shrink-0 mx-auto overflow-hidden"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      />
      <div className="grid gap-1.5 text-sm text-gray-600 w-full">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between gap-2 min-w-0">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="font-extrabold text-xs shrink-0">{formatValue(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
