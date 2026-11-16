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
  let y=0, page=0, team="", period="", pageChapter="휴가 일정";
  const ink="#183d32", muted="#516960", rule="#d4e1db";
  function fill(x:number,top:number,w:number,h:number,color:string) {
    c.fillStyle=color;c.fillRect(x,top,w,h);
  }
  function line(text:string,x:number,top:number,size=16,bold=false,color="#20352b",width=715) {
    c.fillStyle=color; c.font=(bold?"bold ":"")+size+"px system-ui, sans-serif"; c.fillText(text,x,top,width);
  }
  function savePage() {
    fill(40,1060,714,1,rule);
    line("파스텔크래프트   /   사내 인사 자료",40,1086,13,false,muted);
    line(pageChapter+"     /     "+String(page).padStart(2,"0"),625,1086,13,true,ink,129);
    if(page>1) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,210,297,undefined,"FAST");
  }
  function newPage(chapter=pageChapter) {
    if(page) savePage();
    pageChapter=chapter;
    page++; c.fillStyle="white"; c.fillRect(0,0,794,1123);
    fill(40,34,5,16,"#38765c");line("파스텔크래프트   /   인사 운영",54,48,14,true,muted);
    line("조회 기준   "+asOf,594,48,14,false,muted,160);
    line(team+" 연차보고서",40,100,38,true,ink);
    line(period,41,132,16,false,muted);
    fill(40,151,714,2,ink); y=187;
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
    newPage();line("01   휴가 캘린더",40,y,24,true,ink);line(subtitle,570,y,15,true,muted);y+=26;
    Object.values(leaveCalendarTeams).forEach((t,i)=>{fill(40+126*i,y-10,9,9,t.color);line(t.label,56+126*i,y,14,false,ink);});y+=24;
    if(mode==="month") {
      for(const [label,code] of [["웹팀·물류팀 등","web"],["남대문팀","namdaemun"]]){
        if(!rows.some(r=>(r.department==="namdaemun")===(code==="namdaemun")))continue;
        const p=reportingPeriod(month,code);line(label+"  "+p.start+" ~ "+p.end,40,y,14);y+=21;
      }
    }
    fill(40,y-13,714,25,"#edf4ef");
    ["일","월","화","수","목","금","토"].forEach((s,i)=>line(s,48+i*102,y+4,14,true,i===0?"#a04042":i===6?"#245fa2":ink));y+=12;
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
            const top=y+23+j*55;
            fill(x+3,top,96,51,e.color+"12");fill(x+3,top,3,51,e.color);
            line(e.name,x+10,top+15,15,true,ink,85);
            line(e.unit+(e.time?"  "+e.time:""),x+10,top+30,12,false,ink,85);
            line(e.status,x+10,top+45,12,false,muted,85);
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
    newPage("직원별 연차");
    line("02   직원별 연차 현황",40,y,24,true,ink);y+=37;
    const columns=[40,146,226,315,416,494,569,662,754];
    function tableRow(values:string[],header=false) {
      if(header)fill(40,y-20,714,34,"#edf4ef");
      else fill(columns[6],y-20,columns[7]-columns[6],34,"#f0f7f2");
      fill(40,y+13,714,1,rule);
      values.forEach((v,i)=>{
        c.textAlign=i?"right":"left";
        line(v,i?columns[i+1]-8:columns[i]+8,y+2,header?14:16,header || i===0 || i===6,!header && v.startsWith("-")?"#a13d38":i===6?ink:muted,columns[i+1]-columns[i]-12);
      });c.textAlign="left";y+=34;
    }
    const headers=["직원명","총 연차","추가 발생","기초/이관","조정","사용","남은 연차","승인대기"];
    tableRow(headers,true);
    for(const r of results){if(y+35>1040){newPage();tableRow(headers,true);}tableRow(r.cells);}
    y+=12;paragraph("총 연차 = 기간 사용 + 남은 연차. 기초는 기간 시작 전 잔액이며, 기간 중 이관한 경우 기존 발생·이월·사용을 반영한 이관 잔액입니다.");
    paragraph("추가 발생·조정은 이관 이후 기록이며, 승인대기는 조회 자료에서 해당 기간에 신청된 사용 예정 일수입니다.");
    y+=20;room(105);line("03   직원별 사용 내역",40,y,24,true,ink);y+=40;
    for(const [i,r] of results.entries()){
      room(76);fill(40,y-19,4,23,"#78a78d");line(members[i].name,54,y,19,true,ink);
      line("기간 사용  "+r.cells[5]+"     /     잔여  "+r.cells[6],475,y,14,true,muted,279);
      y+=29;for(const detail of r.details)paragraph(detail);
      fill(40,y,714,1,rule);y+=30;
    }
  }
  if(!page)throw new Error("선택한 팀에 출력할 직원이 없습니다.");
  savePage(); pdf.save("연차보고서_"+(groups.size===1?team:"전체팀")+"_"+(mode==="month"?month:month.slice(0,4))+".pdf");
}
