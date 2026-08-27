import assert from "node:assert/strict";
import test from "node:test";
import { createProfessionalAssignment } from "../lib/job-parser.ts";

test("turns a short instruction into a professional team message", () => {
  const result = createProfessionalAssignment("Clean the lobby at 2 PM, urgent, bring floor signs");
  assert.match(result, /^Assignment:/);
  assert.match(result, /Schedule:/);
  assert.match(result, /Priority: Urgent/);
  assert.match(result, /confirm that you received/i);
  assert.match(result, /safety concern/i);
});

test("does not invent an assignment from empty input", () => {
  assert.equal(createProfessionalAssignment("   "), "");
});
