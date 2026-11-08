const scale = 2;
const w = Math.floor(grid.width / scale);
const h = Math.floor(grid.height / scale);

if (!canvas.__imgData || canvas.__imgData.width !== w || canvas.__imgData.height !== h) {
    canvas.__imgData = ctx.createImageData(w, h);
    canvas.__tmpCanvas = document.createElement('canvas');
    canvas.__tmpCtx = canvas.__tmpCanvas.getContext('2d', { alpha: false });
}

const imgData = canvas.__imgData;
const data = imgData.data;

const tSlow = time * 0.05;
const tMed = time * 0.5;
const tFast_mod = (time * 15.0) % 1000.0;

const driftX = Math.sin(tSlow) * 0.5;
const driftY = Math.cos(tSlow * 1.3) * 0.5;

const rotC = Math.cos(tMed * 0.15);
const rotS = Math.sin(tMed * 0.15);

const bayer = [
    [ 0/16,  8/16,  2/16, 10/16],
    [12/16,  4/16, 14/16,  6/16],
    [ 3/16, 11/16,  1/16,  9/16],
    [15/16,  7/16, 13/16,  5/16]
];

const aspect = w / h;
let ptr = 0;

for (let y = 0; y < h; y++) {
    const v = (y / h - 0.5) * 2.0;
    const by = y & 3; 

    for (let x = 0; x < w; x++) {
        const u = (x / w - 0.5) * 2.0 * aspect;
        const bx = x & 3; 

        let noise = ((x * 12.9898 + y * 78.233 + tFast_mod) * 43758.5453) % 1.0;
        noise = noise < 0 ? -noise : noise; 
        
        const thresh = bayer[by][bx] * 0.55 + noise * 0.45;

        const u_warp = u + Math.sin(v * 2.0 + tSlow) * 0.15;
        const v_warp = v + Math.cos(u * 2.0 + tSlow) * 0.15;

        let zx = u_warp * 1.5 + driftX;
        let zy = v_warp * 1.5 + driftY;
        
        let trap = 100.0;
        let trap2 = 0.0;

        for (let i = 0; i < 6; i++) {
            zx = zx < 0 ? -zx : zx;
            zy = zy < 0 ? -zy : zy;

            let tx = zx * rotC - zy * rotS;
            let ty = zx * rotS + zy * rotC;
            zx = tx; 
            zy = ty;

            let m = zx * zx + zy * zy;
            if (m < 0.02) m = 0.02; 

            zx = (zx / m) * 1.15 - 0.6;
            zy = (zy / m) * 1.15 - 0.6;

            let d = zx * zx + zy * zy;
            if (d < trap) trap = d;
            trap2 += Math.exp(-m * 2.0);
        }

        let density = Math.exp(-trap * 1.5) * 0.4 + (trap2 / 6.0) * 0.6;
        density += (noise - 0.5) * 0.1; 

        const phase1 = density * 6.0 - tSlow * 2.0;
        const phase2 = density * 6.0 - tSlow * 2.0 + 2.094; 
        const phase3 = density * 6.0 - tSlow * 2.0 + 4.188; 

        const c_val = (Math.sin(phase1) * 0.5 + 0.5) * density;
        const m_val = (Math.sin(phase2) * 0.5 + 0.5) * density;
        const y_val = (Math.sin(phase3) * 0.5 + 0.5) * density;

        const c_on = c_val > (thresh * 0.8 + 0.1) ? 1 : 0;
        const m_on = m_val > (thresh * 0.8 + 0.1) ? 1 : 0;
        const y_on = y_val > (thresh * 0.8 + 0.1) ? 1 : 0;

        let r = (m_on * 255) + (y_on * 255);
        let g = (c_on * 255) + (y_on * 255);
        let b = (c_on * 255) + (m_on * 255);

        if (!(c_on | m_on | y_on)) {
            const depth = Math.floor(density * 20);
            r = 2 + depth; 
            g = 4 + depth; 
            b = 8 + depth; 
        } else {
            r = r > 255 ? 255 : r;
            g = g > 255 ? 255 : g;
            b = b > 255 ? 255 : b;
        }

        data[ptr++] = r;
        data[ptr++] = g;
        data[ptr++] = b;
        data[ptr++] = 255; 
    }
}

canvas.__tmpCanvas.width = w;
canvas.__tmpCanvas.height = h;
canvas.__tmpCtx.putImageData(imgData, 0, 0);

ctx.imageSmoothingEnabled = false;
ctx.clearRect(0, 0, grid.width, grid.height);
ctx.drawImage(canvas.__tmpCanvas, 0, 0, grid.width, grid.height);