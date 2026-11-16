import { requireApiEmployee } from "@/lib/auth/api";
import { canViewAllLeaveBalances } from "@/lib/leave/balance-permissions";
import { addDays, validDate } from "@/lib/leave/balance";
import { leaveCalendarTitle, leaveProgressLabel } from "@/lib/leave/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiEmployee();
  if (auth.response) return auth.response;
  if (!canViewAllLeaveBalances(auth.employee)) return Response.json({message:"조회 권한이 없습니다."},{status:403});
  const params = new URL(request.url).searchParams;
  const start=params.get("start") ?? "", end=params.get("end") ?? "";
  if (!validDate(start) || !validDate(end) || start>=end || Date.parse(end)-Date.parse(start)> 42*86400000)
    return Response.json({message:"조회 기간을 확인해 주세요."},{status:400});
  const [employees, {data,error}] = await Promise.all([getWorkspaceEmployees(),createAdminClient()
    .from("leave_requests").select("*").in("status",["pending","approved"])
    .lt("start_date",end).gte("end_date",start).order("start_date")]);
  if(error) return Response.json({message:"휴가 일정을 불러오지 못했습니다."},{status:500});
  const owners=new Map(employees.map(e=>[e.id,e]));
  return Response.json(data.flatMap(l=>{
    const owner=owners.get(l.employee_id);
    if(!owner)return [];
    const status=leaveProgressLabel({status:l.status,teamLeadStatus:l.team_lead_status,representativeStatus:l.representative_status});
    const timed=l.day_type==="outing" && l.start_time && l.end_time;
    return [{id:l.id,title:leaveCalendarTitle(owner.name,l.day_type)+" · "+status,
      start:timed?l.start_date+"T"+l.start_time:l.start_date,
      end:timed?l.end_date+"T"+l.end_time:addDays(l.end_date,1),allDay:!timed,
      color:l.status==="approved"?"#32644a":"#896019"}];
  }),{headers:{"Cache-Control":"private, no-store"}});
}
