"use client";

import { useState, useTransition } from "react";
import {
  getOverviewData,
  getStaffActivityData,
  getJoinRideData,
  getRentalGearsData,
  getExpensesData,
  getSettlementData,
  getGovtFeesData,
} from "./actions";
import { OverviewTab } from "./OverviewTab";
import { StaffTab } from "./StaffTab";
import { JoinRideTab } from "./JoinRideTab";
import { RentalGearsTab } from "./RentalGearsTab";
import { ExpensesTab } from "./ExpensesTab";
import { SettlementTab } from "./SettlementTab";
import { GovtFeesTab } from "./GovtFeesTab";
import type {
  OverviewData,
  StaffActivityData,
  JoinRideData,
  RentalGearsData,
  ExpensesData,
  SettlementData,
  GovtFeesData,
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
  { key: "overview", label: "Overview" },
  { key: "staff", label: "Staff Activity Summary" },
  { key: "join", label: "Join Ride" },
  { key: "rentals", label: "Rental Gears" },
  { key: "expenses", label: "Expenses" },
  { key: "settlement", label: "Settlement" },
  { key: "govtfees", label: "Government Fees" },
  { key: "audit", label: "Billing Audit" },
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
  currentUserName,
}: {
  initialDateFrom: string;
  initialDateTo: string;
  initialOverview: OverviewData;
  currentUserName: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [appliedFrom, setAppliedFrom] = useState(initialDateFrom);
  const [appliedTo, setAppliedTo] = useState(initialDateTo);
  const [overview, setOverview] = useState(initialOverview);
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        />
      </div>

      <div className={tab === "staff" ? "print:hidden" : "hidden"}>
        {staffData ? (
          <StaffTab key={`${appliedFrom}|${appliedTo}`} data={staffData} />
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
          />
        ) : (
          <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {joinLoading ? "Loading…" : "No data yet."}
          </div>
        )}
      </div>

      <div className={tab === "rentals" ? "print:hidden" : "hidden"}>
        {rentalData ? (
          <RentalGearsTab data={rentalData} appliedFrom={appliedFrom} appliedTo={appliedTo} />
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

      {tab !== "overview" &&
        tab !== "staff" &&
        tab !== "join" &&
        tab !== "rentals" &&
        tab !== "expenses" &&
        tab !== "settlement" &&
        tab !== "govtfees" && (
          <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-gray-400 text-sm">
            {TABS.find((t) => t.key === tab)?.label} — not built yet.
          </div>
        )}
    </div>
  );
}
