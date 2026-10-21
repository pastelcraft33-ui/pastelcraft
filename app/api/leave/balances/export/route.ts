import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";
import { requireApiEmployee } from "@/lib/auth/api";
import { loadLeaveBalances, type LeaveBalanceData } from "@/lib/leave/balance-data";
import { buildLeaveWorkbook } from "@/lib/leave/export-workbook";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canViewAllLeaveBalances(auth.employee))
    return new Response("연차 관리 조회 권한이 필요합니다.", { status: 403 });
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? "";
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    return new Response("집계 월을 확인해 주세요.", { status: 400 });
  const closed = params.get("source") === "closing";
  try {
    let rows: LeaveBalanceData["rows"];
    let asOf: string;
    if (closed) {
      const { data, error } = await createAdminClient()
        .from("leave_balance_closings").select("snapshot").eq("period_month", month).maybeSingle();
      if (error || !data) return new Response("마감본을 찾을 수 없습니다.", { status: 404 });
      const snapshot = data.snapshot as { rows: LeaveBalanceData["rows"]; today: string };
      rows = snapshot.rows;
      asOf = snapshot.today;
    } else {
      const data = await loadLeaveBalances(month);
      rows = data.rows;
      asOf = data.today;
      if (!data.ready) return new Response("연차 관리 설정을 먼저 완료해 주세요.", { status: 409 });
    }
    const workbook = buildLeaveWorkbook(rows, asOf, month, closed);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=leave-${month}-${closed ? "closed" : "live"}.xlsx`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("엑셀을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.", { status: 503 });
  }
}
