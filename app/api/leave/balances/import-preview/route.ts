import ExcelJS from "exceljs";
import {
  requireApiEmployee,
  hasValidMutationOrigin,
  invalidOriginResponse,
} from "@/lib/auth/api";
import {
  previewLeaveWorkbook,
  validateLedgerArchive,
} from "@/lib/leave/import-preview";
export async function POST(request: Request) {
  if (!hasValidMutationOrigin(request)) return invalidOriginResponse();
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (auth.employee.role !== "admin")
    return Response.json(
      { message: "관리자만 사용할 수 있습니다." },
      { status: 403 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 5 * 1024 * 1024 ||
      file.size === 0 ||
      ![
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
        "",
      ].includes(file.type)
    )
      return Response.json(
        { message: "5MB 이하의 XLSX 파일을 선택해 주세요." },
        { status: 400 },
      );
    const bytes = await file.arrayBuffer();
    if (new Uint8Array(bytes)[0] !== 0x50 || new Uint8Array(bytes)[1] !== 0x4b)
      return Response.json(
        { message: "올바른 XLSX 파일이 아닙니다." },
        { status: 400 },
      );
    validateLedgerArchive(bytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    return Response.json(
      { drafts: previewLeaveWorkbook(workbook), sourceName: file.name },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error && /시트|사용량/.test(error.message)
            ? error.message
            : "대장을 읽지 못했습니다. XLSX 파일을 확인해 주세요.",
      },
      { status: 400 },
    );
  }
}
