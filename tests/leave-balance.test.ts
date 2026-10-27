import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  calculateBalance,
  currentReportingMonth,
  reportingPeriod,
  validDate,
  type BalanceAccount,
  type BalanceLeave,
} from "../lib/leave/balance";
const account: BalanceAccount = {
  employee_id: "a",
  opening_date: "2026-10-15",
  opening_days: 0,
  monthly_enabled: true,
  work_days: [1, 2, 3, 4, 5],
  exclude_holidays: true,
};
const leave = (changes: Partial<BalanceLeave> = {}): BalanceLeave => ({
  id: "l1",
  employee_id: "a",
  start_date: "2026-10-16",
  end_date: "2026-10-16",
  status: "approved",
  leave_type: "annual",
  day_type: "full_day",
  ...changes,
});
test("남대문 26~25일 집계와 25일 이관 경계", () => {
  assert.deepEqual(reportingPeriod("2026-01", "namdaemun"), {start:"2025-12-26",end:"2026-01-25"});
  assert.equal(currentReportingMonth("2026-10-25", "namdaemun"), "2026-10");
  assert.equal(currentReportingMonth("2026-10-26", "namdaemun"), "2026-11");
  const result = calculateBalance({...account,opening_date:"2026-10-25",opening_days:5,monthly_enabled:false,work_days:[0,1,2,3,4,5,6]}, "2022-05-01", [], [
    leave({id:"old",start_date:"2026-10-24",end_date:"2026-10-25"}),
    leave({id:"new",start_date:"2026-10-26",end_date:"2026-10-26"}),
  ], new Set(), "2026-10-27", "2026-11", "namdaemun");
  assert.equal(result.current, 4);
  assert.equal(result.period.start,"2026-10-26");
  assert.equal(result.period.used,1);
});
test("16일~15일 집계, 연도 경계 및 올바른 날짜", () => {
  assert.deepEqual(reportingPeriod("2026-01"), {
    start: "2025-12-16",
    end: "2026-01-15",
  });
  assert.equal(currentReportingMonth("2026-10-15"), "2026-10");
  assert.equal(currentReportingMonth("2026-10-16"), "2026-11");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(validDate("2026-02-30"), false);
});
test("잔액 선사용은 음수, 월별 발생은 기준일 이후 해당일부터", () => {
  const result = calculateBalance(
    account,
    "2026-09-20",
    [],
    [leave()],
    new Set(),
    "2026-10-19",
    "2026-11",
  );
  assert.equal(result.current, -1);
  assert.equal(result.nextAccrual, "2026-10-20");
  assert.equal(
    calculateBalance(
      account,
      "2026-09-20",
      [],
      [leave()],
      new Set(),
      "2026-10-20",
      "2026-11",
    ).current,
    0,
  );
});
test("이관 이전 사용분 제외, 첫해 월 부여 최대11회", () => {
  const old = leave({ start_date: "2026-10-14", end_date: "2026-10-15" });
  const result = calculateBalance(
    account,
    "2026-09-20",
    [],
    [old],
    new Set(),
    "2027-09-20",
    "2027-09",
  );
  assert.equal(result.current, 11);
  assert.equal(result.nextAccrual, null);
});
test("승인 예정과 대기 분리, 반려/취소/삭제 자동 복구", () => {
  const a = { ...account, opening_days: 3, monthly_enabled: false };
  const future = leave({ start_date: "2026-10-22", end_date: "2026-10-22" });
  const pending = leave({ id: "pending", status: "pending" });
  const result = calculateBalance(
    a,
    "2020-01-01",
    [],
    [
      future,
      pending,
      leave({ id: "cancel", status: "cancelled" }),
      leave({ id: "reject", status: "rejected" }),
    ],
    new Set(),
    "2026-10-21",
    "2026-11",
  );
  assert.equal(result.current, 3);
  assert.equal(result.reserved, 1);
  assert.equal(result.available, 2);
  assert.equal(result.pending, 1);
  assert.equal(
    calculateBalance(
      a,
      "2020-01-01",
      [],
      [],
      new Set(),
      "2026-10-21",
      "2026-11",
    ).available,
    3,
  );
});
test("주말·공휴일 제외 및 반반차, 휴가 종류별 차감", () => {
  const result = calculateBalance(
    { ...account, monthly_enabled: false },
    "2020-01-01",
    [],
    [
      leave({ end_date: "2026-10-20" }),
      leave({
        id: "q",
        start_date: "2026-10-21",
        end_date: "2026-10-21",
        leave_type: "morning_quarter",
        day_type: "morning_quarter",
      }),
      leave({ id: "sick", leave_type: "sick" }),
    ],
    new Set(["2026-10-19"]),
    "2026-10-21",
    "2026-11",
  );
  assert.equal(result.current, -2.25);
});
test("15일/16일에 걸친 사용 분할 및 이관 전 기간은 미확정", () => {
  const a = {
    ...account,
    opening_date: "2026-09-15",
    opening_days: 5,
    monthly_enabled: false,
  };
  const l = leave({ start_date: "2026-10-15", end_date: "2026-10-16" });
  assert.equal(
    calculateBalance(
      a,
      "2020-01-01",
      [],
      [l],
      new Set(),
      "2026-10-21",
      "2026-10",
    ).period.used,
    1,
  );
  const next = calculateBalance(
    a,
    "2020-01-01",
    [],
    [l],
    new Set(),
    "2026-10-21",
    "2026-11",
  ).period;
  assert.equal(next.opening, 4);
  assert.equal(next.used, 1);
  assert.equal(next.closing, 3);
  assert.equal(
    calculateBalance(
      account,
      "2020-01-01",
      [],
      [],
      new Set(),
      "2026-10-21",
      "2026-10",
    ).period.closing,
    null,
  );
});
test("조정 사유가 연차 사용이어도 사용량으로 잘못 분류하지 않음", () => {
  const r = calculateBalance(
    account,
    "2020-01-01",
    [
      {
        id: "e",
        employee_id: "a",
        effective_date: "2026-10-20",
        days: -1,
        kind: "adjustment",
        reason: "연차 사용",
        expires_on: null,
      },
    ],
    [],
    new Set(),
    "2026-10-21",
    "2026-11",
  );
  assert.equal(r.period.used, 0);
  assert.equal(r.period.adjusted, -1);
});
