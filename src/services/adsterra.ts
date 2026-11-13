/**
 * Adsterra Monetization & Smartlinks Integration
 * Placements provided by site owner:
 * 1. Smartlink_1 (ID: 28634833) -> https://asiafilm.org/4/c2b46070b44982014166acafd6074c3d
 * 2. Smartlink_2 (ID: 28731465) -> https://asiafilm.org/4/3711015d24018cf89ccb362976c4a2e0
 * 3. Smartlink_3 (ID: 30967579) -> https://asiafilm.org/4/dc01c1237bd130c5ef9bcfef4f0928ed
 */

export const ADSTERRA_SMARTLINKS = [
  'https://asiafilm.org/4/c2b46070b44982014166acafd6074c3d',
  'https://asiafilm.org/4/3711015d24018cf89ccb362976c4a2e0',
  'https://asiafilm.org/4/dc01c1237bd130c5ef9bcfef4f0928ed',
] as const;

let currentIndex = 0;

export function getNextAdsterraLink(): string {
  const link = ADSTERRA_SMARTLINKS[currentIndex % ADSTERRA_SMARTLINKS.length];
  currentIndex = (currentIndex + 1) % ADSTERRA_SMARTLINKS.length;
  return link;
}

export function getAdsterraLinkByIndex(index: number): string {
  return ADSTERRA_SMARTLINKS[Math.abs(index) % ADSTERRA_SMARTLINKS.length];
}

/**
 * Opens an Adsterra Smartlink cleanly via a native anchor click inside a user gesture,
 * ensuring high CPM/CPA delivery without popup-blocker issues.
 */
export function triggerSmartlink(onComplete?: () => void): string {
  const link = getNextAdsterraLink();
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
    } catch (err) {
      console.warn('Adsterra smartlink navigation skipped:', err);
    }
  }

  if (onComplete) {
    setTimeout(onComplete, 250);
  }
  return link;
}
