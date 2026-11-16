/**
 * قفل خصوصية بسيط بالرقم السري (4 أرقام). الرقم بيتخزن مشفّر (SHA-256 + salt) على الجهاز.
 * ده قفل خصوصية لمنع الفتح العادي، مش تشفير للبيانات المحفوظة في المتصفح.
 */
const LOCK_KEY = "trackYourSales.lock.v1";
const SESSION_KEY = "tys.unlocked";
const AWAY_KEY = "tys.hiddenAt";
export const AWAY_LOCK_MS = 2 * 60 * 1000;

type StoredLock = { salt: string; hash: string };

function readStored(): StoredLock | null {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLock>;
    if (typeof parsed.salt === "string" && typeof parsed.hash === "string") return { salt: parsed.salt, hash: parsed.hash };
  } catch {
    // تجاهل أي خطأ قراءة.
  }
  return null;
}

async function digest(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isLockEnabled(): boolean {
  return readStored() !== null;
}

export function isPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function setLockPin(pin: string): Promise<void> {
  if (!isPinFormat(pin)) throw new Error("الرقم السري لازم يكون 4 أرقام");
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await digest(pin, salt);
  window.localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash }));
  markUnlocked();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = readStored();
  if (!stored) return true;
  return (await digest(pin, stored.salt)) === stored.hash;
}

export function removeLock(): void {
  try {
    window.localStorage.removeItem(LOCK_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // تجاهل.
  }
}

export function markUnlocked(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
    window.sessionStorage.removeItem(AWAY_KEY);
  } catch {
    // تجاهل.
  }
}

export function needsUnlock(): boolean {
  if (!isLockEnabled()) return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export function noteHidden(): void {
  try {
    window.sessionStorage.setItem(AWAY_KEY, String(Date.now()));
  } catch {
    // تجاهل.
  }
}

/** لو التطبيق غاب أكتر من دقيقتين، بنقفله تاني. */
export function lockIfAwayTooLong(): boolean {
  if (!isLockEnabled()) return false;
  try {
    const hiddenAt = Number(window.sessionStorage.getItem(AWAY_KEY) ?? "");
    if (Number.isFinite(hiddenAt) && hiddenAt > 0 && Date.now() - hiddenAt > AWAY_LOCK_MS) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return true;
    }
  } catch {
    // تجاهل.
  }
  return false;
}
