import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialLeaveAccount, ensureInitialLeaveAccount } from "../lib/leave/initialize-account";
test("남대문 신규 초기 설정은 10월 25일 발생분까지 포함", () => {
  const account = initialLeaveAccount("nam", "2026-08-20", "admin", "namdaemun");
  assert.equal(account.opening_date,"2026-10-25");
  assert.equal(account.opening_days,2);
  assert.equal(initialLeaveAccount("web", "2026-08-20", "admin", "web").opening_days,1);
});
import { calculateBalance } from "../lib/leave/balance";

test("구교환은 입사일 등록·변경·재저장 시 자동 생성에서 계속 제외", async () => {
  const db = { from: () => { assert.fail("제외 직원은 DB 쓰기를 시도하면 안 됩니다."); } } as unknown as SupabaseClient;
  for (const date of ["2026-10-13", "2026-08-01", "2025-01-01", null, "2026-10-13"]) {
    assert.equal(await ensureInitialLeaveAccount(db, "47976346-153e-4778-acb4-6c0af45cabc9", date, "admin"), false);
  }
});

test("양승환: 10월 15일 기초 1일, 다음 입사기념 월일에 추가 부여", () => {
  const account = initialLeaveAccount("yang", "2026-08-27", "admin");
  const result = calculateBalance(account, "2026-08-27", [], [], new Set(), "2026-10-22", "2026-11");
  assert.equal(account.opening_days, 1);
  assert.equal(result.current, 1);
  assert.equal(result.yearUsed, 0);
  assert.equal(result.nextAccrual, "2026-10-27");
  assert.equal(calculateBalance(account, "2026-08-27", [], [], new Set(), "2026-10-27", "2026-11").current, 2);
});

test("이관 이후 입사자는 0일로 시작하고 첫 한 달 후 1일 발생", () => {
  const account = initialLeaveAccount("new", "2026-10-19", "admin");
  assert.equal(account.opening_date, "2026-10-19");
  assert.equal(account.opening_days, 0);
  assert.equal(calculateBalance(account, "2026-10-19", [], [], new Set(), "2026-10-22", "2026-11").notYetAccrued, true);
  assert.equal(calculateBalance(account, "2026-10-19", [], [], new Set(), "2026-11-19", "2026-12").current, 1);
});

test("1년 이상 초기 부여 및 잘못된 날짜 거부", () => {
  assert.equal(initialLeaveAccount("old", "2025-01-01", "admin").opening_days, 15);
  assert.throws(() => initialLeaveAccount("bad", "2026-02-30", "admin"));
});

test("초기 설정 재요청은 기존 잔액 보존, 빈 입사일은 생성하지 않음", async () => {
  const saved = new Map<string, unknown>([["existing", { opening_days: -2 }]]);
  const db = { from: (table: string) => {
    assert.equal(table, "leave_balance_accounts");
    return { upsert: (row: ReturnType<typeof initialLeaveAccount>, options: unknown) => {
      assert.deepEqual(options, { onConflict: "employee_id", ignoreDuplicates: true });
      const existed = saved.has(row.employee_id);
      if (!existed) saved.set(row.employee_id, row);
      return { select: async () => ({ data: existed ? [] : [{ employee_id: row.employee_id }], error: null }) };
    } };
  } } as unknown as SupabaseClient;
  assert.equal(await ensureInitialLeaveAccount(db, "empty", null, "admin"), false);
  assert.equal(await ensureInitialLeaveAccount(db, "existing", "2026-08-01", "admin"), false);
  assert.deepEqual(saved.get("existing"), { opening_days: -2 });
  assert.equal(await ensureInitialLeaveAccount(db, "new", "2026-08-01", "admin"), true);
  assert.equal(await ensureInitialLeaveAccount(db, "new", "2026-08-01", "admin"), false);
  assert.equal(saved.size, 2);
});
