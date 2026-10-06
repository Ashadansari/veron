export type AdminActionResult = {
  status: "idle" | "success" | "error";
  message: string;
  resourceId?: string;
};

export const idleAdminAction: AdminActionResult = { status: "idle", message: "" };
