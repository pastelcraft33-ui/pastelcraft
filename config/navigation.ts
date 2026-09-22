import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  ContactRound,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

export const mainNavigation = [
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/leave/new", label: "휴가 신청", icon: ClipboardPlus },
  { href: "/daily-reports", label: "일일업무일지", icon: ClipboardList },
  { href: "/tasks/new", label: "업무 등록", icon: BriefcaseBusiness },
  { href: "/meetings", label: "회의실", icon: UsersRound },
  { href: "/employees", label: "직원 목록", icon: ContactRound },
  { href: "/announcements", label: "공지사항", icon: Megaphone },
  { href: "/my-profile", label: "내 정보", icon: UserRound },
  { href: "/messenger", label: "파스텔 메신저", icon: MessageCircle },
] as const;

export const adminNavigation = [
  { href: "/admin/employees", label: "직원 관리", icon: UsersRound },
  { href: "/admin/settings", label: "설정", icon: Settings },
] as const;

export const leaveApprovalNavigation = [
  { href: "/admin/leave", label: "휴가 승인", icon: ShieldCheck },
] as const;
