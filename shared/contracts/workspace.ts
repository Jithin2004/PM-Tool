export interface InitializeWorkspaceCommand {
  workspaceId: string;
  // Payload for setting up initial projects, default settings, etc.
}

export interface AcceptInvitationCommand {
  invitationToken: string;
}
