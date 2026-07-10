export interface ProvisionWorkspaceCommand {
  productKey: string;
  workspaceName: string;
  companyName?: string;
  industry?: string;
  size?: string;
  // NOTE: Identity is derived from JWT, so there are NO user fields here.
}

export interface ProvisionWorkspaceResponse {
  workspaceId: string;
  workspaceName: string;
  status: 'ACTIVE' | 'INITIALIZING';
  message: string;
}
