export function runningStitchPath(points, stitchLength = 12, gap = 6) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    let t = 0;
    while (t < len) {
      const t2 = Math.min(t + stitchLength, len);
      segments.push({ x1: a.x + ux * t, y1: a.y + uy * t, x2: a.x + ux * t2, y2: a.y + uy * t2 });
      t += stitchLength + gap;
    }
  }
  return segments;
}
