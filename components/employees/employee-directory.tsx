"use client";

import { BriefcaseBusiness, Building2, ChevronRight, MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { adminPositionOptions, departmentOptions } from "@/lib/employees/constants";
import { formatPhone } from "@/lib/utils";

type DirectoryEmployee = {
  id: string;
  name: string;
  position: string;
  positionLabel: string;
  department: string;
  departmentLabel: string;
  phone: string;
  role: "employee" | "admin";
  imageUrl: string | null;
  canViewDetails: boolean;
  isCurrentEmployee: boolean;
};

export function EmployeeDirectory({
  employees,
  accessDenied,
}: {
  employees: DirectoryEmployee[];
  accessDenied: boolean;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [position, setPosition] = useState("all");

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        (department === "all" || employee.department === department) &&
        (position === "all" || employee.position === position) &&
        (!keyword ||
          employee.name.toLowerCase().includes(keyword) ||
          employee.phone.replace(/\D/g, "").includes(keyword.replace(/\D/g, ""))),
    );
  }, [department, employees, position, search]);

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[12px] font-extrabold text-[#4c795d]">PASTELCRAFT PEOPLE</p>
            <h2 className="mt-1 text-[27px] font-extrabold tracking-[-0.045em] text-[#29352e]">직원 목록</h2>
            <p className="mt-2 text-[13px] text-[#78827c]">현재 승인되어 사용 중인 직원 {employees.length}명의 정보를 확인합니다.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#dfe6e1] bg-white px-3.5 py-2 text-[12px] font-bold text-[#617068]">
            <Users className="size-4 text-[#4a7b5d]" /> 재직 직원 {employees.length}명
          </div>
        </div>

        {accessDenied && (
          <div role="alert" className="mt-5 rounded-[12px] border border-[#efd9a2] bg-[#fff9e8] px-4 py-3 text-[13px] font-semibold text-[#796126]">
            다른 부서 직원의 업무 일정은 관리자와 팀장만 조회할 수 있습니다. 기본 프로필 정보만 확인해 주세요.
          </div>
        )}

        <div className="mt-6 grid gap-3 rounded-[16px] border border-[#e0e6e2] bg-white p-4 shadow-[0_10px_30px_rgba(35,54,42,0.04)] sm:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <span className="sr-only">이름 또는 연락처 검색</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#89938d]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 연락처 검색" className={inputClass} />
          </label>
          <select aria-label="부서 필터" value={department} onChange={(event) => setDepartment(event.target.value)} className={inputClass}>
            <option value="all">전체 부서</option>
            {departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select aria-label="직급 필터" value={position} onChange={(event) => setPosition(event.target.value)} className={inputClass}>
            <option value="all">전체 직급</option>
            {adminPositionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {filteredEmployees.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => (
                <div key={employee.id} className="group h-full rounded-[17px] border border-[#e0e6e2] bg-white p-5 shadow-[0_10px_30px_rgba(35,54,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#b9d7c3] hover:shadow-[0_14px_35px_rgba(35,54,42,0.08)]">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={employee.name} imageUrl={employee.imageUrl} size="lg" className="size-14 text-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[17px] font-extrabold tracking-[-0.025em] text-[#2f3b34]">{employee.name}</h3>
                        {employee.isCurrentEmployee && <span className="rounded-full bg-[#e7f5eb] px-2 py-0.5 text-[10px] font-extrabold text-[#3f7655]">나</span>}
                        {employee.role === "admin" && <ShieldCheck aria-label="관리자" className="size-4 text-[#d5a92f]" />}
                      </div>
                      <p className="mt-1 text-[12px] font-bold text-[#617068]">{employee.departmentLabel} · {employee.positionLabel}</p>
                    </div>
                    <ChevronRight className="mt-1 size-4 text-[#a2aaa5] transition group-hover:translate-x-0.5 group-hover:text-[#4f7b60]" />
                  </div>
                  <div className="mt-5 flex items-center gap-2 rounded-[11px] bg-[#f7f9f7] px-3.5 py-3 text-[13px] text-[#505c55]">
                    <Building2 className="size-4 text-[#699078]" />
                    <span className="font-semibold">{formatPhone(employee.phone)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {employee.canViewDetails && <Link href={`/employees/${employee.id}`} className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#eef3ef] px-3 py-2 text-[11px] font-extrabold text-[#526158] hover:bg-[#e4ece6]"><BriefcaseBusiness className="size-3.5" />업무 보기</Link>}
                    {!employee.isCurrentEmployee && <Link href={`/messenger?employee=${employee.id}`} className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#e3f5ea] px-3 py-2 text-[11px] font-extrabold text-[#35684b] hover:bg-[#d8efe0]"><MessageCircle className="size-3.5" />실시간 채팅</Link>}
                    {!employee.canViewDetails && <span className="self-center text-[10px] text-[#929b95]">기본 프로필 정보만 공개</span>}
                  </div>
                </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[16px] border border-dashed border-[#d7dfda] bg-white px-6 py-16 text-center text-[13px] text-[#7f8983]">조건에 맞는 직원이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

const inputClass = "h-11 w-full rounded-[10px] border border-[#dfe5e1] bg-[#fbfcfb] px-3.5 pl-10 text-[13px] font-semibold text-[#455049] outline-none transition focus:border-[#7eae8d] focus:ring-3 focus:ring-[#dcefe2] sm:pl-3.5";
