import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MyProfileForm } from "@/components/employees/my-profile-form";
import { LeaveBalancePanel } from "@/components/leave/leave-balance-panel";
import { requireCurrentEmployee } from "@/lib/auth/session";
import {
  departmentLabel,
  positionLabel,
  roleLabel,
} from "@/lib/employees/constants";
import { createProfileImageSignedUrl } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "내 정보" };
export default async function MyProfilePage() {
  const currentEmployee = await requireCurrentEmployee();
  const supabase = createAdminClient();
  const { data: employee } = await supabase
    .from("employees")
    .select(
      "id, login_id, name, position, department, phone, profile_image_url, role, security_question, security_answer_hash, created_at, last_login_at",
    )
    .eq("id", currentEmployee.id)
    .eq("account_status", "active")
    .maybeSingle();
  if (!employee) notFound();

  return (
    <>
      <div className="px-4 sm:px-8">
        <LeaveBalancePanel />
      </div>
      <MyProfileForm
        employee={{
          id: employee.id,
          loginId: employee.login_id,
          name: employee.name,
          position: positionLabel(employee.position),
          department: departmentLabel(employee.department),
          phone: employee.phone,
          imageUrl: await createProfileImageSignedUrl(
            supabase,
            employee.profile_image_url,
          ),
          hasProfileImage: Boolean(employee.profile_image_url),
          role: roleLabel(employee.role),
          securityQuestion: employee.security_question,
          hasSecurityAnswer: Boolean(employee.security_answer_hash),
          createdAt: employee.created_at,
          lastLoginAt: employee.last_login_at,
        }}
      />
    </>
  );
}
