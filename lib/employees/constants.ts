export const positionOptions = [
  { value: "staff", label: "사원" },
  { value: "instructor", label: "강사" },
  { value: "assistant_manager", label: "대리" },
  { value: "section_chief", label: "계장" },
  { value: "manager", label: "과장" },
  { value: "deputy_general_manager", label: "차장" },
  { value: "general_manager", label: "부장" },
  { value: "team_lead", label: "팀장" },
] as const;

export const adminPositionOptions = [
  ...positionOptions,
  { value: "representative", label: "대표" },
] as const;

export const departmentOptions = [
  { value: "web_design", label: "웹디자인팀" },
  { value: "web_marketing", label: "웹마케팅팀" },
  { value: "logistics", label: "물류팀" },
  { value: "namdaemun", label: "남대문팀" },
] as const;

// 기존 웹팀 직원은 관리자가 새 팀으로 배치할 때까지 기존 코드를 유지합니다.
export const legacyDepartmentOptions = [
  { value: "web", label: "웹팀 (분류 전)" },
] as const;

export const allDepartmentOptions = [
  ...departmentOptions,
  ...legacyDepartmentOptions,
] as const;

export type DepartmentCode = (typeof allDepartmentOptions)[number]["value"];

export function departmentGroup(value: string) {
  if (value === "web" || value === "web_design" || value === "web_marketing") {
    return "web";
  }
  return value;
}

export function isSameDepartmentGroup(left: string, right: string) {
  return departmentGroup(left) === departmentGroup(right);
}

export function departmentCodesInSameGroup(value: string) {
  return departmentGroup(value) === "web"
    ? (["web", "web_design", "web_marketing"] as const)
    : [value];
}

export function isDepartmentCode(value: unknown): value is DepartmentCode {
  return allDepartmentOptions.some((option) => option.value === value);
}

export const roleOptions = [
  { value: "employee", label: "일반 직원" },
  { value: "admin", label: "관리자" },
] as const;

export const accountStatusLabels: Record<string, string> = {
  pending: "승인 대기",
  active: "사용 중",
  rejected: "반려",
  suspended: "사용 중지",
};

export function positionLabel(value: string) {
  return adminPositionOptions.find((option) => option.value === value)?.label ?? value;
}

export function departmentLabel(value: string) {
  return allDepartmentOptions.find((option) => option.value === value)?.label ?? value;
}

export function roleLabel(value: string) {
  return roleOptions.find((option) => option.value === value)?.label ?? value;
}
