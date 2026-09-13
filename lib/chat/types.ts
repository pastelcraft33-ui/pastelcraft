export type ChatEmployee = {
  id: string;
  name: string;
  position: string;
  department: string;
  imageUrl: string | null;
};

export type ChatRoomSummary = {
  id: string;
  otherEmployee: ChatEmployee;
  lastMessage: {
    content: string | null;
    attachmentName: string | null;
    createdAt: string;
    sentByMe: boolean;
  } | null;
  unreadCount: number;
};

export type ChatMessageItem = {
  id: string;
  senderId: string | null;
  senderName: string;
  senderImageUrl: string | null;
  content: string | null;
  attachment: {
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    downloadUrl: string;
    previewUrl: string;
    isImage: boolean;
  } | null;
  createdAt: string;
};

export type ChatRealtimePayload = {
  roomId: string;
  senderName: string;
  preview: string;
  createdAt: string;
};
