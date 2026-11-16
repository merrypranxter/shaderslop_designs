export function makeCrossStitchGrid(cols, rows, palette) {
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = Math.abs((x * 17 + y * 31 + Math.floor(Math.sin(x * y) * 99))) % palette.length;
      cells.push({ x, y, color: palette[idx], stitch: 'cross' });
    }
  }
  return cells;
}

export function mirrorGrid(cells, cols) {
  return cells.concat(cells.map(c => ({ ...c, x: cols - 1 - c.x })));
}
