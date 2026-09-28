export const PRODUCT_DESIGN_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const PRODUCT_DESIGN_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";

const allowedTypes: Record<string, readonly string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

export function productDesignImageExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function validateProductDesignImage(file: File | null) {
  if (!file) return null;
  if (file.size === 0) return "대표 이미지 파일이 비어 있습니다.";
  if (file.size > PRODUCT_DESIGN_IMAGE_MAX_SIZE) {
    return "대표 이미지는 최대 5MB까지 등록할 수 있습니다.";
  }
  const extension = productDesignImageExtension(file.name);
  if (!allowedTypes[extension]?.includes(file.type)) {
    return "대표 이미지는 JPG, PNG, WEBP 형식만 등록할 수 있습니다.";
  }
  return null;
}
