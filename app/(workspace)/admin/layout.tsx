import { redirect } from "next/navigation";

import { requireCurrentEmployee } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const employee = await requireCurrentEmployee();
  if (
    employee.role !== "admin" &&
    employee.positionCode !== "team_lead" &&
    employee.positionCode !== "representative"
  ) {
    redirect("/calendar");
  }

  return children;
}
