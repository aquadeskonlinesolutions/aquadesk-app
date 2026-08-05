import type { OverviewData, MonthlyFinancials, MonthlyFunVsCourseRevenue, NationalityCount } from "./data";
import { EXCESS_LABEL, EXCESS_HINT } from "@/lib/payments";
import { MonthlyBarChart, MonthlyLineChart, SimplePieChart } from "./charts";

const NATIONALITY_COLORS = [
  "var(--navy)",
  "var(--teal)",
  "var(--orange)",
  "var(--green)",
  "var(--navy-mid)",
  "var(--teal-mid)",
];

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

export function OverviewTab({
  data,
  dateFromLabel,
  dateToLabel,
  monthlyFinancials,
  monthlyFunVsCourse,
  nationalitiesYTD,
}: {
  data: OverviewData;
  dateFromLabel: string;
  dateToLabel: string;
  monthlyFinancials: MonthlyFinancials[];
  monthlyFunVsCourse: MonthlyFunVsCourseRevenue[];
  nationalitiesYTD: NationalityCount[];
}) {
  const { summary } = data;

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
          <strong className="text-white">{data.daysServed}</strong> day
          {data.daysServed !== 1 ? "s" : ""}, and made{" "}
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
            {summary.excessCollected > 0 && (
              <div className="flex justify-between py-2 pl-4 text-xs text-gray-400 italic" title={EXCESS_HINT}>
                <span>{EXCESS_LABEL} — not counted above</span>
                <span>{peso(summary.excessCollected)}</span>
              </div>
            )}
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

      {/* The four charts below are all independent of the date-range filter
          above — they compute their own trailing-12-month / year-to-date
          window (see loadMonthlyFinancials et al. in data.ts) so they stay
          stable while the KPI cards/Business Summary respond to the filter. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Monthly Revenue vs Expenses</div>
            <div className="text-xs text-gray-500 mt-0.5">Gross revenue vs. total expenses, last 12 months.</div>
          </div>
          <div className="p-5">
            <MonthlyBarChart
              data={monthlyFinancials}
              series={[
                { key: "revenue", label: "Revenue", color: "var(--teal)" },
                { key: "expenses", label: "Expenses", color: "var(--orange)" },
              ]}
              formatValue={peso}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Fun Diving vs Dive Course Revenue</div>
            <div className="text-xs text-gray-500 mt-0.5">Gross revenue by activity type, last 12 months.</div>
          </div>
          <div className="p-5">
            <MonthlyBarChart
              data={monthlyFunVsCourse}
              series={[
                { key: "funRevenue", label: "Fun Diving", color: "var(--teal)" },
                { key: "courseRevenue", label: "Dive Course", color: "var(--navy)" },
              ]}
              formatValue={peso}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Monthly Financial Trend</div>
            <div className="text-xs text-gray-500 mt-0.5">Revenue, expenses, and profit, last 12 months.</div>
          </div>
          <div className="p-5">
            <MonthlyLineChart
              data={monthlyFinancials}
              series={[
                { key: "revenue", label: "Revenue", color: "var(--teal)" },
                { key: "expenses", label: "Expenses", color: "var(--orange)" },
                { key: "profit", label: "Profit", color: "var(--navy)" },
              ]}
              formatValue={peso}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-sm font-extrabold text-navy">Top 5 Diver Nationalities</div>
            <div className="text-xs text-gray-500 mt-0.5">Year to date.</div>
          </div>
          <div className="p-5 min-w-0 overflow-hidden">
            <SimplePieChart
              data={nationalitiesYTD.map((n) => ({ label: n.nationality, value: n.count }))}
              colors={NATIONALITY_COLORS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
