export const leaveTypeOptions = [
  { value: "annual", label: "연차" },
  { value: "morning_half", label: "오전 반차" },
  { value: "afternoon_half", label: "오후 반차" },
  { value: "morning_quarter", label: "오전 반반차" },
  { value: "afternoon_quarter", label: "오후 반반차" },
  { value: "sick", label: "병가" },
  { value: "bereavement", label: "경조사" },
  { value: "official", label: "공가" },
  { value: "other", label: "기타" },
] as const;

export const leaveTypeValues = leaveTypeOptions.map(
  (option) => option.value,
) as [
  "annual",
  "morning_half",
  "afternoon_half",
  "morning_quarter",
  "afternoon_quarter",
  "sick",
  "bereavement",
  "official",
  "other",
];

export const leaveDayTypeOptions = [
  { value: "full_day", label: "전일" },
  { value: "morning_half", label: "오전 반차" },
  { value: "afternoon_half", label: "오후 반차" },
  { value: "morning_quarter", label: "오전 반반차" },
  { value: "afternoon_quarter", label: "오후 반반차" },
] as const;

export const leaveDayTypeValues = leaveDayTypeOptions.map(
  (option) => option.value,
) as [
  "full_day",
  "morning_half",
  "afternoon_half",
  "morning_quarter",
  "afternoon_quarter",
];

export function leaveTypeLabel(value: string) {
  return leaveTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function leaveDayTypeLabel(value: string) {
  return leaveDayTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function leaveCalendarTitle(employeeName: string, dayType: string) {
  return `${employeeName} · ${leaveDayTypeLabel(dayType)}`;
}

// Legacy half/quarter types must not lock the now unit-only edit form to one unit.
// Preserve non-annual historical categories so editing a reason cannot change deduction policy.
export function leaveTypeForUnitForm(value: (typeof leaveTypeValues)[number]) {
  return value.endsWith("_half") || value.endsWith("_quarter") ? "annual" : value;
}

export function leaveProgressLabel({
  status,
  teamLeadStatus,
  representativeStatus,
}: {
  status: string;
  teamLeadStatus: string;
  representativeStatus: string;
}) {
  if (status === "approved") return "승인 완료";
  if (status === "rejected") return "반려";
  if (status === "cancelled") return "취소";
  if (teamLeadStatus === "approved" && representativeStatus === "pending") {
    return "대표자 승인 대기";
  }
  return "팀장 승인 대기";
}
