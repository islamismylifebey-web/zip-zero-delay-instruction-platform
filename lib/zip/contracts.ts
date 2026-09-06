export type ZipDraftRequest = {
  employeeId: string;
  presetId: string;
  rawInstruction: string;
};

export type ZipCompanyContext = { sourceId: string; name: string; policies: string[] };
export type ZipPresetContext = { sourceId: string; id: string; name: string; purpose: string; steps: string[]; safetyRules: string[]; evidence: string[]; completionDefinition: string };
export type ZipEmployeeContext = { sourceId: string; id: string; displayName: string; role: string; department: string; authorizedJobTypes: string[]; training: string[]; preferredLanguage: string; communicationDetail: "brief" | "standard" | "detailed"; responsibilities: string[] };
export type ZipContextSource = { company: ZipCompanyContext; presets: ZipPresetContext[]; employees: ZipEmployeeContext[] };
export type VerifiedZipContext = { company: ZipCompanyContext; preset: Omit<ZipPresetContext, "id">; employee: Omit<ZipEmployeeContext, "id"> };
export type ZipModelReady = { status: "ready"; professionalAssignment: string; sourceIds: string[]; checklist: string[]; unsupportedClaims: string[] };
export type ZipModelClarification = { status: "needs_clarification"; clarifyingQuestion: string; missingFields: string[]; conflictingFields: string[] };
export type ZipModelResult = ZipModelReady | ZipModelClarification;
export type ZipDraftResult = | { status: "ready"; draftId: string; professionalAssignment: string; checklist: string[] } | { status: "needs_clarification"; clarifyingQuestion: string; fields: string[] } | { status: "temporarily_unavailable"; retryable: true; code: "timeout" | "provider_error" | "invalid_output" };
export type ApprovedZipAssignment = { draftId: string; assigneeId: string; professionalAssignment: string; checklist: string[]; approvedAt: string; approvedBy: string };
