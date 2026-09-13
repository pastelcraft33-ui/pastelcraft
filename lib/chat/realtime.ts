import "server-only";

import { createHmac } from "node:crypto";

import type { ChatRealtimePayload } from "@/lib/chat/types";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export function chatUserRealtimeTopic(employeeId: string) {
  const digest = createHmac("sha256", getServerEnv().SESSION_TOKEN_PEPPER)
    .update(`chat-user:${employeeId}`)
    .digest("hex");
  return `chat-user-${digest}`;
}

export async function broadcastChatMessage(
  employeeIds: string[],
  payload: ChatRealtimePayload,
) {
  const supabase = createAdminClient();
  await Promise.allSettled(
    employeeIds.map(async (employeeId) => {
      const channel = supabase.channel(chatUserRealtimeTopic(employeeId));
      try {
        await channel.httpSend("new-message", payload);
      } finally {
        await supabase.removeChannel(channel);
      }
    }),
  );
}
