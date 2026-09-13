import { z } from "zod";

export const chatEmployeeIdSchema = z.uuid("직원 정보를 확인해 주세요.");
export const chatRoomIdSchema = z.uuid("채팅방 정보를 확인해 주세요.");

export const chatMessageContentSchema = z
  .string()
  .trim()
  .max(3000, "메시지는 3,000자 이하로 입력해 주세요.");

