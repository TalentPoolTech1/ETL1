export function formatExecutionTabName(
  entityName: string | null | undefined,
  runId: string,
): string {
  const trimmedName = entityName?.trim();
  const shortRunId = runId.slice(0, 8);
  return `${trimmedName && trimmedName.length > 0 ? trimmedName : 'Execution'} (${shortRunId})`;
}

export function formatExecutionHierarchyPath(
  entityName: string | null | undefined,
  runId: string,
  rootLabel = 'Executions',
): string {
  return `${rootLabel} → ${formatExecutionTabName(entityName, runId)}`;
}
