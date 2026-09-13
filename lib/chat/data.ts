import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatMessageItem, ChatRoomSummary } from "@/lib/chat/types";
import { departmentLabel, positionLabel } from "@/lib/employees/constants";
import { getWorkspaceEmployees } from "@/lib/employees/data";
import { createProfileImageSignedUrlMap } from "@/lib/storage/profile-image";
import { isChatImageMime } from "@/lib/chat/files";

export function isMissingChatSchema(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

// 사용 중지·삭제 처리로 익명화된 직원은 메신저 대상에서 제외합니다.
// 과거 데이터의 외래키를 보존하기 위해 이름만 "삭제된 직원"으로 남아 있는
// 레코드가 있을 수 있으므로 account_status만 확인해서는 안 됩니다.
export function isAvailableChatEmployee(employee: {
  account_status: string;
  name: string;
}) {
  return employee.account_status === "active" && employee.name !== "삭제된 직원";
}

export async function getChatRooms(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<{ rooms: ChatRoomSummary[]; schemaAvailable: boolean }> {
  const membershipResult = await supabase
    .from("chat_room_members")
    .select("room_id, last_read_at")
    .eq("employee_id", employeeId);
  if (isMissingChatSchema(membershipResult.error)) {
    return { rooms: [], schemaAvailable: false };
  }
  if (membershipResult.error) throw membershipResult.error;
  const memberships = membershipResult.data ?? [];
  const roomIds = memberships.map((membership) => membership.room_id);
  if (!roomIds.length) return { rooms: [], schemaAvailable: true };

  const [{ data: rooms, error: roomError }, { data: memberRows, error: memberError }, { data: messages, error: messageError }] = await Promise.all([
    supabase.from("chat_rooms").select("id, last_message_at").in("id", roomIds),
    supabase.from("chat_room_members").select("room_id, employee_id").in("room_id", roomIds),
    supabase
      .from("chat_messages")
      .select("id, room_id, sender_id, content, attachment_name, created_at")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (roomError || memberError || messageError) throw roomError ?? memberError ?? messageError;

  const employees = (await getWorkspaceEmployees()).filter(isAvailableChatEmployee);
  const profileUrls = await createProfileImageSignedUrlMap(
    supabase,
    employees.map((employee) => employee.profile_image_url),
  );
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const lastReadByRoom = new Map(
    memberships.map((membership) => [membership.room_id, membership.last_read_at]),
  );
  const messagesByRoom = new Map<string, typeof messages>();
  for (const message of messages ?? []) {
    const rows = messagesByRoom.get(message.room_id) ?? [];
    rows.push(message);
    messagesByRoom.set(message.room_id, rows);
  }

  return {
    schemaAvailable: true,
    rooms: (rooms ?? [])
      .flatMap((room) => {
        const otherMemberId = (memberRows ?? []).find(
          (member) => member.room_id === room.id && member.employee_id !== employeeId,
        )?.employee_id;
        const other = otherMemberId ? employeeById.get(otherMemberId) : null;
        if (!other) return [];
        const roomMessages = messagesByRoom.get(room.id) ?? [];
        const lastMessage = roomMessages[0] ?? null;
        const lastReadAt = lastReadByRoom.get(room.id) ?? "1970-01-01T00:00:00.000Z";
        return [{
          id: room.id,
          otherEmployee: {
            id: other.id,
            name: other.name,
            position: positionLabel(other.position),
            department: departmentLabel(other.department),
            imageUrl: other.profile_image_url
              ? profileUrls.get(other.profile_image_url) ?? null
              : null,
          },
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                attachmentName: lastMessage.attachment_name,
                createdAt: lastMessage.created_at,
                sentByMe: lastMessage.sender_id === employeeId,
              }
            : null,
          unreadCount: roomMessages.filter(
            (message) =>
              message.sender_id !== employeeId && message.created_at > lastReadAt,
          ).length,
        }];
      })
      .sort((a, b) =>
        (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""),
      ),
  };
}

export async function getChatMessages(
  supabase: SupabaseClient,
  roomId: string,
): Promise<ChatMessageItem[]> {
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, sender_id, content, attachment_name, attachment_mime_type, attachment_size_bytes, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const senderIds = [...new Set((rows ?? []).flatMap((row) => row.sender_id ? [row.sender_id] : []))];
  const { data: senders } = senderIds.length
    ? await supabase
      .from("employees")
      .select("id, name, profile_image_url, account_status")
      .in("id", senderIds)
      .eq("account_status", "active")
      .neq("name", "삭제된 직원")
    : { data: [] };
  const profileUrls = await createProfileImageSignedUrlMap(
    supabase,
    (senders ?? []).map((sender) => sender.profile_image_url),
  );
  const senderById = new Map((senders ?? []).map((sender) => [sender.id, sender]));

  return (rows ?? []).reverse().map((row) => {
    const sender = row.sender_id ? senderById.get(row.sender_id) : null;
    return {
      id: row.id,
      senderId: row.sender_id,
      senderName: sender?.name ?? "알 수 없는 사용자",
      senderImageUrl: sender?.profile_image_url
        ? profileUrls.get(sender.profile_image_url) ?? null
        : null,
      content: row.content,
      attachment: row.attachment_name && row.attachment_mime_type
        ? {
            fileName: row.attachment_name,
            mimeType: row.attachment_mime_type,
            fileSizeBytes: row.attachment_size_bytes ?? 0,
            downloadUrl: `/api/chat/attachments/${row.id}`,
            previewUrl: `/api/chat/attachments/${row.id}?inline=1`,
            isImage: isChatImageMime(row.attachment_mime_type),
          }
        : null,
      createdAt: row.created_at,
    };
  });
}
