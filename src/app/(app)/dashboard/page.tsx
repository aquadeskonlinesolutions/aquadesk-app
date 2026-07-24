import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { loadDashboardData } from "./data";
import { DiversTable } from "./DiversTable";
import type { Alert, BoatStatus } from "./data";

function peso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString()}`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accent?: "red" | "green" | "orange";
}) {
  const barColor =
    accent === "red"
      ? "bg-red"
      : accent === "green"
        ? "bg-green"
        : accent === "orange"
          ? "bg-orange"
          : "bg-teal";

  return (
    <div className="relative bg-white border border-gray-200 rounded-card shadow-card hover:shadow-card-hover transition-shadow p-6 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${barColor}`} />
      <div className="absolute right-5 top-5 text-2xl opacity-10">{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        {label}
      </div>
      <div className="font-display text-4xl text-navy mb-2 tracking-tight">
        {value}
      </div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}

function BoatsCard({ boats }: { boats: BoatStatus[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-navy">Boats Today</div>
        <div className="text-xs text-gray-400 mt-0.5">Current status</div>
      </div>
      <div className="flex flex-col">
        {boats.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No boats configured yet
          </div>
        ) : (
          boats.map((boat) => (
            <div
              key={boat.id}
              className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  boat.isOut
                    ? "bg-orange shadow-[0_0_0_3px_var(--orange-light)]"
                    : "bg-green shadow-[0_0_0_3px_var(--green-light)]"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-navy">
                  {boat.name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {boat.detail}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-navy">
                  {boat.isOut ? (boat.departureTime ?? "—") : "—"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {boat.tripLabel}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const ALERT_ICON_BG: Record<Alert["type"], string> = {
  warning: "bg-orange-light",
  danger: "bg-red-light",
  info: "bg-teal-light",
  success: "bg-green-light",
};

function AlertsCard({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-navy">Alerts</div>
        <div className="text-xs text-gray-400 mt-0.5">
          Items needing attention
        </div>
      </div>
      <div className="flex flex-col">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className="flex items-start gap-3.5 px-6 py-4 border-b border-gray-100 last:border-0"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${ALERT_ICON_BG[alert.type]}`}
            >
              {alert.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark">
                {alert.title}
              </div>
              <div className="text-xs text-gray-400">{alert.desc}</div>
              {alert.link && (
                <Link
                  href={alert.link}
                  className="inline-block mt-1 text-xs font-bold text-teal hover:underline"
                >
                  {alert.linkText}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentChannelsCard({
  channels,
}: {
  channels: { cash: number; card: number; online: number; total: number };
}) {
  const items = [
    { label: "Cash", value: channels.cash, sub: "PHP equivalent" },
    { label: "Card", value: channels.card, sub: "Includes card surcharge" },
    { label: "Online", value: channels.online, sub: "Includes online surcharge" },
    { label: "Total Today", value: channels.total, sub: "All methods combined" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-navy">
          Today&rsquo;s Payment Channels
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          All money received today — open and closed bills
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-off-white border border-gray-200 rounded-[10px] p-4"
          >
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
              {item.label}
            </div>
            <div className="font-display text-xl text-navy tracking-tight">
              {peso(item.value)}
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-tight">
              {item.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueSummaryCard({
  revenue,
}: {
  revenue: { today: number; week: number; month: number };
}) {
  const items = [
    { label: "Today", value: revenue.today },
    { label: "This Week", value: revenue.week },
    { label: "This Month", value: revenue.month },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-gray-100 border border-gray-200 rounded-[10px] p-4"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
            {item.label}
          </div>
          <div className="font-display text-2xl text-navy tracking-tight">
            {peso(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueChartCard({
  chart,
}: {
  chart: { label: string; amount: number; isToday: boolean }[];
}) {
  const max = Math.max(...chart.map((d) => d.amount), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="text-sm font-semibold text-navy">Weekly Revenue</div>
        <div className="text-xs text-gray-400 mt-0.5">Last 7 days</div>
      </div>
      <div className="p-6">
        <div className="flex items-end gap-2 h-32 px-2">
          {chart.map((day, i) => (
            <div
              key={i}
              className="flex-1 h-full flex flex-col items-center justify-end gap-1.5"
            >
              <div
                title={peso(day.amount)}
                className={`w-full rounded-t min-h-[4px] ${day.isToday ? "bg-navy" : "bg-teal"}`}
                style={{ height: `${Math.max((day.amount / max) * 100, 4)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {chart.map((day, i) => (
            <div
              key={i}
              className={`flex-1 text-center text-xs ${day.isToday ? "text-navy font-semibold" : "text-gray-400"}`}
            >
              {day.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const canViewRevenue = user.role === "owner" || user.canViewRevenue;
  const data = await loadDashboardData(user.diveCenterId, canViewRevenue);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Dashboard</h1>
          <p className="text-gray-600 text-sm">
            Real-time operations overview
          </p>
        </div>
        <Link
          href={`/register?dc=${user.diveCenterId}`}
          className="px-5 py-2.5 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors shrink-0"
        >
          + Register New Diver
        </Link>
      </div>

      {data.hasCriticalAlert && (
        <div className="flex items-center gap-3 bg-orange-light border border-[#FCD34D] rounded-card px-5 py-3.5 mb-6 text-sm text-orange">
          ⚠️{" "}
          <span>
            {data.alerts
              .filter((a) => a.type === "danger")
              .map((a) => a.title)
              .join(" · ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard
          icon="🤿"
          label="Active Divers"
          value={String(data.activeDivers.length)}
          sub="Open visits / checked in"
        />
        <StatCard
          icon="🚤"
          label="Boats Out Today"
          value={String(data.boatsOutCount)}
          sub={
            data.boatsOutCount === 1
              ? "1 boat scheduled today"
              : `${data.boatsOutCount} boats scheduled today`
          }
          accent="orange"
        />
        {data.revenue && (
          <StatCard
            icon="💰"
            label="Revenue Today"
            value={peso(data.revenue.today)}
            sub="PHP — today"
            accent="green"
          />
        )}
        <StatCard
          icon="⚠️"
          label="Pending Bills"
          value={String(data.pendingBillsCount)}
          sub="Unsettled payments"
          accent="red"
        />
      </div>

      {data.revenue && <RevenueSummaryCard revenue={data.revenue} />}

      <PaymentChannelsCard channels={data.paymentChannels} />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 mb-5">
        <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-navy">
                Active Divers
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Checked-in divers with open visits
              </div>
            </div>
            <Link
              href="/divers"
              className="text-sm font-medium text-teal hover:text-navy transition-colors"
            >
              View all →
            </Link>
          </div>
          <DiversTable divers={data.activeDivers} />
        </div>

        <div className="flex flex-col gap-5">
          <BoatsCard boats={data.boats} />
          <AlertsCard alerts={data.alerts} />
        </div>
      </div>

      {data.revenue && <RevenueChartCard chart={data.revenue.chart} />}
    </div>
  );
}
