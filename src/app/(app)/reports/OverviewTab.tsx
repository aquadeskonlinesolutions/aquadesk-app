import type { OverviewData } from "./data";

function peso(n: number): string {
  return `₱${Math.round(n).toLocaleString()}`;
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={
        bold
          ? "flex justify-between items-baseline font-extrabold text-navy text-sm py-1"
          : "flex justify-between py-2 pl-4 text-sm text-gray-600 border-b border-dashed border-gray-100 last:border-0"
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// "Owed to you" bars use the same teal as Money Snapshot's collected-money
// segment; "you owe" bars use the same orange as its open/pending segment
// — same color language, not a new convention.
function SettledBarList({
  items,
}: {
  items: { label: string; value: number; variant: "owed" | "owe" }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid gap-2 mt-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[1fr_90px] gap-3 items-center">
          <div className="grid gap-1">
            <div className="text-xs text-gray-600">{item.label}</div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${item.variant === "owed" ? "bg-teal" : "bg-orange"}`}
                style={{ width: `${item.value === 0 ? 0 : Math.max(4, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="text-xs font-extrabold text-gray-600 text-right">{peso(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function BarList({ items, format }: { items: { name: string; count: number }[] | { name: string; amount: number }[]; format: (v: number) => string }) {
  const values = items.map((i) => ("count" in i ? i.count : i.amount));
  const max = Math.max(1, ...values);
  if (items.length === 0) {
    return <div className="text-center py-6 text-gray-500 text-sm">No data yet for this period.</div>;
  }
  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const value = "count" in item ? item.count : item.amount;
        return (
          <div key={item.name} className="grid grid-cols-[130px_1fr_60px] gap-3 items-center">
            <div className="text-sm font-bold text-navy truncate">{item.name}</div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal to-navy-mid rounded-full"
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
            <div className="text-xs font-extrabold text-gray-600 text-right">{format(value)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function OverviewTab({
  data,
  dateFromLabel,
  dateToLabel,
}: {
  data: OverviewData;
  dateFromLabel: string;
  dateToLabel: string;
}) {
  const { summary } = data;
  // notYetSettled already includes openDiverBills as one of its addends
  // (see reports/data.ts) — don't add it again here, or the donut's total
  // (and the "Open" arc's proportion within it) silently inflates by one
  // extra copy of openDiverBills every time.
  const total = Math.max(1, summary.collectedFromDivers + summary.notYetSettled);
  const collectedDeg = (summary.collectedFromDivers / total) * 360;
  const openDeg = ((summary.collectedFromDivers + summary.openDiverBills) / total) * 360;

  return (
    <div>
      <div
        className="rounded-3xl p-6 mb-5 text-white shadow-lg"
        style={{
          background:
            "radial-gradient(circle at 10% 10%, rgba(0,168,171,.25), transparent 35%), linear-gradient(135deg, var(--navy), var(--navy-dark))",
        }}
      >
        <div className="text-xs uppercase tracking-widest text-white/55 font-extrabold mb-2">
          Your Story
        </div>
        <div className="font-display text-3xl leading-tight tracking-tight mb-2">
          {data.diveCenterName} — {dateFromLabel} to {dateToLabel}
        </div>
        <p className="text-sm leading-relaxed text-white/80 max-w-2xl">
          You served <strong className="text-white">{data.divesServed}</strong> diver
          {data.divesServed !== 1 ? "s" : ""} across{" "}
          <strong className="text-white">{data.completedDives}</strong> completed dive
          {data.completedDives !== 1 ? "s" : ""}, and made{" "}
          <strong className="text-white">{peso(summary.netProfit)}</strong> net profit this period.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-5">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Business Summary</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {dateFromLabel} – {dateToLabel}
          </div>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <SummaryRow label="Money In" value={peso(summary.moneyIn)} bold />
            <SummaryRow label="Collected from Divers" value={peso(summary.collectedFromDivers)} />
            <SummaryRow label="Gear Rental Income (Collected)" value={peso(summary.rentalIncome)} />
            <SummaryRow label="Join Ride Income (Collected)" value={peso(summary.joinIncome)} />
          </div>
          <div className="mb-4">
            <SummaryRow label="Money Out" value={peso(summary.moneyOut)} bold />
            <SummaryRow label="Government Fees (Marine/Shark Tax)" value={peso(summary.govtFees)} />
            <SummaryRow label="Dive Center Expenses" value={peso(summary.expenses)} />
            <SummaryRow label="Gear Rental Expense (Paid)" value={peso(summary.rentalExpense)} />
            <SummaryRow label="Join Ride Expense (Paid)" value={peso(summary.joinExpense)} />
            <SummaryRow label="Staff Commissions (Paid)" value={peso(summary.commissionsPaid)} />
          </div>
          <div
            className={`flex justify-between items-center font-display text-2xl rounded-xl px-5 py-4 mb-4 ${
              summary.netProfit < 0 ? "bg-red-light text-red" : "bg-teal-light text-navy"
            }`}
          >
            <span>Net Profit</span>
            <span>{peso(summary.netProfit)}</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 pt-4 pb-4">
            <div className="flex justify-between font-extrabold text-gray-600 text-xs uppercase tracking-wide mb-1">
              <span>Not Yet Settled</span>
              <span className="font-normal text-gray-400 normal-case tracking-normal">
                Current balances, excluded from Net Profit above
              </span>
            </div>
            <SettledBarList
              items={[
                { label: "Open Diver Bills (owed to you)", value: summary.openDiverBills, variant: "owed" },
                { label: "Gear Rental — To Collect (owed to you)", value: summary.rentalToCollect, variant: "owed" },
                { label: "Gear Rental — To Pay (you owe)", value: summary.rentalToPay, variant: "owe" },
                { label: "Join Ride — To Collect (owed to you)", value: summary.joinToCollect, variant: "owed" },
                { label: "Join Ride — To Pay (you owe)", value: summary.joinToPay, variant: "owe" },
                { label: "Unpaid Staff Commissions (you owe)", value: summary.unpaidCommissions, variant: "owe" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Dive Site Activity</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Completed dives by site, highest to lowest.
            </div>
          </div>
          <div className="p-5">
            <BarList items={data.topSites} format={(v) => String(v)} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Money Snapshot</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Collected, open, and pending money movement.
            </div>
          </div>
          <div className="p-5 flex flex-col items-center justify-center gap-4 h-full min-w-0 overflow-hidden">
            <div
              className="w-full max-w-[150px] aspect-square rounded-full grid place-items-center shrink-0 mx-auto"
              style={{
                background: `conic-gradient(var(--teal) 0deg, var(--teal) ${collectedDeg}deg, var(--orange) ${collectedDeg}deg, var(--orange) ${openDeg}deg, var(--gray-200) ${openDeg}deg)`,
              }}
            >
              <div className="w-[92px] h-[92px] bg-white rounded-full grid place-items-center text-center font-display text-navy overflow-hidden px-1">
                <span
                  className={
                    peso(summary.collectedFromDivers + summary.notYetSettled).length > 9
                      ? "text-xs leading-tight"
                      : "text-xl leading-tight"
                  }
                >
                  {peso(summary.collectedFromDivers + summary.notYetSettled)}
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-gray-600 justify-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal shrink-0" />
                Collected from divers
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange shrink-0" />
                Open diver bills
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                Other pending money
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-sm font-extrabold text-navy">Expense Breakdown</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Where dive center spending went this period, by category.
          </div>
        </div>
        <div className="p-5">
          <BarList items={data.expenseCategoryTotals} format={peso} />
        </div>
      </div>
    </div>
  );
}
