import { readFile } from "node:fs/promises";
import { requireApiEmployee } from "@/lib/auth/api";
export async function GET() {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (auth.employee.role !== "admin")
    return new Response("관리자만 접근할 수 있습니다.", { status: 403 });
  const sql = await readFile(
    `${process.cwd()}/supabase/migrations/202610210001_leave_balances.sql`,
    "utf8",
  );
  return new Response(sql, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=202610210001_leave_balances.sql",
      "Cache-Control": "private, no-store",
    },
  });
}
