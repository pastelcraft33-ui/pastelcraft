import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentEmployee } from "../lib/auth/session";
import {
  canReceiveNegativeBalanceAlerts,
  negativeBalanceApplicationData,
  negativeBalanceAlertTitle,
  unreadNegativeBalanceNotifications,
} from "../lib/leave/negative-balance-alert";
import { calculateBalance, type BalanceAccount } from "../lib/leave/balance";

test("신청 당시 현재 잔여 연차가 음수일 때만 알림 스냅샷 생성", () => {
  assert.deepEqual(negativeBalanceApplicationData("직원", -0.25), {
    negative_balance: true, balance_at_application: -0.25, employee_name: "직원",
  });
  for (const value of [0, -0, 1, null, NaN, Infinity, -Infinity]) {
    assert.deepEqual(negativeBalanceApplicationData("직원", value), {});
  }
  assert.equal(negativeBalanceAlertTitle("홍길동"), "잔여연차 마이너스 홍길동님이 휴가를 신청하였습니다.");
});

test("대표 직급이나 관리자 권한만으로는 부족하고 pastelcraft 대표 계정만 수신", () => {
  const representative = { id: "rep", loginId: "pastelcraft", role: "admin", positionCode: "representative" } as CurrentEmployee;
  assert.equal(canReceiveNegativeBalanceAlerts(representative), true);
  assert.equal(canReceiveNegativeBalanceAlerts({ ...representative, loginId: "other" }), false);
  assert.equal(canReceiveNegativeBalanceAlerts({ ...representative, positionCode: "team_lead" }), false);
  assert.equal(canReceiveNegativeBalanceAlerts({ ...representative, role: "employee" }), false);
});

test("로그아웃 동안 쌓인 알림도 보존하고 확인한 알림과 잘못된 스냅샷만 제외", () => {
  const data = { ...negativeBalanceApplicationData("홍길동", -1), start_date: "2026-11-10", end_date: "2026-11-10" };
  const applications = [
    { id: "new", created_at: "2026-11-09T01:00:00Z", changed_data: data },
    { id: "read", created_at: "2026-11-08T01:00:00Z", changed_data: data },
    { id: "old-unread", created_at: "2026-10-01T01:00:00Z", changed_data: data },
    { id: "bad", created_at: "2026-11-09T01:00:00Z", changed_data: { ...data, balance_at_application: 0 } },
    { id: "unflagged", created_at: "2026-11-09T01:00:00Z", changed_data: {} },
  ];
  const items = unreadNegativeBalanceNotifications(applications, new Set(["read"]));
  assert.deepEqual(items.map(item => item.id), ["negative-balance:new", "negative-balance:old-unread"]);
  assert.equal(items[0].title, "잔여연차 마이너스 홍길동님이 휴가를 신청하였습니다.");
  assert.match(items[0].description, /신청 당시 잔여 -1일/);
  assert.equal(items[0].href, "/admin/leave");
});

test("승인된 실제 선사용 잔여를 판단하되 미래 예약만 음수인 경우 경고하지 않음", () => {
  const account: BalanceAccount = { employee_id: "a", opening_date: "2026-10-15", opening_days: 0, monthly_enabled: false, work_days: [0,1,2,3,4,5,6], exclude_holidays: false };
  const leave = { id: "leave", employee_id: "a", start_date: "2026-11-08", end_date: "2026-11-08", status: "approved", leave_type: "annual", day_type: "full_day" };
  const result = calculateBalance(account, "2022-01-01", [], [leave], new Set(), "2026-11-09", "2026-11");
  assert.equal(result.current, -1);
  assert.equal(negativeBalanceApplicationData("직원", result.current).negative_balance, true);
  const future = calculateBalance(account, "2022-01-01", [], [{ ...leave, start_date: "2026-11-10", end_date: "2026-11-10" }], new Set(), "2026-11-09", "2026-11");
  assert.equal(future.available, -1);
  assert.deepEqual(negativeBalanceApplicationData("직원", future.current), {});
});
