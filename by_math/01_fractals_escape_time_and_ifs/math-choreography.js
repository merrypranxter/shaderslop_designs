const W = grid.width;
const H = grid.height;

if (!canvas.__feralState) {
    canvas.__feralState = {
        agents: [],
        initialized: false,
        lastTime: time
    };
}

const state = canvas.__feralState;
const dt = Math.min(time - state.lastTime, 0.1);
state.lastTime = time;

// --- UTILS & MATH (From 'shiny' and 'fractals' repos) ---

function fract(n) { return n - Math.floor(n); }

function pseudoFbm(x, y) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) {
        let n = Math.sin(x * 127.1 * f + y * 311.7 * f) * 43758.5453123;
        v += a * (n - Math.floor(n));
        f *= 2; a *= 0.5;
    }
    return v;
}

// Julia Set smooth escape time
function getJuliaSmooth(x, y, cx, cy) {
    let zx = x, zy = y;
    let n = 0;
    const max = 40;
    for (; n < max; n++) {
        if (zx * zx + zy * zy > 256.0) break;
        let xt = zx * zx - zy * zy + cx;
        zy = 2.0 * zx * zy + cy;
        zx = xt;
    }
    if (n === max) return 0; // Interior
    let log_zn = Math.log(zx * zx + zy * zy) / 2.0;
    let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
    return (n + 1 - nu) / max;
}

// --- SHINY DOCTRINE HELPERS ---

function drawShinyVeinStroke(ctx, x1, y1, x2, y2, t, hueBase) {
    ctx.strokeStyle = `hsla(${hueBase}, 100%, 70%, 0.08)`;
    ctx.lineWidth = t * 3.0;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    ctx.strokeStyle = `hsla(${hueBase + 40 * Math.sin(x1 * 0.01 + y1 * 0.01)}, 100%, 75%, 0.85)`;
    ctx.lineWidth = t;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    if (Math.random() < 0.08) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(x2 - 1, y2 - 1, 2, 2);
    }
}

function drawHoloRepairSeam(ctx, x1, y1, x2, y2, w, hue, t_val) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = w * 4.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    const h1 = (hue + t_val * 40 + x1 * 0.05) % 360;
    const h2 = (hue + 130 + y1 * 0.04) % 360;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0.0, `hsla(${h1},100%,35%,0.95)`);
    grad.addColorStop(0.35, `hsla(${h2},100%,70%,0.95)`);
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1.0, `hsla(${h1 + 70},100%,45%,0.95)`);
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * w, y1 + ny * w); ctx.lineTo(x2 + nx * w, y2 + ny * w);
    ctx.stroke();
}

function drawRhinestoneNode(ctx, x, y, r, hue, t_val) {
    if (r <= 0) return;
    const flash = 0.5 + 0.5 * Math.sin(t_val * 7 + x * 0.02 + y * 0.01);
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.18, `hsla(${hue + 40},100%,78%,0.9)`);
    g.addColorStop(0.55, `hsla(${hue},100%,38%,0.85)`);
    g.addColorStop(1, 'rgba(20,0,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    
    if (flash > 0.8) {
        ctx.strokeStyle = `rgba(255,255,255,${flash})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - r * 1.5, y); ctx.lineTo(x + r * 1.5, y);
        ctx.moveTo(x, y - r * 1.5); ctx.lineTo(x, y + r * 1.5);
        ctx.stroke();
    }
}

function drawDryGlitterDust(ctx, x, y, r, count, hue) {
    for (let i = 0; i < count; i++) {
        let a = Math.random() * Math.PI * 2;
        let d = Math.random() * r;
        let gx = x + Math.cos(a) * d;
        let gy = y + Math.sin(a) * d;
        let flash = Math.random();
        if (flash > 0.6) {
            ctx.fillStyle = `hsla(${hue + (Math.random() - 0.5) * 60}, 100%, ${60 + flash * 40}%, ${flash * 0.8})`;
            ctx.fillRect(gx, gy, 1 + flash * 1.5, 1 + flash * 1.5);
        }
    }
}

// --- SYSTEM INITIALIZATION ---

if (!state.initialized) {
    ctx.fillStyle = '#050408';
    ctx.fillRect(0, 0, W, H);
    
    // Spawn Feral Julia Agents
    for (let i = 0; i < 400; i++) {
        state.agents.push({
            x: Math.random() * W,
            y: Math.random() * H,
            angle: Math.random() * Math.PI * 2,
            life: 50 + Math.random() * 150,
            maxLife: 200,
            width: 1 + Math.random() * 2,
            hue: Math.random() * 360,
            type: Math.random() > 0.8 ? 'kintsugi' : 'vein',
            targetContour: 0.1 + Math.random() * 0.8
        });
    }
    state.initialized = true;
}

// --- DYNAMIC FRACTAL PARAMETERS ---

// Cycle through famous Julia set parameters (Rabbit -> San Marco -> Spiral -> Basilica)
const presets = [
    [-0.12256, 0.74486],
    [-0.7269, 0.1889],
    [0.285, 0.01],
    [-0.75, 0.0]
];

const pTime = time * 0.2;
const pIndex = Math.floor(pTime) % presets.length;
const pNext = (pIndex + 1) % presets.length;
const pMix = fract(pTime);
// Smooth interpolation
const smoothMix = pMix * pMix * (3.0 - 2.0 * pMix);

const jcx = presets[pIndex][0] * (1 - smoothMix) + presets[pNext][0] * smoothMix;
const jcy = presets[pIndex][1] * (1 - smoothMix) + presets[pNext][1] * smoothMix;

// Add machine hesitation / organic breathing to the fractal space
const zoom = 2.5 + Math.sin(time * 0.5) * 0.2;
const aspect = W / H;

function mapToComplex(x, y) {
    return {
        cx: (x / W - 0.5) * aspect * zoom,
        cy: (y / H - 0.5) * zoom
    };
}

// --- RENDER LOOP ---

// Matte Host Substrate Fade (Buried Shine doctrine)
ctx.fillStyle = 'rgba(5, 4, 8, 0.08)';
ctx.fillRect(0, 0, W, H);

// Optional: Draw faint metallic stress lines using fBM
if (Math.random() < 0.2) {
    ctx.fillStyle = `rgba(100, 150, 255, 0.02)`;
    let tx = Math.random() * W;
    let ty = Math.random() * H;
    let r = 50 + Math.random() * 100;
    ctx.beginPath();
    ctx.arc(tx, ty, r, 0, Math.PI * 2);
    ctx.fill();
}

// Update and Draw Agents
const eps = 0.005; // gradient sampling epsilon

for (let i = 0; i < state.agents.length; i++) {
    let a = state.agents[i];
    
    let complex = mapToComplex(a.x, a.y);
    let v = getJuliaSmooth(complex.cx, complex.cy, jcx, jcy);
    
    // Gradient calculation
    let cxEps = mapToComplex(a.x + 1, a.y).cx;
    let cyEps = mapToComplex(a.x, a.y + 1).cy;
    let vx = getJuliaSmooth(cxEps, complex.cy, jcx, jcy);
    let vy = getJuliaSmooth(complex.cx, cyEps, jcx, jcy);
    
    let dx = vx - v;
    let dy = vy - v;
    
    // If deep in the interior (v == 0), chaotic behavior (Glitter Mold Bloom)
    if (v === 0) {
        a.angle += (Math.random() - 0.5) * 2.0;
        if (Math.random() < 0.1) {
            drawDryGlitterDust(ctx, a.x, a.y, 8, 3, a.hue);
        }
    } else {
        // Steer along the contour lines of the Julia set
        let contourAngle = Math.atan2(dx, -dy); // Perpendicular to gradient
        
        // Push towards the target contour value
        let error = a.targetContour - v;
        contourAngle += error * 5.0; // Corrective steering
        
        // Add noise (organic hesitation)
        let n = pseudoFbm(a.x * 0.01, a.y * 0.01) - 0.5;
        contourAngle += n * 1.5;
        
        // Smooth turn
        let diff = contourAngle - a.angle;
        // normalize angle diff
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        a.angle += diff * 0.2;
    }
    
    let speed = 2.0 + (1.0 - v) * 2.0; // Move faster in lower escape times
    let nx = a.x + Math.cos(a.angle) * speed;
    let ny = a.y + Math.sin(a.angle) * speed;
    
    // Draw
    if (a.type === 'vein') {
        // Map hue to the escape value to show math as color
        let currentHue = (a.hue + v * 120 + time * 10) % 360;
        drawShinyVeinStroke(ctx, a.x, a.y, nx, ny, a.width, currentHue);
        
        // Occasionally drop a rhinestone node at sharp turns or contour intersections
        if (Math.random() < 0.01 && v > 0.2 && v < 0.8) {
            drawRhinestoneNode(ctx, nx, ny, a.width * 2.5, currentHue, time);
        }
    } else {
        // Kintsugi fracture logic
        let currentHue = (a.hue - v * 60) % 360;
        drawHoloRepairSeam(ctx, a.x, a.y, nx, ny, a.width * 1.2, currentHue, time);
        if (Math.random() < 0.05) {
            drawDryGlitterDust(ctx, nx, ny, 15, 2, currentHue + 40);
        }
    }
    
    // Update state
    a.x = nx;
    a.y = ny;
    a.life--;
    
    // Screen wrap / Bounds check
    if (a.x < 0 || a.x > W || a.y < 0 || a.y > H || a.life <= 0) {
        // Respawn logic
        a.x = Math.random() * W;
        a.y = Math.random() * H;
        a.angle = Math.random() * Math.PI * 2;
        a.life = 50 + Math.random() * 150;
        a.targetContour = 0.1 + Math.random() * 0.8;
        
        // Burst of glitter on respawn (spore behavior)
        drawDryGlitterDust(ctx, a.x, a.y, 20, 10, a.hue);
    }
}