/**
 * Adsterra Monetization & Smartlinks Integration
 * Active Zone: smart-link-3170056
 * 1. Smartlink_1 (ID: 28634833) -> https://asiafilm.org/4/c2b46070b44982014166acafd6074c3d
 * 2. Smartlink_2 (ID: 28731465) -> https://asiafilm.org/4/3711015d24018cf89ccb362976c4a2e0
 * 3. Smartlink_3 (ID: 30967579) -> https://asiafilm.org/4/dc01c1237bd130c5ef9bcfef4f0928ed
 */

export interface AdsterraPlacement {
  zoneName: string;
  placementName: string;
  placementId: string;
  url: string;
}

export const ADSTERRA_PLACEMENTS: readonly AdsterraPlacement[] = [
  {
    zoneName: 'smart-link-3170056',
    placementName: 'Smartlink_1',
    placementId: '28634833',
    url: 'https://asiafilm.org/4/c2b46070b44982014166acafd6074c3d',
  },
  {
    zoneName: 'smart-link-3170056',
    placementName: 'Smartlink_2',
    placementId: '28731465',
    url: 'https://asiafilm.org/4/3711015d24018cf89ccb362976c4a2e0',
  },
  {
    zoneName: 'smart-link-3170056',
    placementName: 'Smartlink_3',
    placementId: '30967579',
    url: 'https://asiafilm.org/4/dc01c1237bd130c5ef9bcfef4f0928ed',
  },
] as const;

export const ADSTERRA_SMARTLINKS = [
  ADSTERRA_PLACEMENTS[0].url,
  ADSTERRA_PLACEMENTS[1].url,
  ADSTERRA_PLACEMENTS[2].url,
] as const;

const AD_COOLDOWN_KEY = 'hd_adsterra_last_ts';
let currentIndex = 0;
let memoryLastTriggeredAt = 0;

export function getNextAdsterraLink(): string {
  const link = ADSTERRA_SMARTLINKS[currentIndex % ADSTERRA_SMARTLINKS.length];
  currentIndex = (currentIndex + 1) % ADSTERRA_SMARTLINKS.length;
  return link;
}

export function getAdsterraLinkByIndex(index: number): string {
  return ADSTERRA_SMARTLINKS[Math.abs(index) % ADSTERRA_SMARTLINKS.length];
}

function getLastTriggeredTimestamp(): number {
  if (typeof window === 'undefined') return memoryLastTriggeredAt;
  try {
    const raw = window.sessionStorage.getItem(AD_COOLDOWN_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? Math.max(parsed, memoryLastTriggeredAt) : memoryLastTriggeredAt;
  } catch {
    return memoryLastTriggeredAt;
  }
}

function markTriggeredTimestamp(ts: number): void {
  memoryLastTriggeredAt = ts;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AD_COOLDOWN_KEY, String(ts));
  } catch {
    // Ignore restricted sessionStorage errors
  }
}

/**
 * Opens an Adsterra Smartlink cleanly via a native anchor click inside a user gesture,
 * ensuring reliable delivery without window.open calls.
 */
export function triggerSmartlink(onComplete?: () => void, slotIndex?: number): string {
  const link = typeof slotIndex === 'number' ? getAdsterraLinkByIndex(slotIndex) : getNextAdsterraLink();
  if (typeof document !== 'undefined') {
    try {
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      markTriggeredTimestamp(Date.now());
    } catch (err) {
      console.warn('Adsterra smartlink navigation skipped:', err);
    }
  }

  if (onComplete) {
    setTimeout(onComplete, 250);
  }
  return link;
}

/**
 * Activates a rotated Adsterra Smartlink on high-intent streaming interactions
 * while enforcing a cooldown window so users are never spammed on consecutive clicks.
 */
export function triggerSmartlinkWithCooldown(cooldownMs = 45000, slotIndex?: number): boolean {
  if (typeof document === 'undefined') return false;
  const now = Date.now();
  const last = getLastTriggeredTimestamp();
  if (now - last < cooldownMs) {
    return false;
  }
  triggerSmartlink(undefined, slotIndex);
  return true;
}
