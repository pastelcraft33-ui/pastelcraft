import assert from "node:assert/strict";
import test from "node:test";

import {
  DASHBOARD_COMPLETED_RETENTION_DAYS,
  isTaskVisibleOnDashboard,
} from "@/lib/product-design/dashboard";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-29T00:00:00.000Z");

test("완료되지 않은 작업은 기간과 관계없이 대시보드에 표시한다", () => {
  assert.equal(
    isTaskVisibleOnDashboard(
      {
        workflowStatus: "in_progress",
        completedAt: null,
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      now,
    ),
    true,
  );
});

test("완료 작업은 완료 후 30일 전까지만 대시보드에 표시한다", () => {
  const completedWithinRetention = new Date(
    now - (DASHBOARD_COMPLETED_RETENTION_DAYS - 1) * DAY_IN_MILLISECONDS,
  ).toISOString();
  const completedAtCutoff = new Date(
    now - DASHBOARD_COMPLETED_RETENTION_DAYS * DAY_IN_MILLISECONDS,
  ).toISOString();

  assert.equal(
    isTaskVisibleOnDashboard(
      {
        workflowStatus: "completed",
        completedAt: completedWithinRetention,
        updatedAt: completedWithinRetention,
      },
      now,
    ),
    true,
  );
  assert.equal(
    isTaskVisibleOnDashboard(
      {
        workflowStatus: "completed",
        completedAt: completedAtCutoff,
        updatedAt: completedAtCutoff,
      },
      now,
    ),
    false,
  );
});

test("완료일이 없는 이전 데이터는 최종 수정일을 기준으로 30일 보관한다", () => {
  const updatedAt = new Date(now - 31 * DAY_IN_MILLISECONDS).toISOString();

  assert.equal(
    isTaskVisibleOnDashboard(
      {
        workflowStatus: "completed",
        completedAt: null,
        updatedAt,
      },
      now,
    ),
    false,
  );
});
