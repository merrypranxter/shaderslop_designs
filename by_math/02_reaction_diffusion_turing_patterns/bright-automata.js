// ============================================================================
// THE GREEDY MESHING AUTOMATON: A Quantized Reaction-Diffusion System
// 
// [MECHANISM]
// A continuous, organic Gray-Scott Reaction-Diffusion system is forcibly 
// "pixel-locked" and passed through a retro-shader pipeline every frame.
// The feral biology (chemicals A and B) attempts to grow smoothly, but is 
// brutally quantized into the ENDESGA-32 palette using Bayer 4x4 dithering
// and a Sobel edge-detection outline. It is an analog infection trapped in 
// a 16-bit digital constraint.
//
// [REPO GENOME INJECTED]
// - pxv.palette.endesga_32
// - pxv.shader.pixelate_grid_lock
// - pxv.shader.ordered_dither (Bayer 4x4)
// - pxv.shader.palette_map_nearest
// - pxv.shader.outline_sobel
// ============================================================================

const VIRTUAL_SCALE = 4; // 'pixelate_grid_lock' scale
const w = Math.floor(grid.width / VIRTUAL_SCALE);
const h = Math.floor(grid.height / VIRTUAL_SCALE);

// Initialize persistent state on the canvas object to avoid re-allocating
if (!canvas.__pxv_state) {
    
    // 1. ENDESGA-32 Palette (Extracted from repo)
    const hexPalette = [
        "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", 
        "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
        "#1a3d2b", "#2e6e32", "#5aab43", "#8dc23e", "#3e2a0e", "#7a4a1e", "#c48139", "#e8c172",
        "#2d2d2d", "#7d7d7d", "#5d2f0f", "#a35324", "#e07850", "#f4b379", "#fde89f", "#1a1c2c"
    ];
    
    // Convert hex to RGB for fast distance mapping
    const rgbPalette = hexPalette.map(hex => {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    });

    // 2. Bayer 4x4 Matrix (Normalized)
    const bayer4x4 = [
        0/16,  8/16,  2/16, 10/16,
       12/16,  4/16, 14/16,  6/16,
        3/16, 11/16,  1/16,  9/16,
       15/16,  7/16, 13/16,  5/16
    ];

    // 3. Reaction-Diffusion Buffers
    const size = w * h;
    const gridA = new Float32Array(size).fill(1.0);
    const gridB = new Float32Array(size).fill(0.0);
    const nextA = new Float32Array(size).fill(1.0);
    const nextB = new Float32Array(size).fill(0.0);

    // Seed the initial state with "spores"
    for (let i = 0; i < 20; i++) {
        const cx = Math.floor(Math.random() * w);
        const cy = Math.floor(Math.random() * h);
        const r = Math.floor(Math.random() * 10) + 2;
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                if (x*x + y*y <= r*r) {
                    const px = (cx + x + w) % w;
                    const py = (cy + y + h) % h;
                    gridB[py * w + px] = 1.0;
                }
            }
        }
    }

    // Offscreen canvas for fast pixel data manipulation and nearest-neighbor upscale
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx.createImageData(w, h);

    canvas.__pxv_state = {
        gridA, gridB, nextA, nextB,
        offscreen, offCtx, imgData,
        rgbPalette, bayer4x4
    };
}

const state = canvas.__pxv_state;
let { gridA, gridB, nextA, nextB, offscreen, offCtx, imgData, rgbPalette, bayer4x4 } = state;

// Reaction-Diffusion Parameters (Slightly altered to create 'coral' patterns)
const Da = 1.0;
const Db = 0.5;
// We will dynamically warp feed and kill rates based on spatial noise
const baseFeed = 0.0545;
const baseK = 0.0620;

// Helper: 1D index
const idx = (x, y) => ((y + h) % h) * w + ((x + w) % w);

// Interaction: Mouse injects chemical B
if (mouse.isPressed) {
    const mx = Math.floor(mouse.x / VIRTUAL_SCALE);
    const my = Math.floor(mouse.y / VIRTUAL_SCALE);
    const brush = 5;
    for (let y = -brush; y <= brush; y++) {
        for (let x = -brush; x <= brush; x++) {
            if (x*x + y*y < brush*brush) {
                gridB[idx(mx + x, my + y)] = 1.0;
                // Stir up A as well to cause immediate reaction
                gridA[idx(mx + x, my + y)] = 0.5; 
            }
        }
    }
}

// 1. UPDATE LOOP: Continuous Cellular Automata (Gray-Scott)
// We run a few steps per frame to speed up the visual evolution
const steps = 4; 
for (let s = 0; s < steps; s++) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const a = gridA[i];
            const b = gridB[i];

            // Laplacian (using 3x3 neighborhood)
            const aLap = (
                gridA[idx(x-1, y)] + gridA[idx(x+1, y)] + 
                gridA[idx(x, y-1)] + gridA[idx(x, y+1)]
            ) * 0.2 + (
                gridA[idx(x-1, y-1)] + gridA[idx(x+1, y-1)] + 
                gridA[idx(x-1, y+1)] + gridA[idx(x+1, y+1)]
            ) * 0.05 - a;

            const bLap = (
                gridB[idx(x-1, y)] + gridB[idx(x+1, y)] + 
                gridB[idx(x, y-1)] + gridB[idx(x, y+1)]
            ) * 0.2 + (
                gridB[idx(x-1, y-1)] + gridB[idx(x+1, y-1)] + 
                gridB[idx(x-1, y+1)] + gridB[idx(x+1, y+1)]
            ) * 0.05 - b;

            const reaction = a * b * b;
            
            // Spatial domain warping: feed and k vary slightly across the canvas
            // to create different "biomes" of behavior
            const spatialWarp = Math.sin(x * 0.05 + time) * Math.cos(y * 0.05 - time) * 0.002;
            const f = baseFeed + spatialWarp;
            const k = baseK + (Math.sin(time * 0.2) * 0.001); // Time oscillation

            nextA[i] = a + (Da * aLap - reaction + f * (1 - a));
            nextB[i] = b + (Db * bLap + reaction - (k + f) * b);
            
            // Clamp
            if (nextA[i] > 1) nextA[i] = 1; else if (nextA[i] < 0) nextA[i] = 0;
            if (nextB[i] > 1) nextB[i] = 1; else if (nextB[i] < 0) nextB[i] = 0;
        }
    }
    // Swap buffers
    let tempA = gridA; gridA = nextA; nextA = tempA;
    let tempB = gridB; gridB = nextB; nextB = tempB;
}

// Update state references
state.gridA = gridA;
state.gridB = gridB;

// 2. RENDER LOOP: The "pixel_voxel" Retro Pipeline
const data = imgData.data;

// Pre-calculate continuous color gradients mapping to the palette
// We map the concentration of A to a color ramp, but we will dither it
const colorRamp = [
    { r: 26,  g: 28,  b: 44  }, // Darkest (ENDESGA #1a1c2c)
    { r: 41,  g: 54,  b: 111 }, // Dark Blue
    { r: 59,  g: 93,  b: 201 }, // Mid Blue
    { r: 115, g: 239, b: 247 }, // Cyan
    { r: 167, g: 240, b: 112 }, // Pale Green
    { r: 255, g: 205, b: 117 }, // Warm Yellow
    { r: 239, g: 125, b: 87  }, // Orange Red
    { r: 177, g: 62,  b: 83  }  // Deep Red
];

// Helper: Palette nearest-neighbor snap
function nearestColor(r, g, b) {
    let minDist = Infinity;
    let bestColor = rgbPalette[0];
    for (let i = 0; i < rgbPalette.length; i++) {
        const pc = rgbPalette[i];
        // Euclidean distance in RGB space
        const dr = r - pc.r;
        const dg = g - pc.g;
        const db = b - pc.b;
        const dist = dr*dr + dg*dg + db*db;
        if (dist < minDist) {
            minDist = dist;
            bestColor = pc;
        }
    }
    return bestColor;
}

// Pipeline Execution
for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const a = gridA[i];
        const b = gridB[i];

        // --- STEP 1: Sobel Edge Detection (pxv.shader.outline_sobel) ---
        // We use the gradient of 'A' to detect edges of the "fungus"
        const aUp = gridA[idx(x, y-1)];
        const aDown = gridA[idx(x, y+1)];
        const aLeft = gridA[idx(x-1, y)];
        const aRight = gridA[idx(x+1, y)];
        
        const gradX = Math.abs(aLeft - aRight);
        const gradY = Math.abs(aUp - aDown);
        const edge = (gradX + gradY);

        let finalR, finalG, finalB;

        if (edge > 0.15) {
            // Outline Color (Darkest ENDESGA)
            finalR = 26; finalG = 28; finalB = 44; 
        } else {
            // --- STEP 2: Calculate Continuous Color ---
            // Map 'A' concentration (0 to 1) to the color ramp
            // We invert 'A' because Gray-Scott background is A=1, spots are A=0
            let t = (1.0 - a) * (colorRamp.length - 1);
            
            // Add a temporal pulse to shift the hue
            t = (t + (Math.sin(time + x*0.01) * 0.5 + 0.5) * 2) % (colorRamp.length - 1);
            if (t < 0) t += (colorRamp.length - 1);

            const idxLow = Math.floor(t);
            const idxHigh = Math.min(idxLow + 1, colorRamp.length - 1);
            const fract = t - idxLow;

            const cLow = colorRamp[idxLow];
            const cHigh = colorRamp[idxHigh];

            // --- STEP 3: Ordered Dither (pxv.shader.ordered_dither) ---
            // Get Bayer threshold for this pixel (0 to 1)
            const bayerVal = bayer4x4[(y % 4) * 4 + (x % 4)];
            
            // Dither spread: controls how wide the noisy transition band is
            const ditherSpread = 0.8; 
            
            // Shift the continuous value based on the threshold
            // If fract + dither_offset > 0.5, it snaps to High, else Low
            const ditheredFract = fract + (bayerVal - 0.5) * ditherSpread;
            
            let r, g, bb;
            if (ditheredFract > 0.5) {
                r = cHigh.r; g = cHigh.g; bb = cHigh.b;
            } else {
                r = cLow.r; g = cLow.g; bb = cLow.b;
            }

            // --- STEP 4: Palette Map Nearest (pxv.shader.palette_map_nearest) ---
            // Snap the dithered result to the strict ENDESGA-32 palette
            const snapped = nearestColor(r, g, bb);
            
            // Fake AO (Ambient Occlusion) from repo: darken if 'B' is high
            const ao = 1.0 - (b * 0.5);
            
            finalR = snapped.r * ao;
            finalG = snapped.g * ao;
            finalB = snapped.b * ao;
        }

        // Write to ImageData
        const pxIdx = i * 4;
        data[pxIdx]     = finalR;
        data[pxIdx + 1] = finalG;
        data[pxIdx + 2] = finalB;
        data[pxIdx + 3] = 255; // Alpha
    }
}

// 3. FINAL OUTPUT: Grid Lock Render
// Draw the ImageData to the offscreen canvas
offCtx.putImageData(imgData, 0, 0);

// Disable smoothing to maintain the hard "pixel lock" aesthetic
ctx.imageSmoothingEnabled = false;

// Upscale the virtual framebuffer to the actual canvas size
ctx.drawImage(offscreen, 0, 0, grid.width, grid.height);

// Add a slight CRT scanline overlay for extra texture tension
ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
for(let i = 0; i < grid.height; i += 4) {
    ctx.fillRect(0, i, grid.width, 1);
}