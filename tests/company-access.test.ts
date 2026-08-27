import assert from "node:assert/strict";
import test from "node:test";
import { hasCompanyPermission } from "../lib/company-access.ts";

test("keeps owner-only powers inside the company", () => {
  assert.equal(hasCompanyPermission("owner", "manage_company"), true);
  assert.equal(hasCompanyPermission("owner", "manage_roles"), true);
  assert.equal(hasCompanyPermission("admin", "manage_company"), false);
  assert.equal(hasCompanyPermission("admin", "manage_roles"), false);
});

test("enforces the admin, manager, editor, and employee hierarchy", () => {
  assert.equal(hasCompanyPermission("admin", "manage_team"), true);
  assert.equal(hasCompanyPermission("manager", "manage_team"), false);
  assert.equal(hasCompanyPermission("manager", "view_reports"), true);
  assert.equal(hasCompanyPermission("editor", "view_reports"), false);
  assert.equal(hasCompanyPermission("editor", "edit_tasks"), true);
  assert.equal(hasCompanyPermission("employee", "edit_tasks"), false);
  assert.equal(hasCompanyPermission("employee", "complete_assigned_work"), true);
  assert.equal(hasCompanyPermission("unassigned", "complete_assigned_work"), false);
});
