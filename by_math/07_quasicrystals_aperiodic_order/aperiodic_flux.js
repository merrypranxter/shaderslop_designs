if (!canvas.__qcState) {
    canvas.__qcState = {
        imgData: null,
        offCanvas: document.createElement('canvas'),
        offCtx: null
    };
    canvas.__qcState.offCtx = canvas.__qcState.offCanvas.getContext('2d', { alpha: false });
}

const state = canvas.__qcState;
const maxPixels = 120000; 
let scale = Math.max(1, Math.sqrt((grid.width * grid.height) / maxPixels));
scale = Math.ceil(scale);
const w = Math.floor(grid.width / scale);
const h = Math.floor(grid.height / scale);

if (!state.imgData || state.imgData.width !== w || state.imgData.height !== h) {
    state.offCanvas.width = w;
    state.offCanvas.height = h;
    state.imgData = state.offCtx.createImageData(w, h);
}

const data = state.imgData.data;

// Cycle logic: 12 second period
const period = 12;
const phase = (time % period) / period;

function smoothstep(edge0, edge1, x) {
    let t = (x - edge0) / (edge1 - edge0);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return t * t * (3 - 2 * t);
}

// df = Dissolution Factor (0 = Order, 1 = Dissolution)
const df = smoothstep(0.4, 0.5, phase) - smoothstep(0.8, 0.9, phase);

// Precompute 8-fold Ammann-Beenker wave vectors for quasicrystal interference
const K = 8;
const kx = new Float32Array(K);
const ky = new Float32Array(K);
for(let i = 0; i < K; i++) {
    let angle = i * Math.PI / K;
    kx[i] = Math.cos(angle);
    ky[i] = Math.sin(angle);
}

const cx = w / 2;
const cy = h / 2;
const currentZoom = 0.12 + 0.03 * Math.sin(time * 0.2);
const timePhase = time * 2.5;
const timeInt = (time * 30) | 0;

let idx = 0;

for (let y = 0; y < h; y++) {
    // Horizontal tearing logic (Glitch artifact)
    let tearShift = 0;
    if (df > 0) {
        let blockY = (y / 6) | 0;
        // Fast deterministic hash for block tearing
        let hashY = ((blockY * 12345 + timeInt * 6789) % 1000) / 1000;
        if (hashY > 0.95) {
            tearShift = (hashY - 0.95) * 1200.0 * df;
        }
    }

    for (let x = 0; x < w; x++) {
        let fx = x;
        let fy = y;
        
        // Geometry Fracture (Bitwise XOR glitch)
        if (df > 0) {
            let strength = (df * 40) | 0;
            fx = x ^ (((y + timeInt) >> 2) & strength);
            fy = y ^ (((x - timeInt) >> 2) & strength);
        }
        
        let u = (fx - cx + tearShift) * currentZoom;
        let v = (fy - cy) * currentZoom;
        
        // Smooth Domain Warp (Crystalline Order mode)
        if (df < 1) {
            let warpU = Math.sin(v * 0.4 + time * 0.7) * 1.5;
            let warpV = Math.cos(u * 0.4 - time * 0.7) * 1.5;
            u += warpU * (1 - df);
            v += warpV * (1 - df);
        }
        
        // Quasicrystal Projection (Sum of plane waves)
        let val = 0;
        for(let i = 0; i < K; i++) {
            val += Math.cos(kx[i] * u + ky[i] * v + timePhase);
        }
        
        // --- State 1: Crystalline Order Palette ---
        let or = 0, og = 0, ob = 0;
        if (df < 1) {
            let t = val * 0.15 + time * 0.3;
            // Full spectrum neon cosine palette
            or = (0.6 + 0.5 * Math.cos(6.283 * (t + 0.0))) * 255;
            og = (0.6 + 0.5 * Math.cos(6.283 * (t + 0.333))) * 255;
            ob = (0.6 + 0.5 * Math.cos(6.283 * (t + 0.667))) * 255;
            
            // Isolate high-symmetry diffraction peaks
            let fringe = Math.cos(val * 2.5);
            let sharp = fringe > 0 ? fringe * fringe : 0;
            let intensity = 0.3 + 0.7 * sharp;
            
            or = Math.min(255, or * intensity);
            og = Math.min(255, og * intensity);
            ob = Math.min(255, ob * intensity);
        }
        
        // --- State 2: Structural Dissolution Palette ---
        let dr = 0, dg = 0, db = 0;
        if (df > 0) {
            // Palette collapses to 3 harsh tones
            let q = Math.sin(val * 3.0);
            if (q > 0.5) {
                dr = 0; dg = 255; db = 255; // Neon Cyan
            } else if (q < -0.5) {
                dr = 255; dg = 0; db = 150; // Neon Pink
            } else {
                dr = 8; dg = 8; db = 12;    // Void Black
            }
            
            // High-frequency noise speckles
            let rand = ((x * 12345 + y * 67890 + timeInt * 13579) % 1000) / 1000;
            if (rand < 0.04 * df) {
                dr = 255; dg = 255; db = 255; // Flash white
            }
        }
        
        // Crossfade between phenomenological faces
        data[idx++] = or * (1 - df) + dr * df;
        data[idx++] = og * (1 - df) + dg * df;
        data[idx++] = ob * (1 - df) + db * df;
        data[idx++] = 255;
    }
}

state.offCtx.putImageData(state.imgData, 0, 0);

// Render to main canvas. 
// Smooth upscaling during Order, blocky/pixelated upscaling during Dissolution.
ctx.imageSmoothingEnabled = df < 0.5;
ctx.drawImage(state.offCanvas, 0, 0, grid.width, grid.height);