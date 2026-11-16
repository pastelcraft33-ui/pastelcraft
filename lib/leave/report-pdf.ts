import { jsPDF } from "jspdf";
import { addDays, reportingPeriod } from "./balance";
import { reportCalendar } from "./report-calendar";
import { leaveCalendarTeams } from "./departments";
import { employeeReport, type ReportMode, type ReportRow } from "./report";

// Render locally with the device's Korean fonts; no employee data leaves the browser.
export async function downloadLeaveReport(rows: ReportRow[], month: string, asOf: string, mode: ReportMode, holidays: string[], snapshot=false) {
  if(!rows.length)throw new Error("선택한 팀에 출력할 직원이 없습니다.");
  const calendar=await reportCalendar(rows,month,asOf,mode,snapshot);
  await document.fonts.ready;
  const pdf = new jsPDF({unit:"mm",format:"a4",compress:true});
  const canvas = document.createElement("canvas");
  canvas.width=1588; canvas.height=2246;
  const ctx=canvas.getContext("2d");
  if (!ctx) throw new Error("PDF 생성에 필요한 그리기 기능을 사용할 수 없습니다.");
  const c=ctx; c.scale(2,2);
  let y=0, page=0, team="", period="";
  function line(text:string,x:number,top:number,size=16,bold=false,color="#20352b",width=715) {
    c.fillStyle=color; c.font=(bold?"bold ":"")+size+"px system-ui, sans-serif"; c.fillText(text,x,top,width);
  }
  function savePage() {
    line("파스텔크래프트  |  사내 인사 자료",40,1086,12); line(String(page),740,1086,12);
    if(page>1) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,210,297,undefined,"FAST");
  }
  function newPage() {
    if(page) savePage();
    page++; c.fillStyle="white"; c.fillRect(0,0,794,1123);
    line(team+" 연차보고서",40,72,32,true); line(period,40,110,16);
    y=150;
  }
  function room(n:number) { if(y+n>1040) newPage(); }
  function paragraph(text:string) {
    let buf=""; c.font="16px system-ui, sans-serif";
    for(const ch of text) {
      if(c.measureText(buf+ch).width>690) {room(25);line(buf,50,y);y+=25;buf="";}
      buf+=ch;
    }
    room(25);line(buf,50,y); y+=25;
  }
  const groups=new Map<string,ReportRow[]>();
  for(const row of rows){const group=groups.get(row.departmentLabel)??[];group.push(row);groups.set(row.departmentLabel,group);}
  const order=["웹팀","남대문팀","물류팀"];
  team=groups.size===1?rows[0].departmentLabel:"전체 팀";
  period=(mode==="month"?month+" 월 마감":month.slice(0,4)+" 연간 누적")+"  |  "+calendar.start+" ~ "+calendar.end+(snapshot?"  ·  마감 보관본":"");
  const calendarPage=(subtitle:string)=>{
    newPage();line("휴가 캘린더  ·  "+subtitle,40,y,22,true);y+=28;
    Object.values(leaveCalendarTeams).forEach((t,i)=>line("● "+t.label,40+125*i,y,15,true,t.color));y+=24;
    if(mode==="month") {
      for(const [label,code] of [["웹팀·물류팀 등","web"],["남대문팀","namdaemun"]]){
        if(!rows.some(r=>(r.department==="namdaemun")===(code==="namdaemun")))continue;
        const p=reportingPeriod(month,code);line(label+"  "+p.start+" ~ "+p.end,40,y,14);y+=21;
      }
    }
    ["일","월","화","수","목","금","토"].forEach((s,i)=>line(s,46+i*102,y,15,true));y+=8;
  };
  let cursor=calendar.start;
  while(cursor<=calendar.end){
    const caption=mode==="year"?cursor.slice(0,7):"팀별 마감 기간";
    calendarPage(caption);
    let week=addDays(cursor,-new Date(cursor+"T00:00:00Z").getUTCDay());
    do {
      const cells=Array.from({length:7},(_,i)=>addDays(week,i));
      const visible=(d:string)=>d>=cursor && d<=calendar.end && (mode==="month" || d.slice(0,7)===caption);
      const max=Math.max(1,...cells.map(d=>visible(d)?calendar.dates.get(d)?.length??0:0));
      for(let offset=0;offset<max;){
        if(y+85>1035)calendarPage(caption+" (계속)");
        const count=Math.min(max-offset,Math.floor((1035-y-28)/55)),height=28+count*55;
        cells.forEach((d,i)=>{
          const x=40+i*102;c.strokeStyle="#d4ded7";c.strokeRect(x,y,102,height);
          if(!visible(d))return;
          line(d.slice(5).replace("-","/")+(offset?" 계속":""),x+5,y+17,13,true,i===0?"#ad3440":i===6?"#245fa2":"#20352b");
          (calendar.dates.get(d)??[]).slice(offset,offset+count).forEach((e,j)=>{
            const top=y+23+j*55;c.fillStyle=e.color;c.fillRect(x+2,top,98,52);
            line(e.name+" · "+e.unit,x+5,top+16,13,true,"white",92);line(e.status,x+5,top+32,12,false,"white",92);
            if(e.time)line(e.time,x+5,top+47,12,false,"white",92);
          });
        });
        y+=height;offset+=count;
      }
      week=addDays(week,7);
    }while(week<=calendar.end && (mode==="month" || week.slice(0,7)===caption));
    if(mode==="month")break;
    cursor=addDays(cursor.slice(0,7)+"-28",4).slice(0,7)+"-01";
  }
  for(const label of [...groups.keys()].sort((a,b)=>(order.includes(a)?order.indexOf(a):9)-(order.includes(b)?order.indexOf(b):9))) {
    const members=groups.get(label)!.slice().sort((a,b)=>a.name.localeCompare(b.name,"ko"));
    const holidaysSet=new Set(holidays);
    const results=members.map(r=>employeeReport(r,month,asOf,mode,holidaysSet));
    team=label; period=(mode==="month"?"월 마감":"연간 누적")+"  |  "+(results[0].start>results[0].end ? results[0].start+" 시작 예정" : results[0].start+" ~ "+results[0].end)+"  |  "+members.length+"명";
    if(mode==="month"){
      const range=reportingPeriod(month,members[0].department);
      period=month+" 월 마감  |  "+range.start+" ~ "+range.end+"  |  "+members.length+"명"
        +(asOf<range.end ? (asOf<range.start ? "  ·  집계 전" : "  ·  "+asOf+"까지 반영") : "");
    }
    newPage();
    const columns=[40,146,226,315,416,494,569,662,754];
    function tableRow(values:string[],header=false) {
      c.fillStyle=header?"#dceee4":"#f5f8f6"; c.fillRect(40,y-20,714,32);
      values.forEach((v,i)=>line(v,columns[i]+6,y+2,15,header || i===6,"#20352b",columns[i+1]-columns[i]-12)); y+=34;
    }
    const headers=["직원명","총 연차","추가 발생","기초/이관","조정","사용","남은 연차","승인대기"];
    tableRow(headers,true);
    for(const r of results){if(y+35>1040){newPage();tableRow(headers,true);}tableRow(r.cells);}
    paragraph("총 연차 = 기간 사용 + 남은 연차. 기초는 기간 시작 전 잔액이며, 기간 중 이관한 경우 기존 발생·이월·사용을 반영한 이관 잔액입니다.");
    paragraph("추가 발생·조정은 이관 이후 기록이며, 승인대기는 조회 자료에서 해당 기간에 신청된 사용 예정 일수입니다.");
    y+=20;room(85);line("직원별 사용 내역",40,y,23,true);y+=36;
    for(const [i,r] of results.entries()){room(60);line(members[i].name,40,y,18,true);y+=27;for(const detail of r.details)paragraph(detail);y+=15;}
  }
  if(!page)throw new Error("선택한 팀에 출력할 직원이 없습니다.");
  savePage(); pdf.save("연차보고서_"+(groups.size===1?team:"전체팀")+"_"+(mode==="month"?month:month.slice(0,4))+".pdf");
}
