import type { Metadata } from "next";

import { MessengerWorkspace } from "@/components/chat/messenger-workspace";
import { requireCurrentEmployee } from "@/lib/auth/session";
import { getChatMessages, getChatRooms, isAvailableChatEmployee } from "@/lib/chat/data";
import type { ChatEmployee } from "@/lib/chat/types";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { createProfileImageSignedUrlMap } from "@/lib/storage/profile-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatEmployeeIdSchema, chatRoomIdSchema } from "@/schemas/chat";

export const metadata: Metadata = { title: "파스텔 메신저" };

export default async function MessengerPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[]; employee?: string | string[] }>;
}) {
  const currentEmployee = await requireCurrentEmployee({ includeProfileImage: true });
  const params = await searchParams;
  const roomParam = Array.isArray(params.room) ? params.room[0] : params.room;
  const employeeParam = Array.isArray(params.employee) ? params.employee[0] : params.employee;
  const supabase = createAdminClient();
  const { rooms, schemaAvailable } = await getChatRooms(supabase, currentEmployee.id);
  const requestedRoomId = chatRoomIdSchema.safeParse(roomParam).success ? roomParam! : null;
  const requestedEmployeeId = chatEmployeeIdSchema.safeParse(employeeParam).success && employeeParam !== currentEmployee.id ? employeeParam! : null;
  const employeeRoom = requestedEmployeeId
    ? rooms.find((room) => room.otherEmployee.id === requestedEmployeeId)
    : null;
  const activeRoomId = rooms.some((room) => room.id === requestedRoomId)
    ? requestedRoomId
    : employeeRoom?.id ?? null;
  const messages = activeRoomId ? await getChatMessages(supabase, activeRoomId) : [];

  const employeeRows = (await getWorkspaceEmployees()).filter(
    (employee) => isAvailableChatEmployee(employee) && employee.id !== currentEmployee.id,
  );
  const profileUrls = await createProfileImageSignedUrlMap(
    supabase,
    employeeRows.map((employee) => employee.profile_image_url),
  );
  const employees: ChatEmployee[] = employeeRows.map((employee) => ({
    id: employee.id,
    name: employee.name,
    position: positionLabel(employee.position),
    department: departmentLabel(employee.department),
    imageUrl: employee.profile_image_url ? profileUrls.get(employee.profile_image_url) ?? null : null,
  }));

  return <MessengerWorkspace
    rooms={rooms}
    activeRoomId={activeRoomId}
    messages={messages}
    employees={employees}
    currentEmployee={{
      id: currentEmployee.id,
      name: currentEmployee.name,
      position: currentEmployee.position,
      department: currentEmployee.department,
      imageUrl: currentEmployee.imageUrl,
    }}
    startEmployeeId={requestedEmployeeId && !employeeRoom ? requestedEmployeeId : null}
    schemaAvailable={schemaAvailable}
  />;
}
