import { leaveDayTypeLabel } from "./constants";

export function matchesLeaveApprovalSearch(
  request: { applicant: { name: string; department: string }; dayType: string },
  search: string,
) {
  const keyword = search.trim().toLowerCase();
  return !keyword || [request.applicant.name, request.applicant.department, leaveDayTypeLabel(request.dayType)]
    .some(value => value.toLowerCase().includes(keyword));
}
