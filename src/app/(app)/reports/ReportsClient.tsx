"use client";

import { useState, useTransition } from "react";
import {
  getOverviewData,
  getMonthlyFinancials,
  getStaffActivityData,
  getJoinRideData,
  getRentalGearsData,
  getExpensesData,
  getSettlementData,
  getGovtFeesData,
  getBillingAuditData,
} from "./actions";
import { exportRawData } from "./rawExport";
import { OverviewTab } from "./OverviewTab";
import { StaffTab } from "./StaffTab";
import { JoinRideTab } from "./JoinRideTab";
import { RentalGearsTab } from "./RentalGearsTab";
import { ExpensesTab } from "./ExpensesTab";
import { SettlementTab } from "./SettlementTab";
import { GovtFeesTab } from "./GovtFeesTab";
import { BillingAuditTab } from "./BillingAuditTab";
import type {
  OverviewData,
  MonthlyFinancials,
  MonthlyFunVsCourseRevenue,
  NationalityCount,
  StaffActivityData,
  JoinRideData,
  RentalGearsData,
  ExpensesData,
  SettlementData,
  GovtFeesData,
  BillingAuditData,
} from "./data";

function todayManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const TABS = [
  {
    key: "overview",
    label: "Overview",
    description: "Your business at a glance — money in, money out, net profit, and what's still owed.",
  },
  {
    key: "staff",
    label: "Staff Activity Summary",
    description:
      "Automatic dive-count pay for your team, plus a place to log and mark paid course-instructor payouts.",
  },
  {
    key: "join",
    label: "Join Ride",
    description:
      "Track divers riding on someone else's boat, or guests riding on yours — who owes what, either direction.",
  },
  {
    key: "rentals",
    label: "Rental Gears",
    description: "Gear rented out or borrowed in — what's been collected, what's still to pay.",
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Every cost logged for this dive center, organized by category, with who recorded it.",
  },
  {
    key: "settlement",
    label: "Settlement",
    description: "A single day's cash drawer — every payment collected, ready to print or export for reconciliation.",
  },
  {
    key: "govtfees",
    label: "Government Fees",
    description: "Marine, shark, and other government fees collected per diver — log today's here.",
  },
  {
    key: "audit",
    label: "Billing Audit",
    description:
      "A record of every invoice sent and every bill unlock, so you can trace exactly what changed and when.",
  },
] as const;

function formatLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function ReportsClient({
  initialDateFrom,
  initialDateTo,
  initialOverview,
  initialMonthlyFinancials,
  initialMonthlyFunVsCourse,
  initialNationalitiesYTD,
  currentUserName,
}: {
  initialDateFrom: string;
  initialDateTo: string;
  initialOverview: OverviewData;
  initialMonthlyFinancials: MonthlyFinancials[];
  initialMonthlyFunVsCourse: MonthlyFunVsCourseRevenue[];
  initialNationalitiesYTD: NationalityCount[];
  currentUserName: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [appliedFrom, setAppliedFrom] = useState(initialDateFrom);
  const [appliedTo, setAppliedTo] = useState(initialDateTo);
  const [overview, setOverview] = useState(initialOverview);
  // Monthly/YTD charts are independent of the date-range filter above, so
  // they're never refetched by applyDateRange — only by refreshOverview,
  // when a Staff/Join Ride/Rental Gear mutation could have moved a figure
  // that feeds them (monthlyFunVsCourse and nationalitiesYTD don't read
  // from any of those three tables, so they never need refreshing here).
  const [monthlyFinancials, setMonthlyFinancials] = useState(initialMonthlyFinancials);
  const [monthlyFunVsCourse] = useState(initialMonthlyFunVsCourse);
  const [nationalitiesYTD] = useState(initialNationalitiesYTD);
  const [staffData, setStaffData] = useState<StaffActivityData | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [joinData, setJoinData] = useState<JoinRideData | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [rentalData, setRentalData] = useState<RentalGearsData | null>(null);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [expensesData, setExpensesData] = useState<ExpensesData | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [govtFeesData, setGovtFeesData] = useState<GovtFeesData | null>(null);
  const [govtFeesLoading, setGovtFeesLoading] = useState(false);
  const [auditData, setAuditData] = useState<BillingAuditData | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  async function exportRaw() {
    setError(null);
    setExporting(true);
    try {
      const res = await exportRawData(appliedFrom, appliedTo);
      if (res.error || !res.base64) {
        setError(res.error ?? "Could not build the export.");
        return;
      }
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? "aquadesk-raw-export.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function applyDateRange() {
    if (!dateFrom || !dateTo) {
      setError("Please select both From and To dates.");
      return;
    }
    if (dateFrom > dateTo) {
      setError("From date must be before or equal to To date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      // Fetch everything first, then apply every setState together in one
      // synchronous batch at the end — StaffTab/ExpensesTab/GovtFeesTab
      // remount on a `key` tied to appliedFrom/appliedTo, so if
      // setAppliedFrom/To ever committed in an earlier batch than
      // setStaffData/setExpensesData/setGovtFeesData, the remount would
      // grab whatever those still held (stale, since the fresh fetch
      // hadn't resolved yet) and the later state update would land on an
      // already-initialized instance's ignored initial value.
      const [overviewResult, staffResult, expensesResult, govtFeesResult] = await Promise.all([
        getOverviewData(dateFrom, dateTo),
        staffData ? getStaffActivityData(dateFrom, dateTo) : Promise.resolve(null),
        expensesData ? getExpensesData(dateFrom, dateTo) : Promise.resolve(null),
        govtFeesData ? getGovtFeesData(dateFrom, dateTo) : Promise.resolve(null),
      ]);
      setOverview(overviewResult);
      if (staffResult) setStaffData(staffResult);
      if (expensesResult) setExpensesData(expensesResult);
      if (govtFeesResult) setGovtFeesData(govtFeesResult);
      setAppliedFrom(dateFrom);
      setAppliedTo(dateTo);
    });
  }

  // Passed to StaffTab/JoinRideTab/RentalGearsTab, called after any
  // mutation that could change Overview's Money In/Out or Not Yet Settled
  // figures — Overview stays mounted (never unmounted on tab switch), so
  // without this it would only pick up the change on the next manual
  // "Apply" of the date range. Also refetches monthlyFinancials since it
  // sums the same three tables (staff_commission_records/join_ride_records/
  // rental_gear_records) by month.
  async function refreshOverview() {
    const [freshOverview, freshMonthly] = await Promise.all([
      getOverviewData(appliedFrom, appliedTo),
      getMonthlyFinancials(),
    ]);
    setOverview(freshOverview);
    setMonthlyFinancials(freshMonthly);
  }

  function selectTab(key: (typeof TABS)[number]["key"]) {
    setTab(key);
    if (key === "staff" && !staffData && !staffLoading) {
      setStaffLoading(true);
      getStaffActivityData(appliedFrom, appliedTo)
        .then(setStaffData)
        .finally(() => setStaffLoading(false));
    }
    if (key === "join" && !joinData && !joinLoading) {
      setJoinLoading(true);
      getJoinRideData()
        .then(setJoinData)
        .finally(() => setJoinLoading(false));
    }
    if (key === "rentals" && !rentalData && !rentalLoading) {
      setRentalLoading(true);
      getRentalGearsData()
        .then(setRentalData)
        .finally(() => setRentalLoading(false));
    }
    if (key === "expenses" && !expensesData && !expensesLoading) {
      setExpensesLoading(true);
      getExpensesData(appliedFrom, appliedTo)
        .then(setExpensesData)
        .finally(() => setExpensesLoading(false));
    }
    if (key === "settlement" && !settlementData && !settlementLoading) {
      setSettlementLoading(true);
      getSettlementData(todayManila())
        .then(setSettlementData)
        .finally(() => setSettlementLoading(false));
    }
    if (key === "govtfees" && !govtFeesData && !govtFeesLoading) {
      setGovtFeesLoading(true);
      getGovtFeesData(appliedFrom, appliedTo)
        .then(setGovtFeesData)
        .finally(() => setGovtFeesLoading(false));
    }
    if (key === "audit" && !auditData && !auditLoading) {
      setAuditLoading(true);
      getBillingAuditData()
        .then(setAuditData)
        .finally(() => setAuditLoading(false));
    }
  }

  return (
    <div>
      <div className="print:hidden flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-navy mb-1">Reports</h1>
          <p className="text-gray-600 text-sm">
            Your dive center story, staff activity, government fees, join rides, and rentals.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <label className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={applyDateRange}
            disabled={pending}
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-60"
          >
            {pending ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>
      {error && <div className="print:hidden mb-4 text-sm text-red">{error}</div>}

      <div className="print:hidden flex gap-1.5 flex-wrap bg-white border border-gray-200 rounded-2xl p-1.5 mb-5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              tab === t.key ? "bg-navy text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="print:hidden text-gray-600 text-sm mb-5 -mt-3">
        {TABS.find((t) => t.key === tab)?.description}
      </p>

      {/*
        Tabs with their own client-side state (Staff, Join Ride, Rental
        Gears, Expenses) stay mounted once loaded instead of being
        conditionally unmounted on tab switch — their mutation handlers
        patch local state directly rather than round-tripping through this
        parent's staffData/joinData/etc, so an unmount+remount on tab
        switch would silently revert to whatever snapshot was last fetched
        here, discarding anything saved since. Visibility is toggled with
        `hidden` instead.
      */}
      <div className={tab === "overview" ? "print:hidden" : "hidden"}>
        <OverviewTab
          data={overview}
          dateFromLabel={formatLabel(appliedFrom)}
          dateToLabel={formatLabel(appliedTo)}
          monthlyFinancials={monthlyFinancials}
          monthlyFunVsCourse={monthlyFunVsCourse}
          nationalitiesYTD={nationalitiesYTD}
          onExportRaw={exportRaw}
          exporting={exporting}
        />
      </div>

      <div className={tab === "staff" ? "print:hidden" : "hidden"}>
        {staffData ? (
          <StaffTab key={`${appliedFrom}|${appliedTo}`} data={staffData} refreshOverview={refreshOverview} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {staffLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "join" ? "" : "hidden"}>
        {joinData ? (
          <JoinRideTab
            data={joinData}
            appliedFrom={appliedFrom}
            appliedTo={appliedTo}
            currentUserName={currentUserName}
            refreshOverview={refreshOverview}
          />
        ) : (
          <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {joinLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "rentals" ? "print:hidden" : "hidden"}>
        {rentalData ? (
          <RentalGearsTab
            data={rentalData}
            appliedFrom={appliedFrom}
            appliedTo={appliedTo}
            refreshOverview={refreshOverview}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {rentalLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "expenses" ? "print:hidden" : "hidden"}>
        {expensesData ? (
          <ExpensesTab key={`${appliedFrom}|${appliedTo}`} data={expensesData} appliedFrom={appliedFrom} appliedTo={appliedTo} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {expensesLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "settlement" ? "" : "hidden"}>
        {settlementData ? (
          <SettlementTab data={settlementData} />
        ) : (
          <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {settlementLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "govtfees" ? "print:hidden" : "hidden"}>
        {govtFeesData ? (
          <GovtFeesTab
            key={`${appliedFrom}|${appliedTo}`}
            data={govtFeesData}
            appliedFrom={appliedFrom}
            appliedTo={appliedTo}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {govtFeesLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "audit" ? "" : "hidden"}>
        {auditData ? (
          <BillingAuditTab data={auditData} />
        ) : (
          <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {auditLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>
    </div>
  );
}
