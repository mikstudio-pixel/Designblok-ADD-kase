// Every visible mark is a font glyph. No canvas, image, or SVG is used by the miniature.
export function asciiBowl(phase: number, oil: number) {
  const columns = 23, rows = 13;
  const ramp = ' .:+*O@';
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < columns; x++) {
      const nx = (x - (columns - 1) / 2) / ((columns - 1) / 2);
      const ny = (y - (rows - 1) / 2) / ((rows - 1) / 2);
      const radius = Math.hypot(nx, ny);
      if (radius > 1.02) { line += ' '; continue; }
      if (radius > .93) { line += radius > .99 ? '.' : ':'; continue; }
      const angle = Math.atan2(ny, nx) + phase * (1.7 - radius);
      const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
      const swirl = Math.sin(angle * 3 + radius * 19 + Math.sin(angle * 4 - radius * 6)) * .5 + .5;
      const granules = Math.sin(px * 21 + Math.sin(py * 9)) * Math.cos(py * 17);
      const sheen = Math.max(0, Math.sin(px * 9) * Math.cos(py * 8) - .45) * oil;
      const density = Math.max(0, Math.min(.999, swirl * .56 + granules * .16 + .14 + sheen * .5));
      line += ramp[Math.floor(density * ramp.length)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}
