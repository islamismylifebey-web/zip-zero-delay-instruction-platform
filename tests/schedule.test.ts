import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../app/models.ts";
import { filterScheduleJobs } from "../lib/schedule.ts";

const job = (id: string, scheduleLabel: string) => ({ id, scheduleLabel }) as Job;
const jobs = [job("today", "Today · 9:00 AM"), job("tomorrow", "Tomorrow · 10:00 AM"), job("later", "July 30 · 8:00 AM")];

test("filters schedule ranges", () => {
  assert.deepEqual(filterScheduleJobs(jobs, "today").map((item) => item.id), ["today"]);
  assert.deepEqual(filterScheduleJobs(jobs, "week").map((item) => item.id), ["today", "tomorrow"]);
  assert.deepEqual(filterScheduleJobs(jobs, "upcoming").map((item) => item.id), ["later"]);
});
