const cellSize = 4;
const ledSize = 3;

const cols = Math.ceil(grid.width / cellSize);
const rows = Math.ceil(grid.height / cellSize);

if (!canvas.__cellLums || canvas.__cellLums.length !== cols * rows) {
    canvas.__cellLums = new Float32Array(cols * rows);
    canvas.__imgData = ctx.createImageData(grid.width, grid.height);
}

const cellLums = canvas.__cellLums;
const imgData = canvas.__imgData;
const data = imgData.data;

const angle = 15 * Math.PI / 180;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);
const ghostAngle = angle + 0.03;
const cosG = Math.cos(ghostAngle);
const sinG = Math.sin(ghostAngle);

const maxDist = 0.85;

let poleX = Math.sin(time * 0.3) * 0.2;
let poleY = Math.cos(time * 0.4) * 0.2;

if (mouse && mouse.x > 0 && mouse.y > 0) {
    let mx = (mouse.x - grid.width / 2) / Math.min(grid.width, grid.height);
    let my = (mouse.y - grid.height / 2) / Math.min(grid.width, grid.height);
    poleX = Math.max(-0.6, Math.min(0.6, mx));
    poleY = Math.max(-0.6, Math.min(0.6, my));
}

function halftoneDot(x, y, scale, c, s, offsetX, offsetY, radius) {
    const rx = x * c - y * s;
    const ry = x * s + y * c;
    const stX = rx * scale + offsetX;
    const stY = ry * scale + offsetY;
    const fractX = stX - Math.floor(stX);
    const fractY = stY - Math.floor(stY);
    const dx = Math.abs(fractX - 0.5);
    const dy = Math.abs(fractY - 0.5);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    const edge0 = radius;
    const edge1 = Math.max(0.0, radius - 0.05);
    
    if (edge0 === edge1) return dist < radius ? 1.0 : 0.0;
    
    let t = (dist - edge0) / (edge1 - edge0);
    if (t < 0.0) t = 0.0;
    if (t > 1.0) t = 1.0;
    return t * t * (3 - 2 * t);
}

for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2;

        const uvX = (cx - grid.width / 2) / Math.min(grid.width, grid.height);
        const uvY = (cy - grid.height / 2) / Math.min(grid.width, grid.height);
        const distCenter = Math.sqrt(uvX*uvX + uvY*uvY);

        if (distCenter > maxDist) {
            cellLums[r * cols + c] = 0;
            continue;
        }

        const dxP = uvX - poleX;
        const dyP = uvY - poleY;
        const distPole = Math.sqrt(dxP*dxP + dyP*dyP);

        // Hyperbolic manifold projection
        const factor = 1.0 / (1.0 - Math.pow(Math.min(distPole, maxDist) / maxDist, 2.0) + 0.05);
        let nx = dxP * factor;
        let ny = dyP * factor;

        // XOR-Ghost Manifold: addressable trauma in the matrix
        if ((c ^ r) % 37 === 0) {
            nx += Math.sin(time) * 0.05;
        }

        // Fluid turbulence
        let mx = nx;
        let my = ny;
        let scale = 1.0;
        for(let i = 0; i < 3; i++) {
            let xx = mx;
            mx += Math.sin(my * 2.0 * scale + time * 0.7) * 0.2 / scale;
            my += Math.cos(xx * 2.0 * scale - time * 0.7) * 0.2 / scale;
            scale *= 1.5;
        }

        // Latent structural image driving the CMYK dot size
        let imgVal = Math.sin(mx * 4.0 + time) * Math.cos(my * 3.0 - time) * 0.5 + 0.5;
        imgVal += Math.sin(Math.sqrt(mx*mx + my*my) * 20.0 - time * 3.0) * 0.2;
        if (imgVal < 0.0) imgVal = 0.0;
        if (imgVal > 1.0) imgVal = 1.0;

        const radius = 0.05 + imgVal * 0.45; 

        // Plate separation logic
        const htScale = 25.0; 
        const ht1 = halftoneDot(nx, ny, htScale, cosA, sinA, time * 0.2, time * 0.1, radius);
        
        // Misregistration copy-of-copy ghost
        const radiusGhost = 0.05 + (1.0 - imgVal) * 0.25; 
        const ht2 = halftoneDot(nx, ny, htScale * 1.02, cosG, sinG, time * 0.2 + 0.1, time * 0.1 - 0.1, radiusGhost);

        let ht = ht1 * 0.8 + ht2 * 0.3;
        if (ht > 1.0) ht = 1.0;

        // Screen-space scan banding (CRT/LED structural artifact)
        const scanFreq = 200.0;
        let scan = Math.sin(uvY * scanFreq - time * 12.0) * 0.5 + 0.5;
        scan = scan * scan;
        const scanDim = 0.3 + 0.7 * scan; 

        let lum = ht * scanDim;

        // Crisp boundary
        let edgeAlpha = 1.0;
        if (distCenter > maxDist - 0.05) {
            let t = (distCenter - maxDist) / ((maxDist - 0.05) - maxDist);
            if (t < 0.0) t = 0.0;
            if (t > 1.0) t = 1.0;
            edgeAlpha = t * t * (3 - 2 * t);
        }
        lum *= edgeAlpha;

        // Hardware decay: Dead/Hot pixel probability
        const seed = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
        const hash = seed - Math.floor(seed);
        if (hash < 0.005) lum = 0.0;
        else if (hash > 0.998) lum = 1.0;

        // Temporal phosphor flicker
        if (lum > 0.1) {
            lum *= 0.95 + 0.05 * Math.sin(time * 50.0 + hash * 100.0);
        }

        cellLums[r * cols + c] = lum;
    }
}

// Render LED matrix to ImageData for warp-speed execution
for (let y = 0; y < grid.height; y++) {
    const r = Math.floor(y / cellSize);
    const dy = y % cellSize;
    const rowOffset = y * grid.width * 4;
    
    for (let x = 0; x < grid.width; x++) {
        const c = Math.floor(x / cellSize);
        const dx = x % cellSize;
        const idx = rowOffset + x * 4;
        
        if (dx < ledSize && dy < ledSize) {
            const lum = cellLums[r * cols + c] || 0;
            const lumVal = Math.floor(lum * 247);
            data[idx]     = 0; 
            data[idx + 1] = 8 + lumVal;
            data[idx + 2] = 8 + lumVal; // Pure Process Cyan invariant
            data[idx + 3] = 255;
        } else {
            // Unlit structural gap
            data[idx]     = 0;
            data[idx + 1] = 2;
            data[idx + 2] = 2;
            data[idx + 3] = 255;
        }
    }
}

ctx.putImageData(imgData, 0, 0);