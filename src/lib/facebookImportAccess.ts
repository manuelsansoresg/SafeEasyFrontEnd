// Temporary frontend rollout while Meta reviews the import permissions.
// API authorization remains the backend's responsibility.
export function canAccessFacebookImport(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === "manuellorenzosansoresbriceno@gmail.com";
}
