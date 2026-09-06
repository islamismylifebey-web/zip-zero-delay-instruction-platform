import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovedJob, createPendingZipDraft } from '../lib/zip/approval.ts';
import { initialZipUiState, zipUiReducer } from '../lib/zip/ui-state.ts';

const pending = createPendingZipDraft({ draftId: 'draft-1', ownerEmail: 'owner@example.com', assigneeId: 'crew-1', professionalAssignment: 'Clean the floor.', checklist: ['Place safety signs.'], createdBy: 'owner@example.com', createdAt: '2026-09-06T08:00:00.000Z', expiresAt: '2026-09-06T08:15:00.000Z' });
function reviewedState() {
  const drafting = zipUiReducer(initialZipUiState, { type: 'DRAFT_START' });
  return zipUiReducer(drafting, { type: 'REVIEW', draftId: pending.draftId, professionalAssignment: pending.professionalAssignment, checklist: pending.checklist });
}

test('approved work retains a draft receipt for safe retries without retaining raw speech', () => {
  const job = createApprovedJob(pending, 'Clean the floor, then notify dispatch.', [], '2026-09-06T08:03:00.000Z');
  assert.equal(job.zipDraftId, pending.draftId);
  assert.equal('rawInstruction' in job, false);
  assert.equal('sourceText' in job, false);
});
test('voice input can enter drafting while the microphone is active', () => {
  const listening = zipUiReducer(initialZipUiState, { type: 'LISTEN_START' });
  const drafting = zipUiReducer(listening, { type: 'DRAFT_START' });
  assert.equal(drafting.phase, 'drafting');
  assert.equal(zipUiReducer(drafting, { type: 'LISTEN_STOP' }).phase, 'drafting');
});
test('voice can be retried after a capture error', () => {
  const failed = zipUiReducer(initialZipUiState, { type: 'ERROR', message: 'Microphone unavailable.' });
  assert.equal(zipUiReducer(failed, { type: 'LISTEN_START' }).phase, 'listening');
});
test('approval failure returns to the same review rather than losing the draft', () => {
  const approving = zipUiReducer(reviewedState(), { type: 'APPROVE_START' });
  const failed = zipUiReducer(approving, { type: 'ERROR', message: 'Workspace changed. Retry.' });
  assert.equal(failed.phase, 'review');
  assert.equal(failed.draftId, pending.draftId);
  assert.equal(failed.error, 'Workspace changed. Retry.');
  assert.equal(zipUiReducer(failed, { type: 'APPROVE_START' }).error, '');
});
test('a late duplicate approval click cannot create a new state transition', () => {
  const approving = zipUiReducer(reviewedState(), { type: 'APPROVE_START' });
  assert.deepEqual(zipUiReducer(approving, { type: 'APPROVE_START' }), approving);
});
test('approval cannot be claimed without the approving state', () => {
  assert.equal(zipUiReducer(reviewedState(), { type: 'APPROVED' }).phase, 'review');
});
