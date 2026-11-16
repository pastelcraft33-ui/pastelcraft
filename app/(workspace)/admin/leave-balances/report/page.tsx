import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { LeaveBalancePanel } from "@/components/leave/leave-balance-panel";
import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";

export const metadata = { title: "연차보고서" };
export default async function LeaveReportPage() {
  const user = await requireCurrentEmployee();
  if (!canViewAllLeaveBalances(user)) redirect("/calendar");
  return <LeaveBalancePanel admin reportOnly />;
}
