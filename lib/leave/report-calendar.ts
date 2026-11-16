import { addDays, reportingPeriod } from "./balance";
import { leaveDayTypeLabel } from "./constants";
import { leaveCalendarTeam } from "./departments";
import type { ReportMode, ReportRow } from "./report";

type Event = {id:string;employeeId:string;unit:string;statusLabel:string;start:string;end:string;allDay:boolean};
export async function reportCalendar(rows:ReportRow[], month:string, asOf:string, mode:ReportMode, snapshot:boolean) {
  const year=month.slice(0,4);
  const members=new Map(rows.map(r=>[r.id,{row:r,range:mode==="month"?reportingPeriod(month,r.department):{start:year+"-01-01",end:asOf<year+"-12-31"?asOf:year+"-12-31"}}]));
  const ranges=Array.from(members.values(),m=>m.range);
  const start=ranges.map(r=>r.start).sort()[0],end=ranges.map(r=>r.end).sort().at(-1)!;
  const events=new Map<string,Event>();
  if(snapshot){
    for(const row of rows) for(const l of row.leaveDetails??[]){
      if(l.status!=="pending" && l.status!=="approved")continue;
      events.set(l.id,{id:l.id,employeeId:row.id,unit:l.day_type,statusLabel:l.status==="approved"?"승인 완료":"승인 대기",start:l.start_date,end:addDays(l.end_date,1),allDay:true});
    }
  }else{
    for(let from=start;from<=end;){
      const next=addDays(from,42), until=next>end?addDays(end,1):next;
      const res=await fetch("/api/leave/balances/calendar?"+new URLSearchParams({start:from,end:until}),{cache:"no-store"});
      if(!res.ok)throw new Error("휴가 캘린더를 불러오지 못했습니다. 다시 다운로드해 주세요.");
      for(const e of await res.json() as Event[])events.set(e.id,e);
      from=until;
    }
  }
  const dates=new Map<string,{name:string;unit:string;status:string;time:string;color:string}[]>();
  for(const e of events.values()){
    const member=members.get(e.employeeId);if(!member)continue;
    const first=e.start.slice(0,10), last=e.allDay || e.end.slice(11,19)==="00:00:00"?addDays(e.end.slice(0,10),-1):e.end.slice(0,10);
    const stop=last<member.range.end?last:member.range.end;
    for(let d=first>member.range.start?first:member.range.start;d<=stop;d=addDays(d,1)){
      const items=dates.get(d)??[];
      items.push({name:member.row.name,unit:leaveDayTypeLabel(e.unit),status:e.statusLabel,time:e.allDay?"":(d===first?e.start.slice(11,16):"00:00")+"~"+(d===e.end.slice(0,10)?e.end.slice(11,16):"24:00"),color:leaveCalendarTeam(member.row.department).color});
      dates.set(d,items);
    }
  }
  for(const items of dates.values())items.sort((a,b)=>a.name.localeCompare(b.name,"ko"));
  return {start,end,dates};
}
