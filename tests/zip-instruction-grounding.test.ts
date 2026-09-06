import test from 'node:test'; import assert from 'node:assert/strict';
import { validateZipModelResult } from '../lib/zip/output-validator.ts';
import { createApprovedJob } from '../lib/zip/approval.ts';
import type { VerifiedZipContext } from '../lib/zip/contracts.ts';
const context: VerifiedZipContext = { company: { sourceId: 'company', name: 'Company', policies: [] }, preset: { sourceId: 'procedure', name: 'Clean', purpose: 'Clean', steps: ['Clean the floor.'], safetyRules: [], evidence: [], completionDefinition: 'Clean floor' }, employee: { sourceId: 'employee', displayName: 'Jordan', role: 'Tech', department: 'Ops', authorizedJobTypes: ['job'], training: [], preferredLanguage: 'English', communicationDetail: 'brief', responsibilities: [] } };
const ready = (text: string) => ({ status: 'ready', professionalAssignment: text, sourceIds: ['company', 'procedure', 'employee'], checklist: ['Clean the floor.'], unsupportedClaims: [] });
test('an explicit instruction deadline is usable without storing raw words as company knowledge', () => {
  const before = JSON.stringify(context);
  assert.equal(validateZipModelResult(ready('Clean the floor by 3 PM.'), context, 'Clean the floor by 3 PM.').status, 'ready');
  assert.equal(JSON.stringify(context), before);
});
test('an invented deadline remains rejected even when other instruction details are supplied', () => {
  assert.equal(validateZipModelResult(ready('Clean the floor by 4 PM.'), context, 'Clean the floor by 3 PM.').status, 'invalid');
});
test('instruction text cannot inject new checklist procedures', () => {
  assert.equal(validateZipModelResult({ ...ready('Clean the floor.'), checklist: ['Mix unknown chemicals.'] }, context, 'Mix unknown chemicals.').status, 'invalid');
});
test('the company time zone controls approval event labels', () => {
  const pending = { draftId: 'd1', ownerEmail: 'owner@test.test', assigneeId: 'crew-1', professionalAssignment: 'Clean.', checklist: [], createdBy: 'owner@test.test', createdAt: '2026-09-06T12:00:00Z', expiresAt: '2026-09-06T12:15:00Z' };
  const job = createApprovedJob(pending, 'Clean.', [], '2026-09-06T12:00:00Z', 'America/Chicago');
  assert.equal(job.createdAt, '7:00 AM');
  job.messages.push({ id: 'message-1', sender: 'worker', text: 'Started.', time: '7:01 AM' });
  assert.equal(job.messages.length, 1);
});
