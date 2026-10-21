/** Company-wide balance visibility does not grant balance mutation rights. */
export function canViewAllLeaveBalances(user: { role: string; positionCode: string }) {
  return user.role === "admin" || user.positionCode === "team_lead" || user.positionCode === "representative";
}
