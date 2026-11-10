import { expect, test } from "@playwright/test";

test("첫 진입은 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "직원 로그인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "직원 등록" })).toBeVisible();
  await expect(page.getByRole("link", { name: "아이디 · 비밀번호 찾기" })).toBeVisible();
});

test("비로그인 사용자는 워크스페이스에 접근할 수 없다", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login/);
});

test("가입 화면의 필수 입력 항목이 표시된다", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByLabel("로그인 아이디")).toBeVisible();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await expect(page.getByLabel("이름", { exact: true })).toBeVisible();
  await expect(page.getByLabel("연락처")).toBeVisible();
  await expect(page.getByLabel("보안 질문")).toBeVisible();
  await expect(page.getByLabel("질문 답변")).toBeVisible();
});

test("아이디·비밀번호 찾기 화면이 표시된다", async ({ page }) => {
  await page.goto("/account-recovery");
  await expect(page.getByRole("heading", { name: "아이디·비밀번호 찾기" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "아이디 찾기" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "비밀번호 재설정" })).toBeVisible();
});

test("비로그인 API 요청은 거부된다", async ({ request }) => {
  for (const path of ["/api/tasks", "/api/notifications"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("종료된 메신저 API는 조회·전송·첨부 다운로드 모두 차단한다", async ({ request }) => {
  const room = "00000000-0000-4000-8000-000000000001";
  for (const path of ["/api/chat", "/api/chat/unread-count", `/api/chat/rooms/${room}/messages`, `/api/chat/attachments/${room}`]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(410);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await request.fetch(`/api/chat/rooms/${room}/messages`, { method });
    expect(response.status(), method).toBe(410);
  }
});
