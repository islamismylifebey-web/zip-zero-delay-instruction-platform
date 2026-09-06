import type { VerifiedZipContext, ZipContextSource, ZipDraftRequest } from './contracts.ts';

export type ZipContextError = 'employee_not_found' | 'preset_not_found' | 'company_mismatch' | 'job_not_authorized';
export type ZipContextResult = { ok: true; context: VerifiedZipContext } | { ok: false; code: ZipContextError };

export function buildVerifiedContext(request: ZipDraftRequest, source: ZipContextSource): ZipContextResult {
  const employee = source.employees.find((item) => item.id === request.employeeId);
  if (!employee) return { ok: false, code: 'employee_not_found' };
  const preset = source.presets.find((item) => item.id === request.presetId);
  if (!preset) return { ok: false, code: 'preset_not_found' };
  if (employee.authorizedJobTypes.length > 0 && !employee.authorizedJobTypes.includes(preset.id)) {
    return { ok: false, code: 'job_not_authorized' };
  }

  return {
    ok: true,
    context: {
      company: { sourceId: source.company.sourceId, name: source.company.name, policies: [...source.company.policies] },
      preset: { sourceId: preset.sourceId, name: preset.name, purpose: preset.purpose, steps: [...preset.steps], safetyRules: [...preset.safetyRules], evidence: [...preset.evidence], completionDefinition: preset.completionDefinition },
      employee: { sourceId: employee.sourceId, displayName: employee.displayName, role: employee.role, department: employee.department, authorizedJobTypes: [...employee.authorizedJobTypes], training: [...employee.training], preferredLanguage: employee.preferredLanguage, communicationDetail: employee.communicationDetail, responsibilities: [...employee.responsibilities] },
    },
  };
}
