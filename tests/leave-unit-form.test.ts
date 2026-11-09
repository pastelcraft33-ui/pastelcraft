import test from "node:test";
import assert from "node:assert/strict";
import { leaveCalendarTitle, leaveDayTypeOptions, leaveTypeForUnitForm } from "../lib/leave/constants";
import { leaveFormSchema, leaveInputFromFormData } from "../schemas/leave";
import { leaveUnits } from "../lib/leave/balance";

test("휴가 종류 선택 없이 단위만 보내도 새 연차 신청 검증 통과", () => {
  for (const option of leaveDayTypeOptions) {
    const form = new FormData();
    form.set("startDate", "2026-11-10");
    form.set("endDate", "2026-11-10");
    form.set("dayType", option.value);
    form.set("reason", "개인 사유");
    const result = leaveFormSchema.safeParse(leaveInputFromFormData(form));
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.leaveType, "annual");
      assert.equal(result.data.dayType, option.value);
      assert.equal(leaveUnits(result.data.dayType), option.value === "full_day" ? 1 : option.value.includes("quarter") ? 0.25 : 0.5);
    }
  }
});

test("기존 오전 반차도 오후 반반차로 수정 가능하며 병가 등 과거 분류는 보존", () => {
  assert.equal(leaveTypeForUnitForm("morning_half"), "annual");
  assert.equal(leaveTypeForUnitForm("afternoon_quarter"), "annual");
  for (const type of ["sick", "bereavement", "official", "other"] as const) assert.equal(leaveTypeForUnitForm(type), type);
  const result = leaveFormSchema.safeParse({ leaveType: leaveTypeForUnitForm("morning_half"), startDate: "2026-11-10", endDate: "2026-11-10", dayType: "afternoon_quarter", reason: "개인 사유", handoverNote: "" });
  assert.equal(result.success, true);
});

test("캘린더 제목은 휴가 종류가 아닌 실제 단위를 표시", () => {
  for (const option of leaveDayTypeOptions) {
    assert.equal(leaveCalendarTitle("홍길동", option.value), `홍길동 · ${option.label}`);
  }
});

test("휴가 종류를 생략해도 잘못된 단위와 여러 날짜 반차는 거부", () => {
  const form = new FormData();
  form.set("startDate", "2026-11-10"); form.set("endDate", "2026-11-11");
  form.set("reason", "개인 사유"); form.set("dayType", "morning_half");
  assert.equal(leaveFormSchema.safeParse(leaveInputFromFormData(form)).success, false);
  form.set("dayType", "invalid");
  assert.equal(leaveFormSchema.safeParse(leaveInputFromFormData(form)).success, false);
});
