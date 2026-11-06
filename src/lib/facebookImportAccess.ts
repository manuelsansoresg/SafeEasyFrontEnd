// Temporary frontend rollout while Meta reviews the import permissions.
// API authorization remains the backend's responsibility.
export function canAccessFacebookImport(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail === "manuellorenzosansoresbriceno@gmail.com" || normalizedEmail === "estilista@test.com";
}
