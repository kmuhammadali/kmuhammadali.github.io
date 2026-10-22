const characters = '!<>-_\\/[]{}=+*^?#';
export const SCRAMBLE_CYCLE_MS = 4200;
export const SCRAMBLE_HOLD_MS = 2400;
/** Preserve spaces and glyph count; reveal the original label from left to right. */
export function endMarkerFrame(label: string, elapsed: number, random = Math.random) {
  const phase = Math.max(0, elapsed) % SCRAMBLE_CYCLE_MS;
  if (phase < SCRAMBLE_HOLD_MS) return label;
  const progress = (phase - SCRAMBLE_HOLD_MS) / (SCRAMBLE_CYCLE_MS - SCRAMBLE_HOLD_MS);
  const revealed = Math.floor(progress * label.length);
  return [...label].map((character, index) => index < revealed || character === ' '
    ? character : characters[Math.min(characters.length - 1, Math.floor(random() * characters.length))]).join('');
}
