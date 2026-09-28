export type WorkspaceUser = {
  id: string;
  name: string;
  position: string;
  positionCode: string;
  department: string;
  departmentCode: string;
  imageUrl: string | null;
  role: "employee" | "admin";
};
