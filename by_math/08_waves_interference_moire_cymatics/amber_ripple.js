function fract(val) { return val - Math.floor(val); }
function clamp(v) { return Math.max(0, Math.min(255, v)); }
function sineGrating(u, v, freq, angle, phase) {
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
    let dot = u * dirX + v * dirY;
    return 0.5 + 0.5 * Math.sin(dot * freq + phase);
}

const w = grid.width;
const h = grid.height;
const cellSize = 5;

if (!canvas.__imgData || canvas.__imgData.width !== w || canvas.__imgData.height !== h) {
    canvas.__imgData = ctx.createImageData(w, h);
    canvas.__feedback = new Float32Array(Math.ceil(w / cellSize) * Math.ceil(h / cellSize));
}
const imgData = canvas.__imgData;
const data = imgData.data;
const feedback = canvas.__feedback;

const cols = Math.ceil(w / cellSize);
const rows = Math.ceil(h / cellSize);

const T = 10.0;
const t_norm = (time % T) / T;
const phase = t_norm * Math.PI * 2;

const cellSignals = new Float32Array(cols * rows);

for (let cy = 0; cy < rows; cy++) {
    let cyOffset = cy * cols;
    
    // Horizontal tearing (Broadcast Signal Failure / Sync Instability)
    let tearPhase = fract(t_norm * 3.0);
    let tearDist = Math.abs((cy / rows) - tearPhase);
    if (tearDist > 0.5) tearDist = 1.0 - tearDist;
    let isTearing = tearDist < 0.04;
    
    // Refresh wave (CRT scanline over-excitation)
    let scanY = t_norm;
    let dist = Math.abs((cy / rows) - scanY);
    if (dist > 0.5) dist = 1.0 - dist;
    let refresh = Math.exp(-dist * 60.0) * 2.5; 
    
    for (let cx = 0; cx < cols; cx++) {
        let u = cx / cols;
        let v = cy / rows;
        u *= (w / h);
        
        if (isTearing) {
            u += Math.sin(cy * 0.8 + phase * 20.0) * 0.08;
        }
        
        // Wave / Sinusoidal Moiré (Soft Interference)
        let g1 = sineGrating(u, v, 90.0, 0.1, phase * 4.0);
        let g2 = sineGrating(u, v, 93.0, 0.5, -phase * 3.0);
        let g3 = sineGrating(u, v, 87.0, 0.9, phase * 2.0);
        
        let moire = g1 * g2 * g3;
        moire = Math.pow(moire, 0.8) * 2.0; 
        
        let currentSignal = moire + refresh;
        
        // Dead / Stuck pixels (Sensor / Hardware Damage)
        let staticSeed = fract(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
        if (staticSeed < 0.003) currentSignal = 0.0;
        else if (staticSeed > 0.998) currentSignal = 3.0;
        
        // Datamosh / Interframe prediction freeze
        let moshSeed = fract(Math.sin(cx * 43.12 + cy * 12.98) * 4123.5);
        let moshPhase = fract(t_norm * 2.0 + moshSeed); 
        if (moshPhase < 0.15 && staticSeed > 0.05) { 
            currentSignal = feedback[cyOffset + cx] || 0; 
        }
        
        // Temporal feedback (Moiré as Memory / Phosphor Trails)
        let finalSignal = currentSignal * 0.35 + (feedback[cyOffset + cx] || 0) * 0.65;
        feedback[cyOffset + cx] = finalSignal;
        cellSignals[cyOffset + cx] = finalSignal;
    }
}

// Subpixel Geometry Render Loop
for (let y = 0; y < h; y++) {
    let cy = Math.floor(y / cellSize);
    let ly = y % cellSize;
    let isGapY = (ly === cellSize - 1);
    
    let rowOffset = y * w * 4;
    let cyOffset = cy * cols;
    
    for (let x = 0; x < w; x++) {
        let cx = Math.floor(x / cellSize);
        let lx = x % cellSize;
        let isGapX = (lx === cellSize - 1);
        
        let idx = rowOffset + x * 4;
        
        if (isGapX || isGapY) {
            data[idx]   = 10;
            data[idx+1] = 2;
            data[idx+2] = 0;
            data[idx+3] = 255;
            continue;
        }
        
        let sig = cellSignals[cyOffset + cx];
        
        // Warm-shifted amber dominancy
        let r_val = sig * 260; 
        let g_val = sig * 120; 
        let b_val = sig * 20;  
        
        // Subpixel masking: Red is 2px wide (brightest), Green is 1px, Blue is 1px
        if (lx === 0 || lx === 1) { 
            data[idx]   = clamp(r_val);
            data[idx+1] = clamp(g_val * 0.05);
            data[idx+2] = clamp(b_val * 0.05);
        } else if (lx === 2) { 
            data[idx]   = clamp(r_val * 0.1);
            data[idx+1] = clamp(g_val);
            data[idx+2] = clamp(b_val * 0.1);
        } else if (lx === 3) { 
            data[idx]   = clamp(r_val * 0.1);
            data[idx+1] = clamp(g_val * 0.1);
            data[idx+2] = clamp(b_val);
        }
        data[idx+3] = 255;
    }
}

ctx.putImageData(imgData, 0, 0);

// Phosphor bloom and luminous softening
ctx.globalCompositeOperation = 'screen';
ctx.filter = 'blur(6px)';
ctx.globalAlpha = 0.6;
ctx.drawImage(canvas, 0, 0);

ctx.filter = 'blur(16px)';
ctx.globalAlpha = 0.4;
ctx.drawImage(canvas, 0, 0);

// Reset context state
ctx.globalAlpha = 1.0;
ctx.filter = 'none';
ctx.globalCompositeOperation = 'source-over';

// Hardware housing shadow / CRT curvature vignette
let grad = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.4, w/2, h/2, Math.max(w,h)*0.8);
grad.addColorStop(0, 'rgba(0,0,0,0)');
grad.addColorStop(1, 'rgba(15,3,0,0.9)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, w, h);

// Screen-door / capture moiré interference
ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
for(let i = 0; i < h; i += 4) {
    ctx.fillRect(0, i, w, 1);
}