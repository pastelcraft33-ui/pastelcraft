export const positionOptions = [
  { value: "staff", label: "사원" },
  { value: "assistant_manager", label: "대리" },
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
  { value: "web", label: "웹팀" },
  { value: "logistics", label: "물류팀" },
  { value: "namdaemun", label: "남대문팀" },
] as const;

export type DepartmentCode = (typeof departmentOptions)[number]["value"];

export function isDepartmentCode(value: unknown): value is DepartmentCode {
  return departmentOptions.some((option) => option.value === value);
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
  return departmentOptions.find((option) => option.value === value)?.label ?? value;
}

export function roleLabel(value: string) {
  return roleOptions.find((option) => option.value === value)?.label ?? value;
}
