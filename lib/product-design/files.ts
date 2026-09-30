export const PRODUCT_DESIGN_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const PRODUCT_DESIGN_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const PRODUCT_DESIGN_SPREADSHEET_MAX_SIZE = 4 * 1024 * 1024;
export const PRODUCT_DESIGN_SPREADSHEET_ACCEPT = ".xlsx,.xls,.csv";

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

const spreadsheetTypes: Record<string, readonly string[]> = {
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"],
};

export function productDesignSpreadsheetExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function validateProductDesignSpreadsheet(file: File | null) {
  if (!file) return null;
  if (file.size === 0) return "엑셀 자료 파일이 비어 있습니다.";
  if (file.size > PRODUCT_DESIGN_SPREADSHEET_MAX_SIZE) {
    return "엑셀 자료는 최대 4MB까지 등록할 수 있습니다.";
  }

  const extension = productDesignSpreadsheetExtension(file.name);
  if (!spreadsheetTypes[extension]?.includes(file.type)) {
    return "엑셀 자료는 XLSX, XLS, CSV 형식만 등록할 수 있습니다.";
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (extension === "xlsx" && !(header[0] === 0x50 && header[1] === 0x4b)) {
    return "유효한 XLSX 파일이 아닙니다.";
  }
  if (
    extension === "xls" &&
    ![0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
      (byte, index) => header[index] === byte,
    )
  ) {
    return "유효한 XLS 파일이 아닙니다.";
  }
  if (extension === "csv" && header.includes(0)) {
    return "유효한 CSV 파일이 아닙니다.";
  }
  return null;
}
