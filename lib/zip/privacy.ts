export function stripRawInstructionFields<T extends { jobs: unknown[] }>(workspace: T): T {
  return {
    ...workspace,
    jobs: workspace.jobs.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const { sourceText: _discarded, rawInstruction: _rawInstruction, ...safe } = item as Record<string, unknown>;
      return safe;
    }),
  } as T;
}
