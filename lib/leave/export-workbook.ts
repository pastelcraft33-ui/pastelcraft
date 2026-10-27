import ExcelJS from "exceljs";
import type { LeaveBalanceData } from "./balance-data";
import { reportingPeriod, tenureGroup } from "./balance";
import { leaveTypeLabel, leaveDayTypeLabel } from "./constants";
import { leaveReportingDepartment } from "./departments";
import { usageMemoDetails } from "./usage-memos";

/** Uses the same computed rows as the screen; exports never mutate leave records. */
export function buildLeaveWorkbook(rows: LeaveBalanceData["rows"], asOf: string, month: string, closed: boolean, teamLabel = "전체 직원") {
  rows = rows.map(leaveReportingDepartment);
  const book = new ExcelJS.Workbook();
  book.creator = "파스텔크래프트";
  const year = asOf.slice(0, 4);
  const periods = [...new Set(rows.map(row => {
    const period = closed && row.result?.period ? row.result.period : reportingPeriod(month, row.department);
    return `${period.start} ~ ${period.end}`;
  }))].join(" / ");
  const sheet = book.addWorksheet("연차 사용대장");
  sheet.addRow([`${year}년도  연차유급휴가  사용대장`]);
  sheet.mergeCells("A1:T1");
  sheet.addRow([`${teamLabel} · ${closed ? "마감본" : "현재 조회본"} / 경리 집계 ${periods} / 단위: 일`]);
  sheet.mergeCells("A2:T2");
  sheet.addRow([`사업장명 : 파스텔크래프트     ${teamLabel}     기준일 : ${asOf}`]);
  sheet.mergeCells("A3:T3");
  sheet.addRow(["성명", "부서", "입사일", "근속", "현재 잔여", "사용 가능", "승인 대기", "올해 사용일수", "월별 휴가 사용 일수"]);
  sheet.addRow([null,null,null,null,null,null,null,null,...Array.from({length:12},(_,i)=>`${i+1}월`)]);
  for(let c=1;c<=8;c++)sheet.mergeCells(4,c,5,c);
  sheet.mergeCells("I4:T4");
  const headerRows = [4,5];
  for (const row of rows) {
    sheet.addRow([row.name, row.departmentLabel, row.hire_date ? new Date(`${row.hire_date}T00:00:00Z`) : null, tenureGroup(row.hire_date, asOf), row.result?.current ?? null, row.result?.available ?? null, row.result?.pending ?? null, row.result?.yearUsed ?? null,
      ...Array.from({length:12},(_,i)=>row.result?.monthlyUsage?.find(m=>m.month===i+1)?.total ?? null)]);
  }
  const employeeEnd = sheet.rowCount;
  sheet.addRow([]);
  const section = sheet.addRow(["휴가 날짜 및 내용 · 직원별 상세 기록"]);
  sheet.mergeCells(section.number, 1, section.number, 20);
  headerRows.push(section.number);
  const detailHeader = sheet.addRow(["직원", "부서", "구분", "시작일 / 월", "종료일", "사용일수", "상태", "내용 / 확인 사항"]);
  sheet.mergeCells(detailHeader.number,8,detailHeader.number,20);
  headerRows.push(detailHeader.number);
  const detail = book.addWorksheet("휴가 상세 내역");
  detail.addRow(["직원", "부서", "구분", "시작일 / 월", "종료일", "사용일수", "상태", "내용 / 확인 사항"]);
  const addDetail = (values: ExcelJS.CellValue[]) => {
    const row = sheet.addRow(values);
    sheet.mergeCells(row.number, 8, row.number, 20);
    row.height = 34;
    detail.addRow(values);
  };
  for (const row of rows) {
    if (row.issue || row.result?.notYetAccrued) addDetail([row.name,row.departmentLabel,"확인 사항",null,null,null,"확인",row.issue ?? "미발생: 첫 월별 발생일 전입니다."]);
    let source: { monthly_usage?: Record<string, number | null>; correction?: unknown; type?: string } = {};
    try { source = JSON.parse(row.account?.reason ?? "{}"); } catch { /* Display unconfirmed below. */ }
    if (row.account?.opening_date.startsWith(year)) {
      for (const [m, amount] of Object.entries(source.monthly_usage ?? {}).sort(([a],[b])=>Number(a)-Number(b))) {
        if (typeof amount !== "number" || amount <= 0 || Number(m)>Number(row.account.opening_date.slice(5,7))) continue;
        const hasMemo = usageMemoDetails(row.account).some(memo => memo.month === Number(m));
        addDetail([row.name,row.departmentLabel,"이전 사용",`${year}년 ${m}월`,null,amount,"이관 반영",`${source.correction ? "사용자 정정" : "엑셀 월별 합계"} · ${hasMemo ? "실제 날짜는 엑셀 사용일 메모 참고" : "실제 휴가 날짜 확인 필요"}. 잔액에 이미 반영되어 다시 차감하지 않습니다.`]);
      }
    }
    const requests = row.leaveDetails;
    for (const memo of usageMemoDetails(row.account)) {
      addDetail([row.name,row.departmentLabel,"엑셀 사용일 메모",memo.startDate ? new Date(`${memo.startDate}T00:00:00Z`) : null,memo.endDate ? new Date(`${memo.endDate}T00:00:00Z`) : null,null,"참고 · 합산 제외",`${memo.month}월 대장 ${memo.cell} · ${memo.text}${memo.startDate ? "" : " · 날짜 미기재 / 확인 필요"}`]);
    }
    if (requests) {
      for (const leave of [...requests].sort((a,b)=>a.start_date.localeCompare(b.start_date))) {
        const actualDays = row.result?.movements.filter(m=>m.kind==="use" && m.source===leave.id && m.date.startsWith(year)).reduce((sum,m)=>sum-m.days,0);
        addDetail([row.name,row.departmentLabel,leaveTypeLabel(leave.leave_type),new Date(`${leave.start_date}T00:00:00Z`),new Date(`${leave.end_date}T00:00:00Z`),leave.status==="approved" && actualDays ? actualDays : null,leave.status==="pending"?"승인 대기":leave.start_date>asOf?"승인 · 사용 예정":"승인",`${leaveDayTypeLabel(leave.day_type)} · 워크스페이스 신청 기록${row.account && leave.start_date<=row.account.opening_date ? " · 이관 이전/경계 일정: 월별 합계와 중복 합산하지 않습니다." : ""}${!row.result ? " · 잔액 미확정: 날짜 기록만 표시" : ""}`]);
      }
    } else {
      // Old closing snapshots may not contain request metadata; never mix in live requests.
      for (const movement of row.result?.movements ?? []) {
        if(movement.kind!=="use" || !movement.date.startsWith(year)) continue;
        addDetail([row.name,row.departmentLabel,"연차 사용",new Date(`${movement.date}T00:00:00Z`),null,-movement.days,"승인",movement.label]);
      }
    }
    if(!requests?.length && !Object.values(source.monthly_usage ?? {}).some(v=>typeof v==="number"&&v>0)) addDetail([row.name,row.departmentLabel,"기록 안내",null,null,null,"확인",source.type==="no_ledger_zero_usage"?"사용자 확인에 따라 이전 사용량 0일로 시작했습니다.":"등록된 휴가 날짜가 없습니다. 실제 쉬는 날짜와 내용을 확인해 등록해 주세요."]);
  }
  const notes=book.addWorksheet("집계 기준");
  notes.addRows([
    ["항목","설명"],
    ["현재 잔여","조회 기준일까지 발생한 연차에서 실제 사용한 연차를 뺀 잔액입니다."],
    ["사용 가능","현재 잔여에서 승인된 미래 휴가를 제외합니다."],
    ["승인 대기","아직 승인되지 않은 연차 신청 일수이며 잔액에서 차감하지 않습니다."],
    ["올해 사용일수","해당 연도 엑셀 이관 사용량 + 이관 이후 조회 기준일까지 실제 사용한 승인 연차입니다."],
    ["월별 기준","엑셀 이전 사용량은 원래 월을 유지합니다. 남대문팀의 이관 이후 월별 사용량은 전월 26일~당월 25일 기준입니다(10월 27일 사용은 11월 대장). 다른 부서는 실제 사용 날짜의 월에 표시합니다. 올해 사용일수는 실제 사용일의 연도로 집계합니다."],
    ["공란","아직 오지 않은 월 또는 미확정 값입니다. 임의로 0일 처리하지 않습니다."],
    ["미발생","첫 월별 발생일 전인 직원은 아래 상세 기록에 미발생으로 표시합니다."],
    ["날짜·내용","엑셀 메모의 실제 사용일은 참고 내역으로 표시하며 월별 합계와 중복 합산하지 않습니다. 날짜별 일수는 추정하지 않습니다. 이관 이후 내역은 시스템 신청으로 표시합니다. 날짜 없는 메모는 확인 필요로 표시합니다."],
    ["마감",closed?"마감 당시 저장한 자료만 사용합니다. 이후 정정 내역은 포함하지 않습니다.":"현재 조회 시점의 자료입니다."],
  ]);
  for(const ws of book.worksheets){
    ws.views=[{state:"frozen",ySplit:ws===sheet?5:1,xSplit:ws===sheet?2:0,showGridLines:false}];
    ws.columns.forEach((col,index)=>{col.width=ws===sheet?(index<2?12:index===2?13:index<8?12:7):ws===notes?(index===0?20:105):index===7?80:18;});
    ws.eachRow(row=>{row.height=row.height??30;row.eachCell(cell=>{
      cell.font={name:"맑은 고딕",size:11,...(typeof cell.value==="number"&&cell.value<0?{color:{argb:"FFC62828"}}:{})};
      cell.alignment={vertical:"middle",wrapText:true,horizontal:typeof cell.value==="number"?"right":"left"};
      if(typeof cell.value==="number")cell.numFmt='0.##"일"';
      if(cell.value instanceof Date)cell.numFmt="yyyy-mm-dd";
    });});
    for(const n of ws===sheet?headerRows:[1])ws.getRow(n).eachCell(cell=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFCCFFFF"}};cell.font={name:"맑은 고딕",size:12,bold:true};cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};});
    ws.pageSetup={orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  for(let r=4;r<=employeeEnd;r++){
    sheet.getRow(r).height=r<=5?23.25:26;
    for(let c=1;c<=20;c++){
      const cell=sheet.getCell(r,c);
      cell.border={top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}};
      if(r>5){cell.alignment={horizontal:c===3?"center":typeof cell.value==="number"?"right":"center",vertical:"middle",wrapText:true};if(c>=5&&c<=8)cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFFFFCC"}};}
    }
  }
  sheet.getRow(1).height=38.25;
  sheet.getRow(2).height=30;
  sheet.getRow(3).height=30;
  sheet.getCell("A1").font={name:"맑은 고딕",size:24,bold:true};
  sheet.getCell("A1").alignment={horizontal:"center",vertical:"middle"};
  sheet.getCell("A2").alignment={horizontal:"center",vertical:"middle"};
  sheet.pageSetup.printTitlesRow="1:5";
  notes.eachRow(row=>{row.height=45;});
  return book;
}
