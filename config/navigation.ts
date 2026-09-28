import {
  CalendarDays,
  ClipboardPlus,
  ContactRound,
  Layers3,
  Megaphone,
  MessageCircle,
  Monitor,
  Palette,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

export const mainNavigation = [
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/leave/new", label: "휴가 신청", icon: ClipboardPlus },
  { href: "/meetings", label: "회의실", icon: UsersRound },
  { href: "/employees", label: "직원 목록", icon: ContactRound },
  { href: "/announcements", label: "공지사항", icon: Megaphone },
  { href: "/my-profile", label: "내 정보", icon: UserRound },
  { href: "/messenger", label: "파스텔 메신저", icon: MessageCircle },
] as const;

export const webTeamNavigation = [
  { href: "/web/product-design", label: "제품 디자인팀", icon: Palette },
  { href: "/web/design", label: "웹 디자인팀", icon: Monitor },
  { href: "/web/marketing", label: "마케팅 팀", icon: Layers3 },
] as const;

export const adminNavigation = [
  { href: "/admin/employees", label: "직원 관리", icon: UsersRound },
  { href: "/admin/settings", label: "설정", icon: Settings },
] as const;

export const leaveApprovalNavigation = [
  { href: "/admin/leave", label: "휴가 승인", icon: ShieldCheck },
] as const;
