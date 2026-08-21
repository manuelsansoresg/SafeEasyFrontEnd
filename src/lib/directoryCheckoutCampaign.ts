const DIRECTORY_CHECKOUT_CONTEXT_KEY = "drooopy:directory-checkout-context";

type DirectoryCheckoutContext = {
  email: string;
  confirmed: boolean;
  createdAt: number;
};

const DIRECTORY_CHECKOUT_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

export const saveDirectoryCheckoutContext = (email: string) => {
  if (typeof window === "undefined") return;
  const context: DirectoryCheckoutContext = {
    email: email.trim(),
    confirmed: false,
    createdAt: Date.now(),
  };
  window.sessionStorage.setItem(DIRECTORY_CHECKOUT_CONTEXT_KEY, JSON.stringify(context));
};

export const readDirectoryCheckoutContext = (): DirectoryCheckoutContext | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(DIRECTORY_CHECKOUT_CONTEXT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const email = record.email;
    const createdAt = record.createdAt;
    if (typeof email !== "string" || !email.trim() || typeof createdAt !== "number") return null;
    if (Date.now() - createdAt > DIRECTORY_CHECKOUT_CONTEXT_TTL_MS) {
      window.sessionStorage.removeItem(DIRECTORY_CHECKOUT_CONTEXT_KEY);
      return null;
    }
    return {
      email: email.trim(),
      confirmed: record.confirmed === true,
      createdAt,
    };
  } catch {
    return null;
  }
};

export const confirmDirectoryCheckoutContext = () => {
  if (typeof window === "undefined") return false;
  const context = readDirectoryCheckoutContext();
  if (!context) return false;
  window.sessionStorage.setItem(
    DIRECTORY_CHECKOUT_CONTEXT_KEY,
    JSON.stringify({ ...context, confirmed: true }),
  );
  return true;
};
