if (!canvas.__lf_init) {
    canvas.__lf_vW = 256;
    canvas.__lf_vH = 144;
    
    // 14-Color "Lisa Frank" Acid Palette
    const LF_PALETTE = [
        [255, 0, 128],   // Neon Pink
        [255, 0, 255],   // Magenta
        [150, 0, 255],   // Purple
        [0, 50, 255],    // Deep Blue
        [0, 200, 255],   // Cyan
        [0, 255, 150],   // Mint
        [50, 255, 0],    // Lime
        [180, 255, 0],   // Yellow-Green
        [255, 255, 0],   // Yellow
        [255, 150, 0],   // Orange
        [255, 50, 0],    // Red
        [255, 255, 255], // White
        [30, 0, 60],     // Dark Space Purple
        [0, 0, 0]        // Black
    ];
    canvas.__lf_palette = LF_PALETTE;

    // Precompute YUV for accurate perceptual color distance
    const LF_PALETTE_YUV = LF_PALETTE.map(p => {
        let y = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
        let u = 0.492 * (p[2] - y);
        let v = 0.877 * (p[0] - y);
        return { p, y, u, v };
    });

    // 3D LUT for O(1) nearest-palette quantization
    canvas.__lf_lut = new Uint8Array(32 * 32 * 32);
    for (let r = 0; r < 32; r++) {
        for (let g = 0; g < 32; g++) {
            for (let b = 0; b < 32; b++) {
                let y1 = 0.299*(r*8) + 0.587*(g*8) + 0.114*(b*8);
                let u1 = 0.492*(b*8 - y1);
                let v1 = 0.877*(r*8 - y1);
                
                let bestDist = Infinity;
                let bestIdx = 0;
                for (let i = 0; i < LF_PALETTE_YUV.length; i++) {
                    let entry = LF_PALETTE_YUV[i];
                    let dy = y1 - entry.y;
                    let du = u1 - entry.u;
                    let dv = v1 - entry.v;
                    let dist = dy*dy + du*du + dv*dv;
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = i;
                    }
                }
                canvas.__lf_lut[r + (g * 32) + (b * 1024)] = bestIdx;
            }
        }
    }

    // Stable Pixel Grid Render Target
    canvas.__lf_offscreen = document.createElement('canvas');
    canvas.__lf_offscreen.width = canvas.__lf_vW;
    canvas.__lf_offscreen.height = canvas.__lf_vH;
    canvas.__lf_offCtx = canvas.__lf_offscreen.getContext('2d', { willReadFrequently: true });
    canvas.__lf_imgData = canvas.__lf_offCtx.createImageData(canvas.__lf_vW, canvas.__lf_vH);
    
    // Shader Passes Buffers
    canvas.__lf_depthBuffer = new Float32Array(canvas.__lf_vW * canvas.__lf_vH);
    canvas.__lf_colorBuffer = new Uint8Array(canvas.__lf_vW * canvas.__lf_vH);
    
    canvas.__lf_init = true;
}

const vW = canvas.__lf_vW;
const vH = canvas.__lf_vH;
const offscreen = canvas.__lf_offscreen;
const offCtx = canvas.__lf_offCtx;
const imgData = canvas.__lf_imgData;
const pixels = imgData.data;
const lut = canvas.__lf_lut;
const depthBuffer = canvas.__lf_depthBuffer;
const colorBuffer = canvas.__lf_colorBuffer;
const LF_PALETTE = canvas.__lf_palette;

// Bayer 4x4 Dither Matrix
const bayer4x4 = [
    0/16,  8/16,  2/16, 10/16,
   12/16,  4/16, 14/16,  6/16,
    3/16, 11/16,  1/16,  9/16,
   15/16,  7/16, 13/16,  5/16
];

// --- G2 Symbolic Field Math ---
function normalize3(a, b, c) {
    const len = Math.sqrt(a*a + b*b + c*c) || 1;
    return [a/len, b/len, c/len];
}

function g2PhiField(x, y, t) {
    const a = Math.sin(x * 2.1 + t * 0.55);
    const b = Math.cos(y * 2.7 - t * 0.31);
    const c = Math.sin((x + y) * 3.2 + t * 0.22);
    return normalize3(
        a + 0.3 * c,
        b - 0.25 * c,
        Math.sin((x * y) * 2.0 + t * 0.18)
    );
}

function g2DualField(x, y, t, phi) {
    return normalize3(
        -phi[1],
        phi[0],
        Math.cos((x - y) * 2.4 - t * 0.27)
    );
}

function g2Torsion(phi, dual) {
    return Math.abs(phi[0]*dual[0] + phi[1]*dual[1] + phi[2]*dual[2]);
}

function g2SingularityMask(pRadial, phi, dual, torsion) {
    const fracture = Math.sin(pRadial * 18.0 - torsion * 6.0 + phi[2] * 4.0);
    const axisStress = Math.abs(phi[0] - dual[1]);
    const raw = (0.5 + 0.5 * fracture) + axisStress * 0.35 + torsion * 0.4;
    return Math.max(0, Math.min(1, (raw - 0.72) / 0.24));
}

// --- Structural Color Mapping ---
function acidPalette(t) {
    return [
        0.5 + 0.5 * Math.cos(6.28318 * (t + 0.0)),
        0.5 + 0.5 * Math.cos(6.28318 * (t + 0.33)),
        0.5 + 0.5 * Math.cos(6.28318 * (t + 0.67))
    ];
}

function hash(x, y) {
    let p = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return p - Math.floor(p);
}

// --- Render Pipeline ---
const t = time;
const aspect = vW / vH;

let mouseNormX = mouse.isPressed ? (mouse.x / grid.width - 0.5) * 2.0 : Math.sin(t * 0.5) * 0.5;
let mouseNormY = mouse.isPressed ? (mouse.y / grid.height - 0.5) * 2.0 : Math.cos(t * 0.4) * 0.5;

let bIdx = 0;

// PASS 1: G2 Fields -> Thin-Film Interference -> Dither -> Quantize
for (let y = 0; y < vH; y++) {
    let baseNy = (y / vH - 0.5) * 2.0;
    
    for (let x = 0; x < vW; x++) {
        let baseNx = (x / vW - 0.5) * 2.0 * aspect;
        
        // Fixed upright coordinates for the heart motif
        let hx = baseNx * 2.5;
        let hy = -baseNy * 2.5 + 0.2;
        
        // Slow camera rotation
        let rot = t * 0.15;
        let nx = baseNx * Math.cos(rot) - baseNy * Math.sin(rot) + mouseNormX;
        let ny = baseNx * Math.sin(rot) + baseNy * Math.cos(rot) - mouseNormY;
        
        let radial = Math.sqrt(nx*nx + ny*ny);
        let angle = Math.atan2(ny, nx);
        
        // 5-fold Star Symmetry Space Warp
        let symmetry = Math.sin(angle * 5.0 + radial * 10.0 - t * 1.5);
        let wx = nx + 0.1 * Math.cos(symmetry);
        let wy = ny + 0.1 * Math.sin(symmetry);
        
        // G2 Mechanics
        let phi = g2PhiField(wx, wy, t);
        let dual = g2DualField(wx, wy, t, phi);
        let torsion = g2Torsion(phi, dual);
        let mask = g2SingularityMask(radial, phi, dual, torsion);
        
        // Structural Color (Thin-Film Phase Difference)
        let thickness = 200 + 500 * Math.abs(phi[2]) + 300 * torsion;
        let cosTheta = Math.abs(dual[2]);
        let pathDiff = 2.0 * 1.5 * thickness * cosTheta;
        let baseColor = acidPalette(pathDiff * 0.001 - t * 0.8 + symmetry * 0.1);
        
        let r = baseColor[0], g = baseColor[1], b = baseColor[2];
        let isStripe = false, isHighlight = false, isHeart = false;
        
        // Motif: Lisa Frank Leopard Spots via Singularity Fractures
        if (mask > 0.4) {
            if (mask < 0.55) {
                r = 1.0; g = 1.0; b = 1.0; // Neon Edge
                isHighlight = true;
            } else {
                r = 0.0; g = 0.0; b = 0.0; // Deep Spot
                isStripe = true;
            }
        }
        
        // Motif: Beating Rainbow Heart SDF
        let hVal = (hx*hx + hy*hy - 1.0);
        let hSDF = hVal*hVal*hVal - hx*hx*hy*hy*hy;
        let s = Math.sin(t * 5.0);
        let beat = s * s * s * s; 
        
        if (hSDF < 0.0 && hSDF > -0.4 - beat * 0.6) {
            let ht = angle * 2.0 - t * 4.0;
            r = 0.5 + 0.5 * Math.cos(6.28 * ht);
            g = 0.5 + 0.5 * Math.cos(6.28 * (ht + 0.33));
            b = 0.5 + 0.5 * Math.cos(6.28 * (ht + 0.67));
            isHeart = true;
        }
        
        // Motif: Twinkling Stars
        let h = hash(x, y);
        if (h > 0.995 && !isStripe && !isHeart) {
            let twinkle = Math.sin(t * 15 + h * 100);
            if (twinkle > 0.0) {
                r = 1.0; g = 1.0; b = 1.0;
                isHighlight = true;
            }
        }
        
        // Ordered Dither (Bayer 4x4)
        let bayerVal = bayer4x4[(y % 4) * 4 + (x % 4)] - 0.5;
        let spread = (isStripe || isHighlight || isHeart) ? 0.0 : 0.4;
        
        r = Math.max(0, Math.min(1, r + bayerVal * spread)) * 255;
        g = Math.max(0, Math.min(1, g + bayerVal * spread)) * 255;
        b = Math.max(0, Math.min(1, b + bayerVal * spread)) * 255;
        
        // Fast Palette LUT Quantization
        let rIdx = Math.max(0, Math.min(31, Math.floor(r / 8)));
        let gIdx = Math.max(0, Math.min(31, Math.floor(g / 8)));
        let bIdx_lut = Math.max(0, Math.min(31, Math.floor(b / 8)));
        let palIdx = lut[rIdx + (gIdx * 32) + (bIdx_lut * 1024)];
        
        colorBuffer[bIdx] = palIdx;
        depthBuffer[bIdx] = torsion + mask + (isHeart ? 1.0 : 0.0);
        bIdx++;
    }
}

// PASS 2: Sobel Edge-Detect Outline & Framebuffer Write
bIdx = 0;
let pIdx = 0;
for (let y = 0; y < vH; y++) {
    for (let x = 0; x < vW; x++) {
        let palIdx = colorBuffer[bIdx];
        
        let isOutline = false;
        if (x > 0 && x < vW - 1 && y > 0 && y < vH - 1) {
            let dC = depthBuffer[bIdx];
            let dU = depthBuffer[bIdx - vW];
            let dD = depthBuffer[bIdx + vW];
            let dL = depthBuffer[bIdx - 1];
            let dR = depthBuffer[bIdx + 1];
            
            // Edge detection on torsion/mask depth buffer
            let edge = Math.abs(dC - dU) + Math.abs(dC - dD) + Math.abs(dC - dL) + Math.abs(dC - dR);
            if (edge > 0.8) {
                isOutline = true;
            }
        }
        
        if (isOutline) {
            palIdx = 13; // Force Black Outline
        }
        
        let c = LF_PALETTE[palIdx];
        pixels[pIdx++] = c[0];
        pixels[pIdx++] = c[1];
        pixels[pIdx++] = c[2];
        pixels[pIdx++] = 255;
        
        bIdx++;
    }
}

offCtx.putImageData(imgData, 0, 0);

// --- Output to Main Canvas ---
ctx.fillStyle = '#140028'; // Dark Space Purple Background
ctx.fillRect(0, 0, grid.width, grid.height);

// Integer scaling for crisp pixel-art look
let scale = Math.max(1, Math.floor(Math.min(grid.width / vW, grid.height / vH) * 0.95));
let dw = vW * scale;
let dh = vH * scale;
let dx = Math.floor((grid.width - dw) / 2);
let dy = Math.floor((grid.height - dh) / 2);

// Neon Drop Shadow
ctx.shadowColor = '#ff00ff';
ctx.shadowBlur = 30;
ctx.fillStyle = '#000';
ctx.fillRect(dx, dy, dw, dh);
ctx.shadowBlur = 0;

ctx.imageSmoothingEnabled = false;
ctx.drawImage(offscreen, dx, dy, dw, dh);