import type { CompanyRole } from "@/app/models";

export type CompanyPermission =
  | "manage_company"
  | "manage_roles"
  | "manage_team"
  | "edit_tasks"
  | "view_reports"
  | "complete_assigned_work";

const permissions: Record<CompanyRole, ReadonlySet<CompanyPermission>> = {
  owner: new Set(["manage_company", "manage_roles", "manage_team", "edit_tasks", "view_reports", "complete_assigned_work"]),
  admin: new Set(["manage_team", "edit_tasks", "view_reports", "complete_assigned_work"]),
  manager: new Set(["edit_tasks", "view_reports", "complete_assigned_work"]),
  editor: new Set(["edit_tasks", "complete_assigned_work"]),
  employee: new Set(["complete_assigned_work"]),
};

export function hasCompanyPermission(role: CompanyRole | "unassigned", permission: CompanyPermission) {
  return role !== "unassigned" && permissions[role].has(permission);
}
