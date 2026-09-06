export type CrewStatus = "available" | "working" | "help" | "offline";
export type JobStatus = "assigned" | "in-progress" | "help-needed" | "complete";
export type JobPriority = "normal" | "high" | "urgent";
export type CompanyRole = "owner" | "admin" | "manager" | "editor" | "employee";

export type CompanyProfile = {
  name: string;
  departments: string[];
  defaultRole: Exclude<CompanyRole, "owner">;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUpdatedAt?: string;
};

export type CrewMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  accessLevel: Exclude<CompanyRole, "owner">;
  status: CrewStatus;
  email: string;
  phone: string;
  color: "blue" | "green" | "purple" | "amber";
};

export type WorkspaceViewer = {
  role: CompanyRole | "unassigned";
  email: string;
  displayName: string;
  crewId?: string;
};

export type JobEvent = { id: string; label: string; time: string };
export type JobMessage = { id: string; sender: "dispatcher" | "worker"; text: string; time: string };

export type Job = {
  id: string;
  assigneeId: string;
  task: string;
  location: string;
  requirements: string[];
  priority: JobPriority;
  status: JobStatus;
  scheduleLabel: string;
  createdAt: string;
  sourceText?: string;
  helperId?: string;
  events: JobEvent[];
  messages: JobMessage[];
};

export type JobDraft = Pick<Job, "task" | "location" | "requirements" | "priority" | "scheduleLabel" | "sourceText">;

export type MileageEntry = {
  id: string;
  crewId: string;
  jobId?: string;
  date: string;
  miles: number;
  startOdometer?: number;
  endOdometer?: number;
  purpose: string;
  createdAt: string;
};
