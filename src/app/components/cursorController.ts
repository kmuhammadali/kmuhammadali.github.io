interface CursorNodes {
  host: HTMLElement; layer: HTMLElement; point: HTMLElement; halo: HTMLElement;
  onRipple: (x: number, y: number) => void;
}
/** Pointer movement stays outside React and uses a single settling animation frame. */
export function installPortfolioCursor({ host, layer, point, halo, onRipple }: CursorNodes) {
  const doc = host.ownerDocument, win = doc.defaultView!;
  const finePointer = win.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, active = false, x = 0, y = 0, targetX = 0, targetY = 0, lastTime = 0;
  let lastTarget: EventTarget | null = null;
  const allowed = () => finePointer.matches && !reducedMotion.matches;
  const hide = () => {
    active = false; lastTime = 0; lastTarget = null;
    host.removeAttribute('data-custom-cursor');
    layer.removeAttribute('data-visible');
    layer.removeAttribute('data-interactive');
    win.cancelAnimationFrame(frame); frame = 0;
  };
  const draw = (time: number) => {
    const amount = 1 - Math.pow(0.72, Math.min(64, lastTime ? time - lastTime : 16.67) / 16.67);
    lastTime = time;
    x += (targetX - x) * amount; y += (targetY - y) * amount;
    point.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
    halo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (active && Math.hypot(targetX - x, targetY - y) > 0.1) frame = win.requestAnimationFrame(draw);
    else { frame = 0; lastTime = 0; }
  };
  const interactive = (target: EventTarget | null) => {
    if (target === lastTarget) return;
    lastTarget = target;
    const control = target instanceof win.Element ? target.closest('a,button,input,textarea,select,summary,label,[role="button"],[contenteditable="true"]') : null;
    layer.toggleAttribute('data-interactive', !!control && !control.matches(':disabled,[aria-disabled="true"]'));
  };
  const move = (event: PointerEvent) => {
    if (!allowed() || event.pointerType !== 'mouse' || !host.contains(event.target as Node)) { hide(); return; }
    targetX = event.clientX; targetY = event.clientY;
    if (!active) {
      x = targetX; y = targetY; active = true;
      host.setAttribute('data-custom-cursor', ''); layer.setAttribute('data-visible', '');
    }
    interactive(event.target);
    if (!frame) frame = win.requestAnimationFrame(draw);
  };
  const over = (event: PointerEvent) => { if (active) interactive(event.target); };
  const down = (event: PointerEvent) => {
    if (allowed() && event.pointerType === 'mouse' && host.contains(event.target as Node)) {
      move(event); onRipple(event.clientX, event.clientY);
    }
  };
  const leave = (event: PointerEvent) => { if (!event.relatedTarget) hide(); };
  const keyboard = (event: KeyboardEvent) => { if (event.key === 'Tab') hide(); };
  const visibility = () => { if (doc.hidden) hide(); };
  const preference = () => { if (!allowed()) hide(); };
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerover', over, { passive: true });
  doc.addEventListener('pointerdown', down, { passive: true });
  doc.addEventListener('pointerout', leave, { passive: true });
  doc.addEventListener('keydown', keyboard);
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('blur', hide);
  finePointer.addEventListener('change', preference);
  reducedMotion.addEventListener('change', preference);
  return () => {
    hide();
    doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerover', over);
    doc.removeEventListener('pointerdown', down); doc.removeEventListener('pointerout', leave);
    doc.removeEventListener('keydown', keyboard); doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('blur', hide);
    finePointer.removeEventListener('change', preference); reducedMotion.removeEventListener('change', preference);
  };
}
