import assert from "node:assert/strict";
import test from "node:test";
import { parseJobInput } from "../lib/job-parser.ts";

test("structures a spoken field assignment", () => {
  const draft = parseJobInput(
    "Send Tiana to 1420 West Willow Lane at 2 PM to clean the exterior windows. Take before and after photos and call dispatch when finished. High priority.",
  );

  assert.equal(draft.location, "1420 West Willow Lane");
  assert.equal(draft.task, "Clean the exterior windows");
  assert.equal(draft.priority, "high");
  assert.match(draft.scheduleLabel, /2 Pm/i);
  assert.ok(draft.requirements.includes("Take before and after photos"));
  assert.ok(draft.requirements.includes("Call dispatch when finished"));
});

test("uses safe defaults when details are missing", () => {
  const draft = parseJobInput("Inspect the gutters tomorrow");
  assert.equal(draft.location, "Location needed");
  assert.equal(draft.priority, "normal");
  assert.deepEqual(draft.requirements, ["Mark finished when complete"]);
});
