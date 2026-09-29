export const DASHBOARD_COMPLETED_RETENTION_DAYS = 30;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function dashboardCompletedCutoff(now = Date.now()) {
  return now - DASHBOARD_COMPLETED_RETENTION_DAYS * DAY_IN_MILLISECONDS;
}

export function isTaskVisibleOnDashboard(
  task: {
    workflowStatus: string;
    completedAt: string | null;
    updatedAt: string;
  },
  now = Date.now(),
) {
  if (task.workflowStatus !== "completed") return true;

  const completedAt = new Date(task.completedAt ?? task.updatedAt).getTime();
  return Number.isFinite(completedAt) && completedAt > dashboardCompletedCutoff(now);
}
