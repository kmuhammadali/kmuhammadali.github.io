import { useTextScramble } from './useTextScramble';

export function TextScramble({ text }: { text: string }) {
  const display = useTextScramble(text);
  return (
    <span data-end-marker className="inline-grid font-mono text-sm whitespace-pre">
      <span aria-hidden="true" className="invisible [grid-area:1/1]">{text}</span>
      <span aria-hidden="true" className="[grid-area:1/1]">{display}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
