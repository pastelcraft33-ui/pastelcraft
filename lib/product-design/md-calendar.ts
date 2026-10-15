type MdCompletion = {
  workflowStatus: string;
  completedAt: string | null;
  scheduledEndAt?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

export function mdCompletionDate(task: MdCompletion): string | null {
  if (task.workflowStatus !== "completed") return null;
  const timestamp = task.completedAt ?? task.scheduledEndAt;
  if (!timestamp) return null;
  const completed = new Date(timestamp);
  return Number.isNaN(completed.getTime()) ? null : dateFormatter.format(completed);
}

export function mdCompletedDailyCounts(tasks: readonly MdCompletion[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const date = mdCompletionDate(task);
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return [...counts].sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}
