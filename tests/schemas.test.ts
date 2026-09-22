import assert from "node:assert/strict";
import test from "node:test";

import { announcementSchema } from "@/schemas/announcements";
import {
  findLoginIdSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/schemas/auth";
import { leaveFormSchema } from "@/schemas/leave";
import {
  dailyReportDateSchema,
  dailyReportIdSchema,
  dailyReportInputSchema,
} from "@/schemas/daily-reports";
import { meetingSchema } from "@/schemas/meetings";
import { chatEmployeeIdSchema, chatMessageContentSchema } from "@/schemas/chat";
import { taskFormSchema } from "@/schemas/tasks";
import { adminResetPasswordSchema } from "@/schemas/admin-employees";
import { adminDeleteEmployeeSchema } from "@/schemas/admin-employees";

test("업무 입력은 상태 필드 없이 검증된다", () => {
  const result = taskFormSchema.safeParse({
    title: "신제품 상세 페이지",
    description: "상세 페이지를 제작합니다.",
    ownerId: "00000000-0000-4000-8000-000000000001",
    participantIds: ["00000000-0000-4000-8000-000000000002"],
    department: "web",
    startDate: "2026-08-04",
    endDate: "2026-08-05",
    relatedLink: "",
  });
  assert.equal(result.success, true);
});

test("오전 반반차 입력을 허용한다", () => {
  const result = leaveFormSchema.safeParse({
    leaveType: "morning_quarter",
    dayType: "morning_quarter",
    startDate: "2026-08-04",
    endDate: "2026-08-04",
    reason: "개인 일정",
    handoverNote: "",
  });
  assert.equal(result.success, true);
});

test("반반차는 하루를 넘길 수 없다", () => {
  const result = leaveFormSchema.safeParse({
    leaveType: "afternoon_quarter",
    dayType: "afternoon_quarter",
    startDate: "2026-08-04",
    endDate: "2026-08-05",
    reason: "개인 일정",
    handoverNote: "",
  });
  assert.equal(result.success, false);
});

test("공지사항 제목과 내용을 검증한다", () => {
  assert.equal(
    announcementSchema.safeParse({
      title: "사내 워크숍 안내",
      content: "워크숍 일정을 확인해 주세요.",
    }).success,
    true,
  );
  assert.equal(
    announcementSchema.safeParse({ title: "", content: "" }).success,
    false,
  );
});

test("회의 일정과 참여자를 검증한다", () => {
  const validMeeting = {
    subject: "주간 업무 회의",
    content: "이번 주 업무 일정을 공유합니다.",
    meetingDate: "2026-08-10",
    startTime: "10:00",
    endTime: "11:00",
    participantIds: ["00000000-0000-4000-8000-000000000001"],
  };
  assert.equal(meetingSchema.safeParse(validMeeting).success, true);
  assert.equal(
    meetingSchema.safeParse({ ...validMeeting, endTime: "09:00" }).success,
    false,
  );
  assert.equal(
    meetingSchema.safeParse({ ...validMeeting, participantIds: [] }).success,
    false,
  );
});

test("직원 가입 시 보안 질문과 답변을 검증한다", () => {
  const validRegistration = {
    loginId: "pastel.staff",
    password: "password1234",
    passwordConfirm: "password1234",
    name: "김직원",
    position: "staff",
    department: "web",
    phone: "010-1234-5678",
    securityQuestion: "high_school",
    securityAnswer: "파스텔고등학교",
  };
  assert.equal(registerSchema.safeParse(validRegistration).success, true);
  assert.equal(
    registerSchema.safeParse({ ...validRegistration, securityAnswer: "" }).success,
    false,
  );
});

test("직원 가입 시 계장 직급을 선택할 수 있다", () => {
  assert.equal(
    registerSchema.safeParse({
      loginId: "pastel.sectionchief",
      password: "password1234",
      passwordConfirm: "password1234",
      name: "김계장",
      position: "section_chief",
      department: "web",
      phone: "010-1234-5678",
      securityQuestion: "high_school",
      securityAnswer: "파스텔고등학교",
    }).success,
    true,
  );
});

test("아이디 찾기는 이름과 휴대전화 형식을 검증한다", () => {
  assert.equal(
    findLoginIdSchema.safeParse({ name: "김직원", phone: "010-1234-5678" })
      .success,
    true,
  );
  assert.equal(
    findLoginIdSchema.safeParse({ name: "김직원", phone: "1234" }).success,
    false,
  );
});

test("비밀번호 재설정은 보안 답변과 새 비밀번호 일치를 검증한다", () => {
  const input = {
    securityAnswer: "파스텔고등학교",
    password: "newpassword123",
    passwordConfirm: "newpassword123",
  };
  assert.equal(resetPasswordSchema.safeParse(input).success, true);
  assert.equal(
    resetPasswordSchema.safeParse({ ...input, passwordConfirm: "different123" })
      .success,
    false,
  );
});

test("관리자 비밀번호 재설정은 안전한 비밀번호와 확인값을 검증한다", () => {
  const input = {
    password: "newpassword123",
    passwordConfirm: "newpassword123",
  };
  assert.equal(adminResetPasswordSchema.safeParse(input).success, true);
  assert.equal(
    adminResetPasswordSchema.safeParse({ ...input, passwordConfirm: "different123" })
      .success,
    false,
  );
  assert.equal(
    adminResetPasswordSchema.safeParse({ password: "short", passwordConfirm: "short" })
      .success,
    false,
  );
});

test("직원 삭제는 확인 이름을 요구한다", () => {
  assert.equal(
    adminDeleteEmployeeSchema.safeParse({ confirmationName: "김직원" }).success,
    true,
  );
  assert.equal(adminDeleteEmployeeSchema.safeParse({ confirmationName: "" }).success, false);
});

test("일일업무일지 날짜와 식별자를 검증한다", () => {
  assert.equal(dailyReportDateSchema.safeParse("2026-09-11").success, true);
  assert.equal(dailyReportDateSchema.safeParse("2026/09/11").success, false);
  assert.equal(
    dailyReportIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success,
    true,
  );
  assert.equal(dailyReportIdSchema.safeParse("daily-report-1").success, false);
});

test("일일업무일지는 업무 항목을 여러 개 등록한다", () => {
  const input = {
    reportDate: "2026-09-18",
    workItems: [
      { workContent: "상품 등록", details: "신제품 10건", notes: "" },
      { workContent: "재고 확인", details: "남대문팀 확인 요청", notes: "품절 2건" },
    ],
  };
  assert.equal(dailyReportInputSchema.safeParse(input).success, true);
  assert.equal(
    dailyReportInputSchema.safeParse({ ...input, workItems: [] }).success,
    false,
  );
  assert.equal(
    dailyReportInputSchema.safeParse({
      ...input,
      workItems: [{ workContent: "", details: "", notes: "" }],
    }).success,
    false,
  );
});

test("메신저 직원 식별자와 메시지 길이를 검증한다", () => {
  assert.equal(
    chatEmployeeIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success,
    true,
  );
  assert.equal(chatEmployeeIdSchema.safeParse("employee-1").success, false);
  assert.equal(chatMessageContentSchema.safeParse("업무 파일을 확인해 주세요.").success, true);
  assert.equal(chatMessageContentSchema.safeParse("가".repeat(3001)).success, false);
});
