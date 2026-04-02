/**
 * Legacy PropertiesPanel shim.
 *
 * Pipeline designer editing now uses the embedded NodeConfigPanel inside
 * PipelineWorkspace. We keep this component as a no-op so any stale mount path
 * or hot-reload residue cannot render a second competing sidebar.
 */
export function PropertiesPanel() {
  return null;
}
