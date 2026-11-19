"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import ko from "@fullcalendar/core/locales/ko";
import { useRef, useState } from "react";
import type { EventSourceFunc } from "@fullcalendar/core";
import { leaveCalendarTeams } from "@/lib/leave/departments";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ManagementCalendar({canManage=false}:{canManage?:boolean}) {
  const router=useRouter();
  const [selected,setSelected]=useState<{id:string;title:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const ref=useRef<FullCalendar>(null);
  const [failed,setFailed]=useState(false);
  return <section className="rounded-2xl border bg-white p-3 sm:p-5" aria-label="전 직원 휴가 캘린더">
    <h2 className="mb-2 text-xl font-bold">휴가 캘린더</h2>
    {canManage && <Link href="/leave/new" className="mb-3 inline-flex rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white">직원 휴가 등록</Link>}
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
      eventClick={({event})=>{if(canManage){setError("");setSelected({id:event.id,title:event.title});}}}
      events={loadEvents} eventSourceFailure={()=>setFailed(true)} eventSourceSuccess={()=>{setFailed(false);}} />
    {selected && <div role="dialog" aria-modal="true" aria-label="직원 휴가 삭제" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6">
        <h3 className="text-xl font-bold">{selected.title}</h3>
        <p>삭제하면 신청 기록이 영구 삭제됩니다. 시스템에서 차감된 연차는 다시 계산되며, 이관한 과거 대장 잔액은 변경되지 않습니다.</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button disabled={busy} onClick={()=>setSelected(null)} className="rounded-lg border px-4 py-2">닫기</button>
          <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-white" onClick={async()=>{
            if(!window.confirm(selected.title+"\n이 휴가를 영구 삭제할까요?"))return;
            setBusy(true);setError("");
            try{
              const response=await fetch("/api/leave/"+selected.id,{method:"DELETE"});
              const result=await response.json();
              if(!response.ok)throw new Error(result.message??"삭제하지 못했습니다.");
              setSelected(null);ref.current?.getApi().refetchEvents();
              window.dispatchEvent(new Event("leave-requests-changed"));router.refresh();
            }catch(e){setError(e instanceof Error?e.message:"삭제하지 못했습니다.");}
            finally{setBusy(false);}
          }}>{busy?"삭제 중…":"영구 삭제"}</button>
        </div>
      </div>
    </div>}
  </section>;
}

const loadEvents: EventSourceFunc = async (range: {startStr:string; endStr:string})=>{
  const params=new URLSearchParams({start:range.startStr.slice(0,10),end:range.endStr.slice(0,10)});
  const response=await fetch("/api/leave/balances/calendar?"+params,{cache:"no-store"});
  if(!response.ok)throw new Error("휴가 일정 조회 실패");
  return response.json();
};
