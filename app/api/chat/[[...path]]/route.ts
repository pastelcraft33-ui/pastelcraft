// Retired endpoints never read messages, sign attachment URLs, or mutate chat data.
function retired() {
  return Response.json(
    { message: "메신저 기능이 종료되었습니다." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = retired;
export const POST = retired;
export const PUT = retired;
export const PATCH = retired;
export const DELETE = retired;
