import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { LeaveBalancePanel } from "@/components/leave/leave-balance-panel";
import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";
import { canManageEmployeeLeave } from "@/lib/leave/permissions";
export const metadata = { title: "전 직원 연차관리" };
export default async function LeaveBalancesPage() {
  const user = await requireCurrentEmployee();
  if (!canViewAllLeaveBalances(user)) redirect("/calendar");
  return <LeaveBalancePanel admin canManage={user.role === "admin"} canManageRequests={canManageEmployeeLeave(user)} />;
}
