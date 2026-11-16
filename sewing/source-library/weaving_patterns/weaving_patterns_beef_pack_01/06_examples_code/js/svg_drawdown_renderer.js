export function drawdownToSVG(matrix, cell=16){
  const h = matrix.length;
  const w = matrix[0].length;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w*cell}" height="${h*cell}" viewBox="0 0 ${w*cell} ${h*cell}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    svg += `<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="${matrix[y][x]?'#111':'#ddd'}"/>`;
  }
  return svg + `</svg>`;
}
