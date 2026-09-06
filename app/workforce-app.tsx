"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompanyProfile, CrewMember, Job, JobDraft, JobStatus, MileageEntry, WorkspaceViewer } from "./models";
import { createProfessionalAssignment, parseJobInput } from "@/lib/job-parser";
import { filterScheduleJobs, type ScheduleTab } from "@/lib/schedule";
import { hasCompanyPermission } from "@/lib/company-access";

type View = "command" | "schedule" | "crew" | "mileage";
type Role = "dispatcher" | "worker" | "unassigned";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPlatform = "ios" | "android" | "desktop";

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function statusLabel(status: JobStatus) {
  return {
    assigned: "Assigned",
    "in-progress": "In progress",
    "help-needed": "Needs help",
    complete: "Complete",
  }[status];
}

function jobNumber(jobs: Job[]) {
  const highest = jobs.reduce((max, job) => {
    const value = Number(job.id.replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `JOB-${highest + 1}`;
}

function detectInstallPlatform(): InstallPlatform {
  const agent = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  if (/android/.test(agent)) return "android";
  return "desktop";
}

const emptyCompany: CompanyProfile = {
  name: "",
  departments: [],
  defaultRole: "employee",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
};

function companyForViewer(company: CompanyProfile | undefined, viewer: WorkspaceViewer): CompanyProfile {
  const profile = company ?? emptyCompany;
  if (viewer.role !== "owner") return profile;
  return {
    ...profile,
    contactName: profile.contactName || viewer.displayName,
    contactEmail: profile.contactEmail || viewer.email,
  };
}

export default function WorkforceApp({ ownerName }: { ownerName: string }) {
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [mileage, setMileage] = useState<MileageEntry[]>([]);
  const [view, setView] = useState<View>("command");
  const [role, setRole] = useState<Role>("unassigned");
  const [viewer, setViewer] = useState<WorkspaceViewer | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [recipientId, setRecipientId] = useState("all");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<JobDraft>(() => parseJobInput(""));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState("");
  const [helpJobId, setHelpJobId] = useState<string | null>(null);
  const [messageJobId, setMessageJobId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mileageJobId, setMileageJobId] = useState<string | null>(null);
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [deleteCrewId, setDeleteCrewId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>("desktop");
  const [isInstalled, setIsInstalled] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [calibration, setCalibration] = useState({
    names: "",
    locations: "",
  });
  const hydrated = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const serverVersion = useRef<string | null>(null);
  const skipNextSave = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const initialCheck = window.setTimeout(() => {
      setInstallPlatform(detectInstallPlatform());
      setIsInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as StandaloneNavigator).standalone));
    }, 0);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const confirmInstalled = () => {
      setIsInstalled(true);
      setInstallHelpOpen(false);
      setInstallPrompt(null);
      announce("App installed. Open it from your home screen or apps list.");
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", confirmInstalled);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", confirmInstalled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace")
      .then((response) => {
        if (!response.ok) throw new Error("Workspace unavailable");
        return response.json() as Promise<{ workspace: { company?: CompanyProfile; jobs?: Job[]; crew?: CrewMember[]; mileage?: MileageEntry[] } | null; viewer: WorkspaceViewer; updatedAt?: string }>;
      })
      .then(({ workspace, viewer: currentViewer, updatedAt }) => {
        if (cancelled) return;
        setViewer(currentViewer);
        setRole(currentViewer.role === "unassigned" ? "unassigned" : currentViewer.role === "employee" ? "worker" : "dispatcher");
        if (currentViewer.role !== "employee" && currentViewer.role !== "unassigned") {
          const requestedView = new URLSearchParams(window.location.search).get("view");
          if (requestedView === "schedule" || requestedView === "crew" || requestedView === "mileage" || requestedView === "command") setView(requestedView);
        }
        if (currentViewer.crewId) setWorkerId(currentViewer.crewId); else if (workspace?.crew?.[0]) setWorkerId(workspace.crew[0].id);
        setCompany(companyForViewer(workspace?.company, currentViewer));
        setJobs(workspace?.jobs ?? []);
        setCrew(workspace?.crew ?? []);
        setMileage(workspace?.mileage ?? []);
        serverVersion.current = updatedAt ?? null;
        hydrated.current = true;
        setSaveState("saved");
      })
      .catch(() => {
        if (cancelled) return;
        hydrated.current = true;
        setSaveState("error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!viewer || viewer.role === "unassigned") return;
    const refresh = window.setInterval(() => {
      fetch("/api/workspace")
        .then((response) => response.ok ? response.json() as Promise<{ workspace: { company?: CompanyProfile; jobs?: Job[]; crew?: CrewMember[]; mileage?: MileageEntry[] } | null; updatedAt?: string }> : Promise.reject(new Error("Sync failed")))
        .then(({ workspace, updatedAt }: { workspace: { company?: CompanyProfile; jobs?: Job[]; crew?: CrewMember[]; mileage?: MileageEntry[] } | null; updatedAt?: string }) => {
          if (!updatedAt || updatedAt === serverVersion.current || saveTimer.current) return;
          skipNextSave.current = true;
          setCompany(companyForViewer(workspace?.company, viewer));
          setJobs(workspace?.jobs ?? []);
          setCrew(workspace?.crew ?? []);
          setMileage(workspace?.mileage ?? []);
          serverVersion.current = updatedAt;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 8_000);
    return () => window.clearInterval(refresh);
  }, [viewer]);

  useEffect(() => {
    if (!hydrated.current || !viewer || !["owner", "admin", "manager", "editor"].includes(viewer.role)) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      fetch("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, jobs, crew, mileage, version: serverVersion.current }),
      })
        .then(async (response) => {
          if (response.status === 409) {
            const latest = await fetch("/api/workspace");
            if (!latest.ok) throw new Error("Refresh failed");
            const payload = await latest.json() as { workspace: { company?: CompanyProfile; jobs?: Job[]; crew?: CrewMember[]; mileage?: MileageEntry[] } | null; updatedAt?: string };
            skipNextSave.current = true;
            setCompany(companyForViewer(payload.workspace?.company, viewer));
            setJobs(payload.workspace?.jobs ?? []);
            setCrew(payload.workspace?.crew ?? []);
            setMileage(payload.workspace?.mileage ?? []);
            serverVersion.current = payload.updatedAt ?? null;
            announce("A newer worker update was loaded. Please repeat your last change.");
            return;
          }
          if (!response.ok) throw new Error("Save failed");
          const payload = await response.json() as { updatedAt?: string; memberConflicts?: string[] };
          serverVersion.current = payload.updatedAt ?? serverVersion.current;
          if (payload.memberConflicts?.length) announce(`Access is already connected elsewhere for: ${payload.memberConflicts.join(", ")}`);
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [company, jobs, crew, mileage, viewer]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [role, view]);

  const worker = crew.find((member) => member.id === workerId) ?? crew[0];
  const workerJobs = jobs.filter((job) => job.assigneeId === workerId);
  const activeJobs = jobs.filter((job) => job.status !== "complete");
  const completedJobs = jobs.filter((job) => job.status === "complete");
  const helpJobs = jobs.filter((job) => job.status === "help-needed");
  const canEditTasks = !!viewer && hasCompanyPermission(viewer.role, "edit_tasks");
  const canManageTeam = !!viewer && hasCompanyPermission(viewer.role, "manage_team");
  const canManageRoles = !!viewer && hasCompanyPermission(viewer.role, "manage_roles");
  const canViewReports = !!viewer && hasCompanyPermission(viewer.role, "view_reports");

  const crewWithStatus = useMemo(
    () =>
      crew.map((member) => {
        const memberJobs = jobs.filter((job) => job.assigneeId === member.id);
        const needsHelp = memberJobs.some((job) => job.status === "help-needed");
        const working = memberJobs.some((job) => job.status === "in-progress");
        return { ...member, status: needsHelp ? "help" : working ? "working" : "available" } as CrewMember;
      }),
    [jobs, crew],
  );

  function announce(message: string) {
    setToast(message);
  }

  function patchWorkspace(body: object) {
    setSaveState("saving");
    return fetch("/api/workspace", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Update failed");
        setSaveState("saved");
      })
      .catch(() => {
        setSaveState("error");
        announce("That update could not be saved. Please try again.");
      });
  }

  async function installApp() {
    if (isInstalled) {
      announce("The app is already installed on this device.");
      return;
    }
    if (!installPrompt) {
      setInstallPlatform(detectInstallPlatform());
      setInstallHelpOpen(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        announce("App installed. Open it from your home screen or apps list.");
      } else {
        setInstallHelpOpen(true);
      }
      setInstallPrompt(null);
    } catch {
      setInstallHelpOpen(true);
    }
  }

  async function copyAppLink() {
    try {
      await window.navigator.clipboard.writeText(window.location.href);
      announce("App link copied. Paste it into Safari, Chrome, or Edge.");
    } catch {
      announce("Copy the address from your browser bar, then open it in Safari, Chrome, or Edge.");
    }
  }

  function structureAssignment(value = transcript) {
    if (!value.trim()) {
      announce("Say or type an assignment first.");
      return;
    }
    setDraft(parseJobInput(value));
    setReviewOpen(true);
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      announce("Voice capture is not supported here. Type the assignment below.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let result = "";
      for (let index = 0; index < event.results.length; index += 1) {
        result += event.results[index][0].transcript;
      }
      setTranscript(result.trim());
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setRecording(false);
      announce("I could not hear that. Type the assignment or try again.");
    };
    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setRecording(false);
    window.setTimeout(() => structureAssignment(), 120);
  }

  function sendAssignment() {
    const recipients = recipientId === "all" ? crew : crew.filter((member) => member.id === recipientId);
    if (!recipients.length) {
      announce("Add a crew member before sending work.");
      return;
    }
    let nextNumber = Number(jobNumber(jobs).replace(/\D/g, ""));
    const created = recipients.map((member) => {
      const id = `JOB-${nextNumber}`;
      nextNumber += 1;
      return {
        id,
        assigneeId: member.id,
        ...draft,
        status: "assigned" as const,
        createdAt: nowLabel(),
        events: [{ id: `${id}-sent`, label: "Assignment sent", time: nowLabel() }],
        messages: [],
      };
    });
    setJobs((current) => [...created, ...current]);
    setReviewOpen(false);
    setTranscript("");
    announce(recipientId === "all" ? `Work sent to all ${created.length} crew members.` : `Work sent to ${recipients[0].name}.`);
  }

  function updateJob(jobId: string, status: JobStatus, label: string) {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status,
              events: [...job.events, { id: `${jobId}-${Date.now()}`, label, time: nowLabel() }],
            }
          : job,
      ),
    );
    if (viewer?.role === "employee") void patchWorkspace({ action: "job_status", jobId, status });
    announce(label);
  }

  function assignHelper(jobId: string, helperId: string) {
    const helper = crew.find((member) => member.id === helperId);
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              helperId,
              status: "in-progress",
              events: [...job.events, { id: `${job.id}-helper`, label: `${helper?.name} assigned to help`, time: nowLabel() }],
            }
          : job,
      ),
    );
    setHelpJobId(null);
    announce(`${helper?.name} is on the way to help.`);
  }

  function sendMessage() {
    if (!messageJobId || !messageText.trim()) return;
    const sender = role === "dispatcher" ? "dispatcher" : "worker";
    setJobs((current) =>
      current.map((job) =>
        job.id === messageJobId
          ? {
              ...job,
              messages: [...job.messages, { id: `${job.id}-message-${Date.now()}`, sender, text: messageText.trim(), time: nowLabel() }],
            }
          : job,
      ),
    );
    if (viewer?.role === "employee") void patchWorkspace({ action: "message", jobId: messageJobId, text: messageText.trim() });
    setMessageText("");
    announce("Message sent.");
  }

  function addCrewMember(member: Omit<CrewMember, "id" | "initials" | "status" | "color">) {
    const initials = member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const colors: CrewMember["color"][] = ["blue", "green", "purple", "amber"];
    const created: CrewMember = {
      ...member,
      id: `crew-${Date.now()}`,
      initials,
      status: "available",
      color: colors[crew.length % colors.length],
    };
    setCrew((current) => [...current, created]);
    setWorkerId(created.id);
    setRecipientId(created.id);
    setAddCrewOpen(false);
    announce(`${created.name} added to the crew.`);
  }

  function deleteCrewMember() {
    if (!deleteCrewId) return; const member = crew.find((item) => item.id === deleteCrewId);
    setCrew((current) => current.filter((item) => item.id !== deleteCrewId)); setJobs((current) => current.filter((job) => job.assigneeId !== deleteCrewId && job.helperId !== deleteCrewId)); setMileage((current) => current.filter((entry) => entry.crewId !== deleteCrewId)); setDeleteCrewId(null); if (workerId === deleteCrewId) setWorkerId(""); announce(`${member?.name ?? "Team member"} was removed.`);
  }
  function updateCrewAccess(memberId: string, accessLevel: CrewMember["accessLevel"]) { setCrew((current) => current.map((member) => member.id === memberId ? { ...member, accessLevel } : member)); announce("Access level updated."); }
  async function createCompany(companyName: string) {
    setSaveState("saving"); const response = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_company", companyName }) });
    if (!response.ok) { setSaveState("error"); announce("The company workspace could not be created. Please try again."); return; }
    const payload = await response.json() as { workspace: { company: CompanyProfile; jobs: Job[]; crew: CrewMember[]; mileage: MileageEntry[] }; viewer: WorkspaceViewer; updatedAt: string };
    setCompany(payload.workspace.company); setJobs([]); setCrew([]); setMileage([]); setViewer(payload.viewer); setRole("dispatcher"); serverVersion.current = payload.updatedAt; setSaveState("saved"); setAddCrewOpen(true); announce(`${payload.workspace.company.name} is ready.`);
  }
  async function uploadCompanyLogo(file: File) {
    const form = new FormData(); form.set("logo", file); setSaveState("saving"); const response = await fetch("/api/company-logo", { method: "POST", body: form });
    if (!response.ok) { setSaveState("error"); announce("Choose a PNG, JPG, or WebP logo under 2 MB."); return; }
    const payload = await response.json() as { logoUpdatedAt: string; updatedAt: string }; skipNextSave.current = true; setCompany((current) => ({ ...current, logoUpdatedAt: payload.logoUpdatedAt })); serverVersion.current = payload.updatedAt; setSaveState("saved"); announce("Company logo updated.");
  }

  function logMileage(entry: Omit<MileageEntry, "id" | "createdAt">) {
    const created: MileageEntry = {
      ...entry,
      id: `MILE-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setMileage((current) => [created, ...current]);
    if (viewer?.role === "employee") void patchWorkspace({ action: "mileage", jobId: entry.jobId, entry });
    setMileageJobId(null);
    announce(`${created.miles.toFixed(1)} miles saved.`);
  }

  function closeTour() {
    window.localStorage.setItem("sad-tour-complete", "yes");
    setTourOpen(false);
    setTourStep(0);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { if (canEditTasks) { setView("command"); setRole("dispatcher"); } }} aria-label="Open home">
          <span className="brand-mark"><img src={company.logoUpdatedAt ? `/api/company-logo?v=${encodeURIComponent(company.logoUpdatedAt)}` : "/sad-royal-silver-v5-192.png"} alt="" width="42" height="42" /></span>
          <span>
            <strong>Speak. Assign. Done.</strong>
            <small>{company.name || "Workforce Intelligence"}</small>
          </span>
        </button>

        {canEditTasks && role === "dispatcher" && <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "command" ? "active" : ""} onClick={() => setView("command")}>Command</button>
          <button className={view === "schedule" ? "active" : ""} onClick={() => setView("schedule")}>Schedule</button>
          {(canManageTeam || canViewReports) && <button className={view === "crew" ? "active" : ""} onClick={() => setView("crew")}>Team</button>}
          {canViewReports && <button className={view === "mileage" ? "active" : ""} onClick={() => setView("mileage")}>Mileage</button>}
        </nav>}

        <div className="top-actions">
          {saveState === "error" ? <button className="demo-pill save-error sync-retry" onClick={() => window.location.reload()} aria-label="Retry workspace sync">Sync problem · Retry</button> : <span className={`demo-pill save-${saveState}`}>{saveState === "loading" ? "Opening…" : saveState === "saving" ? "Saving…" : "All changes saved"}</span>}
          {!isInstalled && <button className="install-button" onClick={installApp}>Install app</button>}
          {canEditTasks && <button className="settings-button" onClick={() => { setTourStep(0); setTourOpen(true); }} aria-label="Open instruction guide">Guide</button>}
          {viewer?.role === "owner" && <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="Open company and voice settings">Company</button>}
          <button className="profile-button" disabled={!canEditTasks} onClick={() => { if (!canEditTasks) return; if (role === "worker") setRole("dispatcher"); else if (crew.length) setRole("worker"); else announce("Add a team member first."); }}>
            <span className="avatar avatar-blue">{role === "dispatcher" ? (viewer?.displayName ?? ownerName).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : role === "unassigned" ? "?" : worker?.initials ?? "?"}</span>
            <span><strong>{role === "dispatcher" ? viewer?.displayName ?? ownerName : role === "unassigned" ? viewer?.displayName ?? ownerName : worker?.name ?? "Team member"}</strong><small>{role === "dispatcher" ? `${viewer?.role ?? "Owner"} access` : role === "unassigned" ? "Choose access" : viewer?.role === "employee" ? "Employee" : "Employee preview"}</small></span>
            {canEditTasks && <span aria-hidden="true">⌄</span>}
          </button>
        </div>
      </header>

      {role === "unassigned" ? (
        <CompanySetup email={viewer?.email ?? "your signed-in email"} createCompany={createCompany} installApp={installApp} />
      ) : role === "dispatcher" ? (
        <DispatcherView
          view={view}
          jobs={jobs}
          crew={crewWithStatus}
          transcript={transcript}
          setTranscript={setTranscript}
          recording={recording}
          startVoice={startVoice}
          stopVoice={stopVoice}
          structureAssignment={structureAssignment}
          activeCount={activeJobs.length}
          completeCount={completedJobs.length}
          helpCount={helpJobs.length}
          mileage={mileage}
          onHelp={setHelpJobId}
          onMessage={setMessageJobId}
          onWorkerView={(id) => { setWorkerId(id); setRole("worker"); setView("command"); }}
          onAddCrew={() => setAddCrewOpen(true)}
          onDeleteCrew={setDeleteCrewId}
          onAccessChange={updateCrewAccess}
          canManageTeam={canManageTeam}
          canManageRoles={canManageRoles}
          canViewReports={canViewReports}
          onBack={() => setView("command")}
        />
      ) : worker ? (
        <WorkerView
          worker={worker}
          crew={crew}
          jobs={workerJobs}
          setWorkerId={setWorkerId}
          updateJob={updateJob}
          onMessage={setMessageJobId}
          onMileage={setMileageJobId}
          backToDispatch={() => setRole("dispatcher")}
          isPreview={viewer?.role !== "employee"}
        />
      ) : (
        <AccessPending email={viewer?.email ?? "your signed-in email"} installApp={installApp} />
      )}

      {reviewOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><span className="eyebrow">Smart structure</span><h2 id="review-title">Review the assignment</h2></div>
              <button className="close-button" onClick={() => setReviewOpen(false)} aria-label="Close assignment review">×</button>
            </div>
            <label>Send to<select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="all">Everyone</option>{crew.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Task<textarea value={draft.task} onChange={(event) => setDraft({ ...draft, task: event.target.value })} /></label>
            <div className="form-grid review-fields">
              <label>Location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
              <label>Schedule<input value={draft.scheduleLabel} onChange={(event) => setDraft({ ...draft, scheduleLabel: event.target.value })} /></label>
              <label>Priority<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobDraft["priority"] })}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            </div>
            <label>Requirements<textarea value={draft.requirements.join("\n")} onChange={(event) => setDraft({ ...draft, requirements: event.target.value.split("\n").filter(Boolean) })} /></label>
            <div className="source-note"><strong>Original instruction</strong><span>{draft.sourceText}</span></div>
            <div className="modal-actions"><button className="button secondary" onClick={() => setReviewOpen(false)}>Keep editing</button><button className="button primary" onClick={sendAssignment}>Send assignment</button></div>
          </section>
        </div>
      )}

      {helpJobId && (
        <HelpModal job={jobs.find((job) => job.id === helpJobId)} crew={crew} onAssign={assignHelper} onClose={() => setHelpJobId(null)} />
      )}

      {messageJobId && (
        <MessageModal
          job={jobs.find((job) => job.id === messageJobId)}
          crew={crew}
          role={role}
          messageText={messageText}
          setMessageText={setMessageText}
          sendMessage={sendMessage}
          onClose={() => setMessageJobId(null)}
        />
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">Owner settings</span><h2 id="settings-title">Company workspace</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
            <p className="modal-intro">Your company, team, roles, assignments, and mileage stay synced across devices.</p>
            <label>Company name<input value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} /></label>
            <div className="form-grid company-contact-grid">
              <label>Owner or contact name<input value={company.contactName} onChange={(event) => setCompany({ ...company, contactName: event.target.value })} autoComplete="name" /></label>
              <label>Company contact email<input type="email" value={company.contactEmail} onChange={(event) => setCompany({ ...company, contactEmail: event.target.value })} autoComplete="email" /></label>
              <label>Company contact phone<input type="tel" value={company.contactPhone} onChange={(event) => setCompany({ ...company, contactPhone: event.target.value })} placeholder="Optional" autoComplete="tel" /></label>
            </div>
            <p className="field-note">These details replace the platform owner’s contact information on your company’s Privacy, Terms, and Account pages.</p>
            <label>Departments<textarea value={company.departments.join("\n")} onChange={(event) => setCompany({ ...company, departments: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One department per line" /></label>
            <label>Default access for new team members<select value={company.defaultRole} onChange={(event) => setCompany({ ...company, defaultRole: event.target.value as CompanyProfile["defaultRole"] })}><option value="employee">Employee</option><option value="editor">Editor</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label>
            <label>Company logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCompanyLogo(file); }} /><small>PNG, JPG, or WebP · maximum 2 MB</small></label>
            <div className="settings-divider" /><h3>Voice calibration</h3>
            <p className="modal-intro">Optional device-only pronunciation hints. These fields start empty and never create team or task data.</p>
            <label>Common employee names<textarea value={calibration.names} onChange={(event) => setCalibration({ ...calibration, names: event.target.value })} /></label>
            <label>Common locations<textarea value={calibration.locations} onChange={(event) => setCalibration({ ...calibration, locations: event.target.value })} /></label>
            <div className="security-note"><strong>Private company boundary</strong><span>Every company has a separate workspace. No employee, manager, or administrator can see another company. Owner, Admin, Manager, Editor, and Employee permissions are enforced on the server.</span></div>
            <div className="security-note"><strong>Scalable team capacity</strong><span>There is no hard-coded employee limit. Search, indexed membership lookup, and 50-person pages keep large teams manageable; subscription plans can control commercial seat limits later.</span></div>
            <div className="settings-links"><button className="button secondary" onClick={installApp}>{isInstalled ? "App installed" : "Install on this device"}</button><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/account">Account & data</a></div>
            <div className="modal-actions"><button className="button secondary" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="button primary" onClick={() => { setSettingsOpen(false); announce("Company settings saved."); }}>Save settings</button></div>
          </section>
        </div>
      )}

      {mileageJobId && (
        <MileageModal job={jobs.find((job) => job.id === mileageJobId)} crew={crew} onSave={logMileage} onClose={() => setMileageJobId(null)} />
      )}

      {addCrewOpen && <AddCrewModal defaultRole={company.defaultRole} canManageRoles={canManageRoles} onSave={addCrewMember} onClose={() => setAddCrewOpen(false)} />}

      {deleteCrewId && <ConfirmDeleteMember member={crew.find((item) => item.id === deleteCrewId)} onConfirm={deleteCrewMember} onClose={() => setDeleteCrewId(null)} />}
      {tourOpen && <InstructionTour step={tourStep} setStep={setTourStep} onClose={closeTour} />}
      {installHelpOpen && <InstallAppModal platform={installPlatform} onCopy={copyAppLink} onClose={() => setInstallHelpOpen(false)} />}

      {toast && <div className="toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>}
      <footer className="app-footer"><span>Speak. Assign. Done. · {company.name || "Private company workspace"}</span><nav aria-label="Legal and account"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/account">Account</a><a href="/signout-with-chatgpt?return_to=/">Sign out</a></nav></footer>
    </main>
  );
}

function InstallAppModal({ platform, onCopy, onClose }: { platform: InstallPlatform; onCopy: () => Promise<void>; onClose: () => void }) {
  const instructions = platform === "ios"
    ? ["Open this app link in Safari.", "Tap the Share button at the bottom of Safari.", "Choose Add to Home Screen.", "Tap Add to finish."]
    : platform === "android"
      ? ["Open this app link in Chrome.", "Tap Chrome’s three-dot menu.", "Choose Install app or Add to Home screen.", "Tap Install to finish."]
      : ["Open this app link in Chrome, Edge, or Safari.", "Choose the install icon in the address bar or open the browser menu.", "Select Install app or Add to Dock.", "Confirm Install."];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="eyebrow">Install on this device</span><h2 id="install-title">Add Speak. Assign. Done. as an app</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close installation instructions">×</button>
        </div>
        <div className="install-note"><strong>No app-store download is required.</strong><span>Your browser installs the secure web app and adds its icon to your home screen or apps list.</span></div>
        <ol className="install-steps">
          {instructions.map((instruction, index) => <li key={instruction}><span>{index + 1}</span><strong>{instruction}</strong></li>)}
        </ol>
        <div className="install-warning"><strong>Opened inside another app?</strong><span>In-app browsers may block installation. Copy the link below, then paste it into Safari, Chrome, or Edge.</span></div>
        <div className="modal-actions split"><button className="button secondary" onClick={onClose}>Back to app</button><button className="button primary" onClick={() => void onCopy()}>Copy app link</button></div>
      </section>
    </div>
  );
}

function CompanySetup({ email, createCompany, installApp }: { email: string; createCompany: (name: string) => Promise<void>; installApp: () => void }) {
  const [name, setName] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  return <section className="access-pending company-setup"><span className="access-icon">✦</span><span className="eyebrow">Private company setup</span><h1>Connect to the right company.</h1><p>Companies are never connected to one another. If your employer already added <strong>{email}</strong>, check your invitation. Create a new workspace only when you are the employer responsible for a separate company.</p><div className="tenant-choice"><strong>Employee or team member?</strong><span>Do not create a company. Ask your employer to add this exact email, then check your invitation.</span><button className="button primary" onClick={() => window.location.reload()}>Check employee invitation</button></div><div className="tenant-choice owner-choice"><strong>Employer or company owner?</strong><span>Create an empty, isolated workspace for your company. Nothing is shared with another business.</span><label>Company name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your company’s legal or working name" /></label><label className="owner-confirm"><input type="checkbox" checked={ownerConfirmed} onChange={(event) => setOwnerConfirmed(event.target.checked)} /><span>I confirm that I am authorized to create and manage this company workspace.</span></label><button className="button secondary" disabled={name.trim().length < 2 || !ownerConfirmed} onClick={() => void createCompany(name.trim())}>Create private company workspace</button></div><div><button className="button secondary" onClick={installApp}>Install on this device</button></div><a className="setup-signout" href="/signout-with-chatgpt?return_to=/">Sign in with a different account</a></section>;
}

function AccessPending({ email, installApp }: { email: string; installApp: () => void }) {
  return <section className="access-pending"><span className="access-icon">✦</span><span className="eyebrow">Secure employee access</span><h1>Your account is signed in.</h1><p>Ask the company owner or administrator to add <strong>{email}</strong> to the team. Your assigned work will appear here automatically.</p><div><button className="button primary" onClick={() => window.location.reload()}>Check access again</button><button className="button secondary" onClick={installApp}>Install on this device</button></div><a className="setup-signout" href="/signout-with-chatgpt?return_to=/">Sign out</a></section>;
}

function DispatcherView({
  view, jobs, crew, transcript, setTranscript, recording, startVoice, stopVoice,
  structureAssignment, activeCount, completeCount, helpCount, mileage, onHelp, onMessage, onWorkerView, onAddCrew, onDeleteCrew, onAccessChange, canManageTeam, canManageRoles, canViewReports, onBack,
}: {
  view: View; jobs: Job[]; crew: CrewMember[]; transcript: string; setTranscript: (value: string) => void;
  recording: boolean; startVoice: () => void; stopVoice: () => void; structureAssignment: (value?: string) => void;
  activeCount: number; completeCount: number; helpCount: number; onHelp: (id: string) => void;
  mileage: MileageEntry[]; onMessage: (id: string) => void; onWorkerView: (id: string) => void; onAddCrew: () => void;
  onDeleteCrew: (id: string) => void; onAccessChange: (id: string, access: CrewMember["accessLevel"]) => void; canManageTeam: boolean; canManageRoles: boolean; canViewReports: boolean; onBack: () => void;
}) {
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantReply, setAssistantReply] = useState("");

  if (view === "schedule") return <ScheduleView jobs={jobs} crew={crew} onBack={onBack} />;
  if (view === "crew") return <CrewView crew={crew} jobs={jobs} onWorkerView={onWorkerView} onAddCrew={onAddCrew} onDeleteCrew={onDeleteCrew} onAccessChange={onAccessChange} canManageTeam={canManageTeam} canManageRoles={canManageRoles} onBack={onBack} />;
  if (view === "mileage" && canViewReports) return <MileageView mileage={mileage} jobs={jobs} crew={crew} onBack={onBack} />;

  const mileageToday = mileage.reduce((total, entry) => total + entry.miles, 0);

  function askAssistant() {
    const reply = createProfessionalAssignment(assistantInput);
    if (!reply) return;
    setAssistantReply(reply);
    setTranscript(reply);
    setAssistantInput("");
  }

  return (
    <div className="dashboard">
      <section className="command-column">
        <div className="welcome-row">
          <div><span className="eyebrow">Company operations</span><h1>What does the team need to do?</h1><p>Speak it once. We turn it into clear work.</p></div>
          <span className="date-badge">Today · Live</span>
        </div>

        <article className={`voice-card ${recording ? "recording" : ""}`}>
          <button className="voice-button" onClick={recording ? stopVoice : startVoice} aria-pressed={recording} aria-label={recording ? "Stop recording and review assignment" : "Start voice assignment"}>
            <span className="mic-icon" aria-hidden="true"><i /><b /></span>
            <strong>{recording ? "Listening…" : "Tap to assign work"}</strong>
            <small>{recording ? "Tap again when finished" : "Voice is the fastest way"}</small>
          </button>
          <div className="waveform" aria-hidden="true">{Array.from({ length: 26 }, (_, index) => <span key={index} />)}</div>
          <div className="assignment-input">
            <label htmlFor="assignment-text">Or type the assignment</label>
            <textarea id="assignment-text" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Send a team member to the work location at 2 PM to complete the assignment…" />
            <button className="button primary" onClick={() => structureAssignment()}>Structure assignment <span aria-hidden="true">→</span></button>
          </div>
        </article>

        <article className="assistant-card" aria-labelledby="assistant-title">
          <div className="assistant-heading">
            <span className="assistant-avatar" aria-hidden="true">✦</span>
            <div><span className="eyebrow">Communication assistant</span><h2 id="assistant-title">Tell me what the team needs to know.</h2><p>I’ll turn your everyday words into a clear, professional assignment. You review every message before it is sent.</p></div>
          </div>
          <div className="assistant-thread" aria-live="polite">
            <div className="assistant-bubble assistant-bubble-system">What would you like an employee or the whole team to do?</div>
            {assistantReply && <div className="assistant-bubble assistant-bubble-reply"><strong>Professional draft</strong><span>{assistantReply}</span></div>}
          </div>
          <div className="assistant-compose">
            <label htmlFor="assistant-message">Message the assistant</label>
            <textarea id="assistant-message" value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Example: Tell Marcus to clean the lobby at 2 and bring wet-floor signs." />
            <div><button className="button secondary" disabled={!assistantInput.trim()} onClick={askAssistant}>Improve my message</button>{assistantReply && <button className="button primary" onClick={() => structureAssignment(assistantReply)}>Review and assign <span aria-hidden="true">→</span></button>}</div>
          </div>
          <small className="assistant-disclosure">Writing assistance is generated inside this app from the details you provide. It does not send anything until you approve the assignment.</small>
        </article>
        {crew.length === 0 && <section className="empty-start"><span aria-hidden="true">＋</span><div><h2>Start with your real team</h2><p>Your workspace is empty. Add the first employee, choose their access level, then send an assignment.</p></div>{canManageTeam && <button className="button primary" onClick={onAddCrew}>Add team member</button>}</section>}

        <section className="metrics-section" aria-labelledby="today-work-title">
          <div className="section-heading today-work-heading"><div><span className="eyebrow">Live company overview</span><h2 id="today-work-title">Today’s work</h2><p>One balanced view of assignments, progress, support, and travel.</p></div><span className="updated">Securely synced</span></div>
          <div className="metrics-grid">
            <Metric icon="▣" value={jobs.length} label="Assigned" note="Today" tone="blue" />
            <Metric icon="◷" value={activeCount} label="In progress" note="On site" tone="green" />
            <Metric icon="✓" value={completeCount} label="Complete" note="Done today" tone="green" />
            <Metric icon="!" value={helpCount} label="Attention needed" note="Requires action" tone={helpCount ? "amber" : "gray"} />
            <Metric icon="↗" value={Number(mileageToday.toFixed(1))} label="Miles logged" note="All recorded trips" tone="blue" />
          </div>
        </section>
      </section>

      <aside className="status-column">
        <section className="panel crew-panel">
          <div className="panel-heading"><div><span className="eyebrow">Live crew</span><h2>Crew status</h2></div><span className="online-count">{crew.filter((member) => member.status !== "offline").length} online</span></div>
          <div className="crew-list">
            {crew.length === 0 && <div className="panel-empty"><strong>No team members yet.</strong><span>Add a real employee to begin.</span>{canManageTeam && <button className="button secondary" onClick={onAddCrew}>Add team member</button>}</div>}
            {crew.map((member) => {
              const job = jobs.find((item) => item.assigneeId === member.id && item.status !== "complete");
              return <button className="crew-row" key={member.id} onClick={() => onWorkerView(member.id)}><span className={`avatar avatar-${member.color}`}>{member.initials}<i className={`presence ${member.status}`} /></span><span className="crew-name"><strong>{member.name}</strong><small>{member.role}</small></span><span className={`status-chip ${member.status}`}>{member.status === "working" ? "Working" : member.status === "help" ? "Needs help" : "Available"}</span><span className="crew-job"><strong>{job?.location ?? "Ready for work"}</strong><small>{job?.task ?? "No active job"}</small></span><span aria-hidden="true">›</span></button>;
            })}
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading"><div><span className="eyebrow">Latest</span><h2>Live activity</h2></div></div>
          <div className="activity-list">
            {jobs.length === 0 && <div className="panel-empty"><strong>No activity yet.</strong><span>Assignments and updates will appear here.</span></div>}
            {jobs.slice(0, 4).map((job) => {
              const member = crew.find((person) => person.id === job.assigneeId);
              const event = job.events[job.events.length - 1];
              return <div className="activity-row" key={job.id}><span className={`activity-dot ${job.status}`} /><span><strong>{event?.label ?? "Assignment updated"}</strong><small>{member?.name} · {job.id} · {event?.time}</small></span>{job.status === "help-needed" ? <button onClick={() => onHelp(job.id)}>Assign help</button> : <button onClick={() => onMessage(job.id)}>Message</button>}</div>;
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({ icon, value, label, note, tone }: { icon: string; value: number; label: string; note: string; tone: string }) {
  return <article className="metric"><span className={`metric-icon ${tone}`}>{icon}</span><span><strong>{value}</strong><b>{label}</b><small>{note}</small></span></article>;
}

function WorkerView({ worker, crew, jobs, setWorkerId, updateJob, onMessage, onMileage, backToDispatch, isPreview }: {
  worker: CrewMember; crew: CrewMember[]; jobs: Job[]; setWorkerId: (id: string) => void;
  updateJob: (id: string, status: JobStatus, label: string) => void; onMessage: (id: string) => void; onMileage: (id: string) => void; backToDispatch: () => void; isPreview: boolean;
}) {
  const openJobs = jobs.filter((job) => job.status !== "complete");
  const completeJobs = jobs.filter((job) => job.status === "complete");
  return (
    <div className="worker-shell">
      <div className="worker-heading"><div>{isPreview && <button className="back-link" onClick={backToDispatch}>← Dispatcher</button>}<span className="eyebrow">{isPreview ? "Worker preview" : "Worker companion"}</span><h1>Today’s Jobs</h1><p>Everything {worker.name} needs. Nothing extra.</p></div>{isPreview && <label className="worker-switcher">Preview as<select value={worker.id} onChange={(event) => setWorkerId(event.target.value)}>{crew.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}</div>
      <div className="worker-grid">
        <section className="job-stack">
          {openJobs.length === 0 && <div className="empty-state"><span>✓</span><h2>You’re caught up.</h2><p>No more work is assigned right now.</p></div>}
          {openJobs.map((job) => <WorkerJobCard key={job.id} job={job} crew={crew} updateJob={updateJob} onMessage={onMessage} onMileage={onMileage} />)}
        </section>
        <aside className="worker-aside"><div className="worker-id-card"><span className={`avatar avatar-${worker.color}`}>{worker.initials}</span><div><strong>{worker.name}</strong><small>{worker.role}</small></div><span className="status-chip available">Online</span></div><div className="worker-summary"><h2>Today</h2><div><span><strong>{openJobs.length}</strong><small>Open jobs</small></span><span><strong>{completeJobs.length}</strong><small>Finished</small></span></div></div><div className="help-promise"><strong>Need a person?</strong><p>Contact dispatch from any job. You never have to hunt for the right chat.</p></div></aside>
      </div>
    </div>
  );
}

function WorkerJobCard({ job, crew, updateJob, onMessage, onMileage }: { job: Job; crew: CrewMember[]; updateJob: (id: string, status: JobStatus, label: string) => void; onMessage: (id: string) => void; onMileage: (id: string) => void }) {
  const navigateUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`;
  return (
    <article className={`worker-job ${job.status}`}>
      <div className="job-top"><div><span className={`priority ${job.priority}`}>{job.priority === "normal" ? "Standard" : `${job.priority} priority`}</span><span className="job-number">{job.id}</span></div><span className={`status-chip ${job.status}`}>{statusLabel(job.status)}</span></div>
      <h2>{job.task}</h2><div className="job-location"><span aria-hidden="true">⌖</span><div><strong>{job.location}</strong><small>{job.scheduleLabel}</small></div></div>
      <ul>{job.requirements.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
      {job.helperId && <div className="helper-banner">Help is coming: {crew.find((member) => member.id === job.helperId)?.name}</div>}
      <div className="job-actions">
        {job.status === "assigned" && <button className="button primary" onClick={() => updateJob(job.id, "in-progress", "Job started")}>Start</button>}
        {job.status === "in-progress" && <button className="button success" onClick={() => updateJob(job.id, "complete", "Job finished")}>Finished</button>}
        {job.status === "help-needed" && <button className="button amber" disabled>Help requested</button>}
        <a className="button secondary" href={navigateUrl} target="_blank" rel="noreferrer">Navigate</a>
        <button className="button secondary" onClick={() => onMileage(job.id)}>Log Mileage</button>
        {job.status !== "help-needed" && <button className="button secondary" onClick={() => updateJob(job.id, "help-needed", "Help requested")}>Need Help</button>}
        <button className="button ghost" onClick={() => onMessage(job.id)}>Contact Dispatcher</button>
      </div>
    </article>
  );
}

function ScheduleView({ jobs, crew, onBack }: { jobs: Job[]; crew: CrewMember[]; onBack: () => void }) {
  const [tab, setTab] = useState<ScheduleTab>("today");
  const visibleJobs = filterScheduleJobs(jobs, tab);
  return <div className="page-view"><button className="back-link page-back" onClick={onBack}>← Back to Command</button><div className="page-title"><span className="eyebrow">Operations</span><h1>Schedule</h1><p>Today, this week, and what is coming next.</p></div><div className="schedule-tabs" role="tablist" aria-label="Schedule range"><button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")} role="tab" aria-selected={tab === "today"}>Today</button><button className={tab === "week" ? "active" : ""} onClick={() => setTab("week")} role="tab" aria-selected={tab === "week"}>This week</button><button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")} role="tab" aria-selected={tab === "upcoming"}>Upcoming</button></div><section className="panel schedule-list">{visibleJobs.length === 0 ? <div className="schedule-empty"><strong>No jobs in this range.</strong><span>New assignments will appear here automatically.</span><button className="button secondary" onClick={onBack}>Create an assignment</button></div> : visibleJobs.map((job) => { const member = crew.find((person) => person.id === job.assigneeId); return <article key={job.id}><span className="schedule-time">{job.scheduleLabel.replace("Today · ", "")}</span><span className={`schedule-line ${job.status}`} /><div><strong>{job.task}</strong><small>{job.location}</small></div><span className={`avatar avatar-${member?.color ?? "blue"}`}>{member?.initials}</span><div className="schedule-person"><strong>{member?.name}</strong><small>{job.id}</small></div><span className={`status-chip ${job.status}`}>{statusLabel(job.status)}</span></article>; })}</section></div>;
}

function CrewView({ crew, jobs, onWorkerView, onAddCrew, onDeleteCrew, onAccessChange, canManageTeam, canManageRoles, onBack }: { crew: CrewMember[]; jobs: Job[]; onWorkerView: (id: string) => void; onAddCrew: () => void; onDeleteCrew: (id: string) => void; onAccessChange: (id: string, access: CrewMember["accessLevel"]) => void; canManageTeam: boolean; canManageRoles: boolean; onBack: () => void }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(1); const pageSize = 50;
  const filteredCrew = crew.filter((member) => `${member.name} ${member.role} ${member.email}`.toLowerCase().includes(query.toLowerCase())); const totalPages = Math.max(1, Math.ceil(filteredCrew.length / pageSize)); const visibleCrew = filteredCrew.slice((page - 1) * pageSize, page * pageSize);
  return <div className="page-view"><button className="back-link page-back" onClick={onBack}>← Back to Command</button><div className="page-title page-title-actions"><div><span className="eyebrow">People and permissions</span><h1>Team</h1><p>Search employees, preview their work, and manage company access.</p></div>{canManageTeam && <button className="button primary" onClick={onAddCrew}>Add team member</button>}</div><div className="team-toolbar"><label>Search team<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, title, or email" /></label><span>{filteredCrew.length} connected · scalable by plan</span></div>{crew.length === 0 ? <section className="team-empty"><span aria-hidden="true">＋</span><h2>No team members yet.</h2><p>Add only your real employees. They remain connected until you deliberately remove them.</p>{canManageTeam && <button className="button primary" onClick={onAddCrew}>Add first team member</button>}<button className="button secondary" onClick={onBack}>Return to Command</button></section> : <><div className="crew-card-grid">{visibleCrew.map((member) => { const memberJobs = jobs.filter((job) => job.assigneeId === member.id); const open = memberJobs.filter((job) => job.status !== "complete"); return <article key={member.id} className="crew-card"><span className={`avatar avatar-${member.color}`}>{member.initials}<i className={`presence ${member.status}`} /></span><div><h2>{member.name}</h2><p>{member.role}</p><small className="crew-access">{member.email}</small></div><span className={`status-chip ${member.status}`}>{member.status === "working" ? "Working" : member.status === "help" ? "Needs help" : "Available"}</span><div className="access-control"><label>Platform access<select value={member.accessLevel} disabled={!canManageRoles} onChange={(event) => onAccessChange(member.id, event.target.value as CrewMember["accessLevel"])}><option value="employee">Employee</option><option value="editor">Editor</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label><p>{member.accessLevel === "admin" ? "Manages team, tasks, and settings." : member.accessLevel === "manager" ? "Manages tasks and views reports." : member.accessLevel === "editor" ? "Creates and edits assignments." : "Views and completes assigned work."}</p></div><div className="crew-card-stats"><span><strong>{open.length}</strong><small>Open</small></span><span><strong>{memberJobs.filter((job) => job.status === "complete").length}</strong><small>Done</small></span></div><div className="crew-card-actions"><button className="button secondary" onClick={() => onWorkerView(member.id)}>Open employee view</button>{canManageTeam && <button className="button danger-light" onClick={() => onDeleteCrew(member.id)}>Remove</button>}</div></article>; })}</div>{totalPages > 1 && <nav className="team-pagination" aria-label="Team pages"><button className="button secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="button secondary" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</>}</div>;
}

const tourSteps = [
  {
    icon: "✦",
    title: "Welcome to your command center",
    text: "Speak. Assign. Done. keeps field work simple: dispatch sends clear jobs, workers update progress, and the company sees what is happening.",
    tip: "This tour stays available from the Tour button at the top.",
  },
  {
    icon: "1",
    title: "Your workspace starts empty",
    text: "The platform never creates demo employees, sample tasks, or placeholder company records. Only information your company adds appears here.",
    tip: "Installing or updating the app never resets your saved team.",
  },
  {
    icon: "2",
    title: "Add your real team",
    text: "Open Team, select Add team member, enter the employee’s details, and choose Employee, Editor, Manager, or Admin access.",
    tip: "Only the owner can appoint elevated roles. Every role is enforced on the server.",
  },
  {
    icon: "3",
    title: "Speak or type the work",
    text: "From Command, describe the employee, address, time, task, requirements, and priority. Review the structured assignment, then send it.",
    tip: "Use the real employee name and work details your team needs.",
  },
  {
    icon: "4",
    title: "Workers run the job",
    text: "The worker view contains only what matters: Start, Navigate, Need Help, Finished, Contact Dispatcher, and Log Mileage.",
    tip: "Select your profile at the top to preview the worker experience.",
  },
  {
    icon: "5",
    title: "Track every business mile",
    text: "Open a worker job and select Log Mileage. Enter starting and ending odometer readings—or the trip miles directly—and record the business purpose.",
    tip: "Dispatch can review totals, trips, workers, jobs, and purposes from Mileage.",
  },
  {
    icon: "✓",
    title: "You are ready to operate",
    text: "Start with your own crew, send your first real assignment, and use the dashboard throughout the workday. Every change is saved to your private workspace.",
    tip: "Install this site on your phone from your browser’s Add to Home Screen or Install App option.",
  },
];

function InstructionTour({ step, setStep, onClose }: { step: number; setStep: (step: number) => void; onClose: () => void }) {
  const item = tourSteps[step];
  const finalStep = step === tourSteps.length - 1;
  return <div className="tour-backdrop"><section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title"><div className="tour-top"><span className="tour-logo"><img src="/sad-royal-silver-v5-192.png" alt="" width="42" height="42" /></span><button onClick={onClose} aria-label="Close instruction guide">Close</button></div><div className="tour-progress" aria-label={`Guide step ${step + 1} of ${tourSteps.length}`}>{tourSteps.map((_, index) => <span key={index} className={index <= step ? "active" : ""} />)}</div><div className="tour-visual"><span>{item.icon}</span></div><span className="eyebrow">Step {step + 1} of {tourSteps.length}</span><h2 id="tour-title">{item.title}</h2><p>{item.text}</p><div className="tour-tip"><strong>Good to know</strong><span>{item.tip}</span></div><div className="tour-actions"><button className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>{finalStep ? <button className="button primary" onClick={onClose}>Go to command center</button> : <button className="button primary" onClick={() => setStep(step + 1)}>Next</button>}</div></section></div>;
}

function MileageView({ mileage, jobs, crew, onBack }: { mileage: MileageEntry[]; jobs: Job[]; crew: CrewMember[]; onBack: () => void }) {
  const total = mileage.reduce((sum, entry) => sum + entry.miles, 0);
  const byCrew = crew
    .map((member) => ({ member, miles: mileage.filter((entry) => entry.crewId === member.id).reduce((sum, entry) => sum + entry.miles, 0) }))
    .filter((item) => item.miles > 0)
    .sort((a, b) => b.miles - a.miles);

  return <div className="page-view"><button className="back-link page-back" onClick={onBack}>← Back to Command</button><div className="page-title"><span className="eyebrow">Vehicle records</span><h1>Mileage</h1><p>Track every work trip by employee and job.</p></div><section className="mileage-explainer" aria-labelledby="mileage-how-title"><div><span className="eyebrow">Simple and accountable</span><h2 id="mileage-how-title">How mileage is tracked</h2><p>A worker opens an assigned job, selects <strong>Log Mileage</strong>, then enters either the starting and ending odometer or the trip miles directly. The app securely saves the employee, job, date, mileage, and business purpose to this company workspace.</p></div><ol><li><span>1</span><strong>Open the job</strong></li><li><span>2</span><strong>Enter the miles</strong></li><li><span>3</span><strong>Save the purpose</strong></li></ol></section><div className="mileage-summary"><article><span>Total recorded</span><strong>{total.toFixed(1)}</strong><small>miles</small></article><article><span>Trips logged</span><strong>{mileage.length}</strong><small>trips</small></article><article><span>Average trip</span><strong>{mileage.length ? (total / mileage.length).toFixed(1) : "0.0"}</strong><small>miles</small></article></div><div className="mileage-layout"><section className="panel mileage-table"><div className="panel-heading"><div><span className="eyebrow">Trip history</span><h2>Recorded mileage</h2></div></div>{mileage.length === 0 ? <div className="mileage-empty"><strong>No mileage logged yet.</strong><span>Open an employee’s assigned job and select Log Mileage.</span><button className="button secondary" onClick={onBack}>Return to Command</button></div> : mileage.map((entry) => { const member = crew.find((person) => person.id === entry.crewId); const job = jobs.find((item) => item.id === entry.jobId); return <article key={entry.id}><span className={`avatar avatar-${member?.color ?? "blue"}`}>{member?.initials ?? "?"}</span><div><strong>{member?.name ?? "Crew member"}</strong><small>{entry.date} · {job?.id ?? "General trip"}</small></div><div><strong>{entry.purpose}</strong><small>{job?.location ?? "Company travel"}</small></div><span className="miles-value">{entry.miles.toFixed(1)} mi</span></article>; })}</section><aside className="panel mileage-by-crew"><div className="panel-heading"><div><span className="eyebrow">Breakdown</span><h2>By crew member</h2></div></div>{byCrew.length === 0 ? <div className="mileage-empty">No totals yet.</div> : byCrew.map(({ member, miles }) => <div className="mileage-person" key={member.id}><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.role}</small></span><b>{miles.toFixed(1)} mi</b></div>)}</aside></div></div>;
}

function MileageModal({ job, crew, onSave, onClose }: { job?: Job; crew: CrewMember[]; onSave: (entry: Omit<MileageEntry, "id" | "createdAt">) => void; onClose: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [directMiles, setDirectMiles] = useState("");
  const [purpose, setPurpose] = useState(job ? `Travel to ${job.location}` : "Business travel");
  if (!job) return null;
  const miles = directMiles ? Number(directMiles) : start && end ? Number(end) - Number(start) : 0;

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal mileage-modal" role="dialog" aria-modal="true" aria-labelledby="mileage-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">{job.id}</span><h2 id="mileage-title">Log Mileage</h2></div><button className="close-button" onClick={onClose} aria-label="Close mileage form">×</button></div><div className="help-job"><strong>{job.task}</strong><span>{job.location}</span></div><label>Worker<select value={job.assigneeId} disabled>{crew.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div className="form-grid mileage-fields"><label>Starting odometer<input inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} placeholder="24,120.3" /></label><label>Ending odometer<input inputMode="decimal" value={end} onChange={(event) => setEnd(event.target.value)} placeholder="24,136.8" /></label></div><div className="or-divider"><span>or</span></div><label>Trip miles<input inputMode="decimal" value={directMiles} onChange={(event) => setDirectMiles(event.target.value)} placeholder="Enter miles directly" /></label><label>Business purpose<input value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><div className="mileage-total"><span>Mileage to record</span><strong>{Math.max(0, miles).toFixed(1)} miles</strong></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!Number.isFinite(miles) || miles <= 0} onClick={() => onSave({ crewId: job.assigneeId, jobId: job.id, date: new Date().toLocaleDateString("en-US"), miles, startOdometer: start ? Number(start) : undefined, endOdometer: end ? Number(end) : undefined, purpose })}>Save mileage</button></div></section></div>;
}

function AddCrewModal({ defaultRole, canManageRoles, onSave, onClose }: { defaultRole: CompanyProfile["defaultRole"]; canManageRoles: boolean; onSave: (member: Omit<CrewMember, "id" | "initials" | "status" | "color">) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [accessLevel, setAccessLevel] = useState<CrewMember["accessLevel"]>(canManageRoles ? defaultRole : "employee");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="crew-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Company team</span><h2 id="crew-title">Add team member</h2></div><button className="close-button" onClick={onClose} aria-label="Close team form">×</button></div><label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee name" autoComplete="name" /></label><label>Job title<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Manager, technician, assistant…" /></label><label>Platform access<select value={accessLevel} disabled={!canManageRoles} onChange={(event) => setAccessLevel(event.target.value as CrewMember["accessLevel"])}><option value="employee">Employee — assigned work only</option><option value="editor">Editor — create and edit tasks</option><option value="manager">Manager — tasks and reports</option><option value="admin">Admin — team, tasks, and settings</option></select><small>Only the owner can appoint Admin, Manager, or Editor access.</small></label><label>Sign-in email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="employee@example.com" autoComplete="email" /><small>Use the exact email the employee uses for secure sign-in.</small></label><label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" autoComplete="tel" /></label><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name.trim() || !role.trim() || !validEmail} onClick={() => onSave({ name: name.trim(), role: role.trim(), accessLevel, email: email.trim().toLowerCase(), phone: phone.trim() })}>Add team member</button></div></section></div>;
}

function ConfirmDeleteMember({ member, onConfirm, onClose }: { member?: CrewMember; onConfirm: () => void; onClose: () => void }) {
  if (!member) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-description" onMouseDown={(event) => event.stopPropagation()}><div className="confirm-icon" aria-hidden="true">!</div><h2 id="confirm-delete-title">Remove {member.name}?</h2><p id="confirm-delete-description">This deliberately removes their company access, assigned jobs, and mileage records from this workspace. This action cannot be undone.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button danger" onClick={onConfirm}>Yes, remove team member</button></div></section></div>;
}

function HelpModal({ job, crew, onAssign, onClose }: { job?: Job; crew: CrewMember[]; onAssign: (jobId: string, helperId: string) => void; onClose: () => void }) {
  if (!job) return null;
  const available = crew.filter((member) => member.id !== job.assigneeId);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Help request</span><h2 id="help-title">Assign a helper</h2></div><button className="close-button" onClick={onClose} aria-label="Close help request">×</button></div><div className="help-job"><strong>{job.task}</strong><span>{job.location} · {job.id}</span></div><div className="helper-options">{available.map((member) => <button key={member.id} onClick={() => onAssign(job.id, member.id)}><span className={`avatar avatar-${member.color}`}>{member.initials}</span><span><strong>{member.name}</strong><small>{member.role}</small></span><span className="status-chip available">Send help</span></button>)}</div></section></div>;
}

function MessageModal({ job, crew, role, messageText, setMessageText, sendMessage, onClose }: { job?: Job; crew: CrewMember[]; role: Role; messageText: string; setMessageText: (value: string) => void; sendMessage: () => void; onClose: () => void }) {
  if (!job) return null;
  const member = crew.find((person) => person.id === job.assigneeId);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal message-modal" role="dialog" aria-modal="true" aria-labelledby="message-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">{job.id}</span><h2 id="message-title">{role === "dispatcher" ? member?.name : "Contact Dispatcher"}</h2></div><button className="close-button" onClick={onClose} aria-label="Close messages">×</button></div><div className="message-job">{job.task}<small>{job.location}</small></div><div className="message-thread">{job.messages.length === 0 ? <div className="empty-messages">No messages yet. Start the conversation about this job.</div> : job.messages.map((message) => <div key={message.id} className={`message ${message.sender === role ? "mine" : "theirs"}`}><span>{message.text}</span><small>{message.time}</small></div>)}</div><div className="message-compose"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Type a private job message…" aria-label="Job message" /><button className="button primary" onClick={sendMessage}>Send</button></div></section></div>;
}
