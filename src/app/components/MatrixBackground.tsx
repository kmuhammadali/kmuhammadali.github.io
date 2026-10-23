import { memo, useEffect, useRef } from 'react';
import { installMatrix } from './matrixRenderer';

/** Mounted outside route content so scrolling and navigation never reset the field. */
export const MatrixBackground = memo(function MatrixBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => canvas.current ? installMatrix(canvas.current) : undefined, []);
  return <canvas ref={canvas} data-matrix-background aria-hidden="true" className="portfolio-matrix font-mono text-xs text-primary" />;
});
