/**
 * ProjectSettingsPanel — Integrations category removed.
 * This panel previously exposed GitHub/GitLab/Figma/Google Drive sync
 * configuration. That category has been hidden per product decision.
 *
 * The component is kept as a stub so any existing import sites don't break.
 */

interface Props {
  projectId: string;
  onClose: () => void;
}

export default function ProjectSettingsPanel(_props: Props) {
  return null;
}
