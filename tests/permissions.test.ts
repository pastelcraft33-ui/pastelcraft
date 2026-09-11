import assert from "node:assert/strict";
import test from "node:test";

import type { CurrentEmployee } from "@/lib/auth/session";
import {
  canDeleteAnnouncement,
  canPublishAnnouncement,
} from "@/lib/announcements/permissions";
import {
  canViewDepartment,
  resolveVisibleDepartment,
} from "@/lib/employees/permissions";
import { canDeleteMeeting } from "@/lib/meetings/permissions";
import {
  canCancelLeave,
  canDeleteLeave,
  canReceiveLeaveNotifications,
  canReviewAsRepresentative,
  canReviewAsTeamLead,
} from "@/lib/leave/permissions";
import { canManageTask, canViewTaskDetails } from "@/lib/tasks/permissions";

function employee(overrides: Partial<CurrentEmployee> = {}): CurrentEmployee {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "테스트 직원",
    position: "사원",
    positionCode: "staff",
    department: "웹팀",
    departmentCode: "web",
    imageUrl: null,
    role: "employee",
    sessionExpiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("일반 직원은 본인 업무만 관리한다", () => {
  const current = employee();
  assert.equal(canManageTask(current, current.id, "web"), true);
  assert.equal(canManageTask(current, current.id, "logistics"), false);
  assert.equal(
    canManageTask(
      current,
      "00000000-0000-4000-8000-000000000002",
      "web",
    ),
    false,
  );
});

test("과장급 이상과 참여 직원도 같은 부서 업무만 상세 조회한다", () => {
  const ownerId = "00000000-0000-4000-8000-000000000002";
  assert.equal(canViewTaskDetails(employee(), ownerId, "web"), false);
  assert.equal(canViewTaskDetails(employee(), ownerId, "web", true), true);
  assert.equal(
    canViewTaskDetails(
      employee({ positionCode: "manager", position: "과장" }),
      ownerId,
      "web",
    ),
    true,
  );
  assert.equal(
    canViewTaskDetails(
      employee({ positionCode: "manager", position: "과장" }),
      ownerId,
      "logistics",
    ),
    false,
  );
  assert.equal(
    canViewTaskDetails(
      employee({ positionCode: "team_lead", position: "팀장" }),
      ownerId,
      "logistics",
    ),
    true,
  );
});

test("부서 팀장만 같은 부서 직원의 1차 휴가 승인을 한다", () => {
  const applicant = {
    id: "00000000-0000-4000-8000-000000000002",
    departmentCode: "web",
  };
  assert.equal(
    canReviewAsTeamLead(employee({ positionCode: "team_lead", position: "팀장" }), applicant),
    true,
  );
  assert.equal(
    canReviewAsTeamLead(
      employee({ positionCode: "team_lead", departmentCode: "logistics" }),
      applicant,
    ),
    false,
  );
});

test("최종 휴가 승인은 대표 직급의 관리자만 한다", () => {
  const applicantId = "00000000-0000-4000-8000-000000000002";
  assert.equal(
    canReviewAsRepresentative(
      employee({ role: "admin", positionCode: "representative", position: "대표" }),
      applicantId,
    ),
    true,
  );
  assert.equal(
    canReviewAsRepresentative(
      employee({ role: "admin", positionCode: "team_lead", position: "팀장" }),
      applicantId,
    ),
    false,
  );
});

test("직원은 본인 휴가를 상태와 관계없이 취소·삭제할 수 있다", () => {
  const current = employee();
  assert.equal(
    canCancelLeave(current, { employeeId: current.id, status: "approved" }),
    true,
  );
  assert.equal(canDeleteLeave(current, current.id), true);
  assert.equal(
    canCancelLeave(current, {
      employeeId: "00000000-0000-4000-8000-000000000002",
      status: "pending",
    }),
    false,
  );
  assert.equal(
    canDeleteLeave(
      current,
      "00000000-0000-4000-8000-000000000002",
    ),
    false,
  );
  assert.equal(
    canCancelLeave(current, { employeeId: current.id, status: "cancelled" }),
    false,
  );
});

test("관리자는 다른 직원 휴가를 취소·삭제할 수 있다", () => {
  const current = employee({ role: "admin" });
  const applicantId = "00000000-0000-4000-8000-000000000002";
  assert.equal(
    canCancelLeave(current, { employeeId: applicantId, status: "approved" }),
    true,
  );
  assert.equal(canDeleteLeave(current, applicantId), true);
});

test("휴가 알림은 팀장과 대표자에게만 표시한다", () => {
  assert.equal(canReceiveLeaveNotifications(employee()), false);
  assert.equal(
    canReceiveLeaveNotifications(
      employee({ positionCode: "team_lead", position: "팀장" }),
    ),
    true,
  );
  assert.equal(
    canReceiveLeaveNotifications(
      employee({
        role: "admin",
        positionCode: "representative",
        position: "대표",
      }),
    ),
    true,
  );
  assert.equal(
    canReceiveLeaveNotifications(employee({ role: "admin" })),
    false,
  );
});

test("관리자와 팀장만 모든 부서를, 팀장 미만은 자기 부서만 본다", () => {
  assert.equal(canViewDepartment(employee(), "web"), true);
  assert.equal(canViewDepartment(employee(), "logistics"), false);
  assert.equal(canViewDepartment(employee(), "namdaemun"), false);
  assert.equal(
    canViewDepartment(
      employee({ positionCode: "general_manager", position: "부장" }),
      "logistics",
    ),
    false,
  );
  assert.equal(
    canViewDepartment(
      employee({ positionCode: "manager", position: "과장" }),
      "logistics",
    ),
    false,
  );
  assert.equal(canViewDepartment(employee({ positionCode: "team_lead" }), "logistics"), true);
  assert.equal(canViewDepartment(employee({ positionCode: "team_lead" }), "namdaemun"), true);
  assert.equal(canViewDepartment(employee({ role: "admin" }), "logistics"), true);
});

test("관리자 팀 선택값은 서버에서 검증하고 일반 직원의 URL 선택값은 무시한다", () => {
  assert.equal(resolveVisibleDepartment(employee(), "namdaemun"), "web");
  assert.equal(
    resolveVisibleDepartment(
      employee({ positionCode: "general_manager", position: "부장" }),
      "logistics",
    ),
    "web",
  );
  assert.equal(
    resolveVisibleDepartment(
      employee({ positionCode: "team_lead", position: "팀장" }),
      "namdaemun",
    ),
    null,
  );
  assert.equal(
    resolveVisibleDepartment(employee({ role: "admin" }), "namdaemun"),
    "namdaemun",
  );
  assert.equal(
    resolveVisibleDepartment(employee({ role: "admin" }), "invalid-team"),
    null,
  );
});

test("관리자·팀장·대표만 공지사항을 등록한다", () => {
  assert.equal(canPublishAnnouncement(employee()), false);
  assert.equal(
    canPublishAnnouncement(employee({ positionCode: "team_lead", position: "팀장" })),
    true,
  );
  assert.equal(
    canPublishAnnouncement(
      employee({ positionCode: "representative", position: "대표" }),
    ),
    true,
  );
  assert.equal(canPublishAnnouncement(employee({ role: "admin" })), true);
});

test("관리자는 모든 공지를, 팀장은 본인이 작성한 공지만 삭제한다", () => {
  const authorId = "00000000-0000-4000-8000-000000000002";
  assert.equal(canDeleteAnnouncement(employee({ role: "admin" }), authorId), true);
  assert.equal(
    canDeleteAnnouncement(
      employee({ id: authorId, positionCode: "team_lead", position: "팀장" }),
      authorId,
    ),
    true,
  );
  assert.equal(
    canDeleteAnnouncement(
      employee({ positionCode: "team_lead", position: "팀장" }),
      authorId,
    ),
    false,
  );
  assert.equal(canDeleteAnnouncement(employee({ id: authorId }), authorId), false);
});

test("회의는 등록자 또는 관리자만 삭제한다", () => {
  const creatorId = "00000000-0000-4000-8000-000000000002";
  assert.equal(canDeleteMeeting(employee({ id: creatorId }), creatorId), true);
  assert.equal(canDeleteMeeting(employee(), creatorId), false);
  assert.equal(canDeleteMeeting(employee({ role: "admin" }), creatorId), true);
});
