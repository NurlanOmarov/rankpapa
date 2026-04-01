import fs from 'fs';
import path from 'path';

/**
 * Profile Manager — persistent browser state (cookies + localStorage) per keyword.
 *
 * Checklist #10: reuse cookies/localStorage across visits to look like a returning user.
 * Checklist #1:  rotate the profile after 4–7 uses so the same fingerprint isn't reused forever.
 *
 * Each keyword gets its own profile slot. After randInt(4,7) uses the slot is reset
 * and a fresh profile is created on the next visit.
 */

interface ProfileSlot {
  filePath: string;
  useCount: number;
  maxUses: number; // randomly chosen between 4–7
}

const PROFILES_DIR = process.env.PROFILES_DIR ?? '/tmp/rp-profiles';

// Ensure the directory exists once at module load
fs.mkdirSync(PROFILES_DIR, { recursive: true });

// In-memory map: keywordId → current profile slot
const slots = new Map<string, ProfileSlot>();

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns the storageState file path to use for this keyword visit.
 * If the file doesn't exist yet, returns the path anyway — Playwright will
 * create it on first save (launchSession skips loading if file is absent).
 */
export function getProfilePath(keywordId: string): string {
  const slot = slots.get(keywordId);

  if (slot && slot.useCount < slot.maxUses) {
    slot.useCount++;
    return slot.filePath;
  }

  // Rotate: delete old file if it exists
  if (slot?.filePath) {
    try { fs.unlinkSync(slot.filePath); } catch {}
  }

  const filePath = path.join(PROFILES_DIR, `${keywordId}-${Date.now()}.json`);
  slots.set(keywordId, { filePath, useCount: 1, maxUses: randInt(4, 7) });
  return filePath;
}

/**
 * Save the browser context's storage state to the profile file.
 * Called after a successful visit so the next visit loads the saved cookies.
 */
export async function saveProfile(
  context: import('playwright').BrowserContext,
  keywordId: string,
): Promise<void> {
  const slot = slots.get(keywordId);
  if (!slot) return;
  try {
    await context.storageState({ path: slot.filePath });
  } catch {
    // Non-fatal — next visit just starts fresh
  }
}
