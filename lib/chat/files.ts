export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const MAX_CHAT_ATTACHMENT_SIZE = 4 * 1024 * 1024;

const allowedFileTypes: Record<string, readonly string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  pdf: ["application/pdf"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  txt: ["text/plain"],
};

export const chatAttachmentAccept = Object.keys(allowedFileTypes)
  .map((extension) => `.${extension}`)
  .join(",");

export function chatFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function validateChatAttachment(file: File | null) {
  if (!file) return null;
  if (!file.size) return "첨부파일이 비어 있습니다.";
  if (file.size > MAX_CHAT_ATTACHMENT_SIZE) return "첨부파일은 최대 4MB까지 전송할 수 있습니다.";
  if (file.name.length > 255) return "첨부파일 이름은 255자 이하만 허용됩니다.";
  const allowedMimes = allowedFileTypes[chatFileExtension(file.name)];
  if (!allowedMimes || !allowedMimes.includes(file.type)) {
    return "이미지, Excel, PowerPoint, PDF, Word, CSV, TXT 파일만 전송할 수 있습니다.";
  }
  return null;
}

export function isChatImageMime(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
}

export async function hasValidChatAttachmentSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  const extension = chatFileExtension(file.name);
  if (extension === "jpg" || extension === "jpeg") return startsWith([0xff, 0xd8, 0xff]);
  if (extension === "png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "webp") return startsWith([0x52, 0x49, 0x46, 0x46]) && bytes.slice(8, 12).every((value, index) => value === [0x57, 0x45, 0x42, 0x50][index]);
  if (extension === "gif") return startsWith([0x47, 0x49, 0x46, 0x38]);
  if (extension === "pdf") return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (["xlsx", "pptx", "docx"].includes(extension)) {
    return startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06]) || startsWith([0x50, 0x4b, 0x07, 0x08]);
  }
  if (["xls", "ppt", "doc"].includes(extension)) {
    return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (["csv", "txt"].includes(extension)) return !bytes.includes(0);
  return false;
}
