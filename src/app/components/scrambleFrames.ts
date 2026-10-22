const characters = '!<>-_\\/[]{}=+*^?#';
export const SCRAMBLE_CYCLE_MS = 4200;
export const SCRAMBLE_HOLD_MS = 2400;
export const SCRAMBLE_ONCE_MS = 1100;
const palette = ['#00ff41', '#00ff41', '#00ff41', '#00ff41', '#00ff41', '#00e5ff', '#00e5ff', '#00e5ff', '#00e5ff', '#518dff', '#518dff', '#518dff', '#c084fc', '#c084fc', '#c084fc', '#ffffff'];
/** Only unresolved glyphs receive color. Settled text inherits its existing theme. */
export function scrambleColor(originalCharacter: string, displayCharacter: string, index: number) {
  if (originalCharacter === displayCharacter || /\s/.test(originalCharacter)) return undefined;
  return palette[((displayCharacter.codePointAt(0) ?? 0) * 7 + index * 17) % palette.length];
}
export function revealScrambleFrame(label: string, progress: number, random = Math.random) {
  const glyphs = [...label];
  const revealed = Math.floor(Math.max(0, Math.min(1, progress)) * glyphs.length);
  return glyphs.map((character, index) => index < revealed || /\s/.test(character)
    ? character : characters[Math.min(characters.length - 1, Math.floor(random() * characters.length))]).join('');
}
/** Preserve spaces and glyph count; reveal the original label from left to right. */
export function endMarkerFrame(label: string, elapsed: number, random = Math.random) {
  const phase = Math.max(0, elapsed) % SCRAMBLE_CYCLE_MS;
  return phase < SCRAMBLE_HOLD_MS ? label
    : revealScrambleFrame(label, (phase - SCRAMBLE_HOLD_MS) / (SCRAMBLE_CYCLE_MS - SCRAMBLE_HOLD_MS), random);
}
