import ExcelJS from "exceljs";
import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";
import { requireApiEmployee } from "@/lib/auth/api";
import { loadLeaveBalances } from "@/lib/leave/balance-data";
import type { LeaveBalanceData } from "@/lib/leave/balance-data";
import { reportingPeriod } from "@/lib/leave/balance";
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
        .from("leave_balance_closings")
        .select("snapshot")
        .eq("period_month", month)
        .maybeSingle();
      if (error || !data)
        return new Response("마감본을 찾을 수 없습니다.", { status: 404 });
      const snapshot = data.snapshot as {
        rows: LeaveBalanceData["rows"];
        today: string;
      };
      rows = snapshot.rows;
      asOf = snapshot.today;
    } else {
      const data = await loadLeaveBalances(month);
      rows = data.rows;
      asOf = data.today;
      if (!data.ready)
        return new Response("연차 관리 설정을 먼저 완료해 주세요.", {
          status: 409,
        });
    }
    const period = reportingPeriod(month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "파스텔크래프트";
    const summary = workbook.addWorksheet("연차 사용대장");
    summary.addRow([
      `${month} 연차 사용대장 (${closed ? "마감본" : "현재 조회본"})`,
    ]);
    summary.addRow([
      `집계: ${period.start} ~ ${period.end} / 조회 기준: ${asOf}`,
    ]);
    summary.addRow([
      "직원",
      "부서",
      "입사일",
      "기초 잔액",
      "기간 발생",
      "기간 사용",
      "기간 조정",
      "기말 잔액",
      "현재 잔여",
      "사용 예정",
      "추가 사용 가능",
      "승인 대기",
      "확인 사항",
    ]);
    for (const row of rows)
      summary.addRow([
        row.name,
        row.departmentLabel,
        row.hire_date,
        row.result?.period.opening ?? null,
        row.result?.period.added ?? null,
        row.result?.period.used ?? null,
        row.result?.period.adjusted ?? null,
        row.result?.period.closing ?? null,
        row.result?.current ?? null,
        row.result?.reserved ?? null,
        row.result?.available ?? null,
        row.result?.pending ?? null,
        row.issue ??
          (!row.result?.period.covered
            ? "이관 이전 기간 포함 · 기초/기말 미확정"
            : ""),
      ]);
    const detail = workbook.addWorksheet("기간 상세 내역");
    detail.addRow(["직원", "부서", "일자", "내용", "증감 일수", "기록 번호"]);
    for (const row of rows)
      for (const m of row.result?.period.movements ?? [])
        detail.addRow([
          row.name,
          row.departmentLabel,
          m.date,
          m.label,
          m.days,
          m.source,
        ]);
    const notes = workbook.addWorksheet("집계 기준");
    notes.addRow(["집계 기간", `${period.start} ~ ${period.end}`]);
    notes.addRow([
      "잔액",
      "기초 잔액 + 기간 발생 - 기간 사용 + 기간 조정 = 기말 잔액",
    ]);
    notes.addRow([
      "사용일",
      "승인 완료된 연차를 실제 사용 날짜별로 집계합니다. 미래 휴가는 사용 예정으로 구분합니다.",
    ]);
    notes.addRow([
      "미확정",
      "빈 잔액은 0일이 아닙니다. 초기 잔액 미확정 또는 이관 이전 기간을 포함한 경우입니다.",
    ]);
    notes.addRow([
      "마이너스",
      "초과 사용 또는 예약된 선사용분이며 무단결근을 뜻하지 않습니다.",
    ]);
    notes.addRow([
      "마감",
      closed
        ? "마감 당시 보관된 내용입니다."
        : "조회 시점 기준입니다. 마감 이후 변경은 마감본과 비교하세요.",
    ]);
    for (const sheet of workbook.worksheets) {
      sheet.views = [{ state: "frozen", ySplit: sheet === summary ? 3 : 1 }];
      sheet.columns.forEach((column, index) => {
        column.width =
          index === 0 ? 18 : index === 3 && sheet === detail ? 55 : 22;
      });
      sheet.eachRow((row) => {
        row.height = 26;
        row.eachCell((cell) => {
          cell.font = {
            name: "맑은 고딕",
            size: 11,
            ...(typeof cell.value === "number" && cell.value < 0
              ? { color: { argb: "FFC62828" } }
              : {}),
          };
          cell.alignment = { vertical: "middle", wrapText: true };
          if (typeof cell.value === "number") cell.numFmt = "0.##";
        });
      });
      const header = sheet.getRow(sheet === summary ? 3 : 1);
      header.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDDEEE2" },
        };
        cell.font = { name: "맑은 고딕", size: 11, bold: true };
      });
      sheet.pageSetup = {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };
    }
    summary.autoFilter = { from: "A3", to: "M3" };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=leave-${month}-${closed ? "closed" : "live"}.xlsx`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response(
      "엑셀을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      { status: 503 },
    );
  }
}
