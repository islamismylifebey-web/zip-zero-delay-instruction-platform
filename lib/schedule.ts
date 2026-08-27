import type { Job } from "@/app/models";

export type ScheduleTab = "today" | "week" | "upcoming";

const WEEK_LABEL = /^(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week)\b/i;

export function filterScheduleJobs(jobs: Job[], tab: ScheduleTab) {
  if (tab === "today") return jobs.filter((job) => /^today\b/i.test(job.scheduleLabel));
  if (tab === "week") return jobs.filter((job) => WEEK_LABEL.test(job.scheduleLabel));
  return jobs.filter((job) => !WEEK_LABEL.test(job.scheduleLabel));
}
