export const DAILY_REPORT_BUCKET = "daily-work-reports";
export const MAX_DAILY_REPORT_IMAGE_SIZE = 4 * 1024 * 1024;
export const DAILY_REPORT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

export function dailyReportImageExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function validateDailyReportImage(file: File) {
  if (
    !allowedTypes.has(file.type) ||
    !allowedExtensions.has(dailyReportImageExtension(file.name))
  ) {
    return "일일업무일지는 JPG, PNG, WEBP 이미지로 등록해 주세요.";
  }
  if (!file.size) return "붙여넣은 이미지가 비어 있습니다.";
  if (file.size > MAX_DAILY_REPORT_IMAGE_SIZE) {
    return "일일업무일지 이미지는 최대 4MB까지 등록할 수 있습니다.";
  }
  return null;
}

export async function hasValidDailyReportImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (file.type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}
