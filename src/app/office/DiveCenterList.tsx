import { updateSubscriptionStatus } from "@/lib/actions/office";

type DiveCenter = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subscription_status: "trial" | "active" | "suspended" | "cancelled";
  created_at: string;
};

const STATUS_STYLES: Record<DiveCenter["subscription_status"], string> = {
  trial: "bg-teal-light text-teal-mid",
  active: "bg-green-light text-green",
  suspended: "bg-orange-light text-orange",
  cancelled: "bg-red-light text-red",
};

export function DiveCenterList({ diveCenters }: { diveCenters: DiveCenter[] }) {
  if (diveCenters.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card border border-gray-200 p-8 text-center text-gray-400 text-sm">
        No dive centers yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-gray-600 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {diveCenters.map((dc) => (
            <tr key={dc.id} className="border-t border-gray-200">
              <td className="px-4 py-3 font-medium text-navy">{dc.name}</td>
              <td className="px-4 py-3 text-gray-600">
                {dc.email ?? "—"}
                {dc.phone ? ` · ${dc.phone}` : ""}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[dc.subscription_status]}`}
                >
                  {dc.subscription_status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {dc.subscription_status !== "active" && (
                    <form
                      action={updateSubscriptionStatus.bind(null, dc.id, "active")}
                    >
                      <button className="text-teal-mid hover:underline text-xs font-medium">
                        Activate
                      </button>
                    </form>
                  )}
                  {dc.subscription_status !== "suspended" && (
                    <form
                      action={updateSubscriptionStatus.bind(null, dc.id, "suspended")}
                    >
                      <button className="text-orange hover:underline text-xs font-medium">
                        Suspend
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
