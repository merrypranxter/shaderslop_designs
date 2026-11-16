export function plainWeave(width, height){
  return Array.from({length: height}, (_, y) =>
    Array.from({length: width}, (_, x) => (x + y) % 2)
  );
}

export function twill(width, height, floatLength = 4, step = 1){
  return Array.from({length: height}, (_, y) =>
    Array.from({length: width}, (_, x) => ((x + y * step) % floatLength) < floatLength / 2 ? 1 : 0)
  );
}

export function mirrorRepeat(arr){
  return arr.concat(arr.slice(1, -1).reverse());
}

export function drawdownToString(matrix){
  return matrix.map(row => row.map(v => v ? '█' : '·').join(' ')).join('
');
}
