/** Size the original fixed-size glyph cells without stretching them or leaving gaps. */
export function getMatrixGrid(width: number, height: number, cellWidth: number, cellHeight: number) {
  return {
    columns: Math.max(1, Math.ceil(width / cellWidth)),
    rows: Math.max(1, Math.ceil(height / cellHeight)),
  };
}
