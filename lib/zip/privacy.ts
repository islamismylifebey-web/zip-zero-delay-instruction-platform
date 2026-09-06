export function stripRawInstructionFields<T extends { jobs: unknown[] }>(workspace: T): T {
  return {
    ...workspace,
    jobs: workspace.jobs.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const safe = { ...item } as Record<string, unknown>;
      delete safe.sourceText;
      delete safe.rawInstruction;
      return safe;
    }),
  } as T;
}
