export function terminalLength(lines: string[]) {
  return lines.filter(line => line.startsWith('$')).reduce((n, line) => n + line.length, 0);
}

export function terminalFrame(lines: string[], characters: number) {
  const frame: { text: string; isCommand: boolean; isActive: boolean }[] = [];
  let remaining = Math.max(0, characters);
  let lastCommand = -1;
  lines.forEach((line, index) => { if (line.startsWith('$')) lastCommand = index; });
  for (let i = 0; i <= lastCommand; i++) {
    const line = lines[i], isCommand = line.startsWith('$');
    if (!isCommand) {
      frame.push({ text: line, isCommand, isActive: false });
      continue;
    }
    const finished = remaining >= line.length;
    frame.push({ text: line.slice(0, remaining), isCommand, isActive: !finished || i === lastCommand });
    if (!finished) break;
    remaining -= line.length;
  }
  return frame;
}
