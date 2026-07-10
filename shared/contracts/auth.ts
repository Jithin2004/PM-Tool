export interface CompleteUserProfileCommand {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  // Identity derived from JWT
}
