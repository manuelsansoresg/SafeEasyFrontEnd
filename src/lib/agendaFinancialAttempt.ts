// A pending financial command survives modal closure and page reload in this tab.
// This storage contains replay credentials. Never log its contents or share them.
export function readFinancialAttempt<T>(scope: string): T | null {
  const raw = window.sessionStorage.getItem(`agenda-financial-attempt:${scope}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; }
  catch { throw new Error('No pudimos recuperar el intento pendiente. Revisa la reservación antes de continuar.'); }
}
export function writeFinancialAttempt(scope: string, value: unknown) {
  window.sessionStorage.setItem(`agenda-financial-attempt:${scope}`, JSON.stringify(value));
}
export function clearFinancialAttempt(scope: string) {
  window.sessionStorage.removeItem(`agenda-financial-attempt:${scope}`);
}
