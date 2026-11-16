"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import ko from "@fullcalendar/core/locales/ko";
import { useRef, useState } from "react";
import type { EventSourceFunc } from "@fullcalendar/core";
import { leaveCalendarTeams } from "@/lib/leave/departments";

export function ManagementCalendar() {
  const ref=useRef<FullCalendar>(null);
  const [failed,setFailed]=useState(false);
  return <section className="rounded-2xl border bg-white p-3 sm:p-5" aria-label="전 직원 휴가 캘린더">
    <h2 className="mb-2 text-xl font-bold">휴가 캘린더</h2>
    <p className="mb-4 text-sm text-slate-600">전 직원의 승인 대기·승인 완료 일정을 표시합니다.</p>
    <ul aria-label="팀별 일정 색상" className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
      {Object.values(leaveCalendarTeams).map(team=><li key={team.label} className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-full" style={{backgroundColor:team.color}} />{team.label}
      </li>)}
    </ul>
    {failed && <p role="alert">휴가 일정을 불러오지 못했습니다. <button className="underline" onClick={()=>ref.current?.getApi().refetchEvents()}>다시 시도</button></p>}
    <FullCalendar ref={ref} plugins={[dayGridPlugin]} locale={ko} timeZone="Asia/Seoul" firstDay={0}
      initialView="dayGridMonth" height="auto" dayMaxEvents={false}
      headerToolbar={{left:"prev,next",center:"title",right:"today"}}
      events={loadEvents} eventSourceFailure={()=>setFailed(true)} eventSourceSuccess={()=>{setFailed(false);}} />
  </section>;
}

const loadEvents: EventSourceFunc = async (range: {startStr:string; endStr:string})=>{
  const params=new URLSearchParams({start:range.startStr.slice(0,10),end:range.endStr.slice(0,10)});
  const response=await fetch("/api/leave/balances/calendar?"+params,{cache:"no-store"});
  if(!response.ok)throw new Error("휴가 일정 조회 실패");
  return response.json();
};
