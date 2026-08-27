import type { JobDraft, JobPriority } from "@/app/models";

const addressPattern =
  /\b\d{1,6}\s+[A-Za-z0-9.' -]+(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|court|ct\.?|parkway|pkwy\.?)\b(?:,\s*[A-Za-z .-]+)?/i;

const timePattern =
  /\b(?:today|tomorrow)?\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i;

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sentenceCase(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

export function parseJobInput(input: string): JobDraft {
  const clean = input.trim().replace(/\s+/g, " ");
  const lower = clean.toLowerCase();
  const address = clean.match(addressPattern)?.[0] ?? "Location needed";
  const time = clean.match(timePattern)?.[0] ?? "Today · Next available";

  let priority: JobPriority = "normal";
  if (/\b(urgent|emergency|immediately|asap)\b/i.test(clean)) priority = "urgent";
  else if (/\b(high priority|important|rush)\b/i.test(clean)) priority = "high";

  const requirements: string[] = [];
  if (/before and after photos?/i.test(clean)) requirements.push("Take before and after photos");
  else if (/photos?|pictures?/i.test(clean)) requirements.push("Upload completion photos");
  if (/call (?:dispatch|dispatcher|supervisor)/i.test(clean)) {
    requirements.push("Call dispatch when finished");
  }
  if (/do not begin|wait for approval|without approval/i.test(clean)) {
    requirements.push("Wait for approval before additional work");
  }

  const taskSource = clean
    .replace(addressPattern, "")
    .replace(timePattern, "")
    .replace(/\b(send|assign)\s+[A-Z][a-z]+\s+(?:to\s+)?/i, "")
    .replace(/\b(high priority|urgent|asap|rush)\b[.!]?/gi, "")
    .replace(/\b(?:take|upload) before and after photos?[^.]*[.]?/gi, "")
    .replace(/\bcall (?:dispatch|dispatcher|supervisor)[^.]*[.]?/gi, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, "");

  const cleanedTask = taskSource.replace(/^to\s+/i, "");

  const fallbackTask = lower.includes("window")
    ? "Clean exterior windows"
    : lower.includes("gutter")
      ? "Inspect and service gutters"
      : lower.includes("pressure wash")
        ? "Pressure wash assigned surfaces"
        : "Complete assigned field work";

  return {
    task: sentenceCase(cleanedTask || fallbackTask),
    location: address === "Location needed" ? address : titleCase(address),
    requirements: requirements.length ? requirements : ["Mark finished when complete"],
    priority,
    scheduleLabel: titleCase(time.replace(/\bat\s*/i, "")),
    sourceText: clean,
  };
}

export function createProfessionalAssignment(input: string) {
  const original = input.trim();
  if (!original) return "";

  const draft = parseJobInput(original);
  const details = [
    `Assignment: ${draft.task}`,
    draft.location ? `Location: ${draft.location}` : "",
    draft.scheduleLabel ? `Schedule: ${draft.scheduleLabel}` : "",
    `Priority: ${draft.priority.charAt(0).toUpperCase()}${draft.priority.slice(1)}`,
    draft.requirements.length ? `Requirements: ${draft.requirements.join("; ")}` : "",
  ].filter(Boolean);

  return `${details.join("\n")}\n\nPlease confirm that you received this assignment. Ask the dispatcher about anything unclear before starting, report any delay or safety concern promptly, and mark the work complete when finished.`;
}
