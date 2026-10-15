import assert from "node:assert/strict";
import test from "node:test";
import { mdCompletedDailyCounts } from "@/lib/product-design/md-calendar";

test("MD 완료 캘린더는 완료 작업만 한국 날짜별 건수로 집계한다", () => {
  const completed = { workflowStatus: "completed", completedAt: "2026-10-15T16:30:00Z", scheduledEndAt: null };
  assert.deepEqual(mdCompletedDailyCounts([
    completed, completed,
    { ...completed, workflowStatus: "in_progress" },
    { ...completed, completedAt: "2026-10-15T14:00:00Z" },
  ]), [{ date: "2026-10-15", count: 1 }, { date: "2026-10-16", count: 2 }]);
});

test("MD 완료 캘린더는 종료 시각을 대체 사용하고 날짜가 없는 기록은 제외한다", () => {
  assert.deepEqual(mdCompletedDailyCounts([
    { workflowStatus: "completed", completedAt: null, scheduledEndAt: "2026-10-15T01:00:00Z" },
    { workflowStatus: "completed", completedAt: null, scheduledEndAt: null },
    { workflowStatus: "completed", completedAt: "invalid", scheduledEndAt: null },
  ]), [{ date: "2026-10-15", count: 1 }]);
});
