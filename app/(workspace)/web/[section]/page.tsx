import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers3, Monitor, Palette } from "lucide-react";

import { requireCurrentEmployee } from "@/lib/auth/session";
import { departmentGroup } from "@/lib/employees/constants";

const sections = {
  "product-design": {
    title: "제품 디자인팀",
    description: "제품 디자인팀 전용 업무 공간입니다.",
    icon: Palette,
  },
  design: {
    title: "웹 디자인팀",
    description: "웹 디자인팀 전용 업무 공간입니다.",
    icon: Monitor,
  },
  marketing: {
    title: "마케팅 팀",
    description: "마케팅 팀 전용 업무 공간입니다.",
    icon: Layers3,
  },
} as const;

export const metadata: Metadata = { title: "웹팀 업무 공간" };

export default async function WebTeamSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const { section } = await params;
  const currentSection = sections[section as keyof typeof sections];

  if (!currentSection || departmentGroup(currentEmployee.departmentCode) !== "web") {
    notFound();
  }

  const Icon = currentSection.icon;
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <div className="rounded-[20px] border border-[#e0e7e2] bg-white px-6 py-12 text-center shadow-[0_12px_30px_rgba(36,55,43,0.04)] sm:px-10 sm:py-16">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#e3f5ea] text-[#34704c]">
          <Icon className="size-7" />
        </span>
        <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-[#2d3931]">
          {currentSection.title}
        </h2>
        <p className="mt-2 text-sm text-[#77827b]">{currentSection.description}</p>
        <p className="mt-7 rounded-xl bg-[#f5f8f5] px-4 py-3 text-xs font-medium text-[#7d8781]">
          메뉴 뼈대가 준비되었습니다. 세부 기능은 다음 단계에서 추가합니다.
        </p>
      </div>
    </section>
  );
}
