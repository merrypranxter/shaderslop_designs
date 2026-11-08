if (!canvas.__weirdGasket) {
    const numAgents = 35000;
    const agents = new Float32Array(numAgents * 4); // x, y, colorIndex, size
    for (let i = 0; i < numAgents; i++) {
        agents[i * 4 + 0] = Math.random() * grid.width;
        agents[i * 4 + 1] = Math.random() * grid.height;
        agents[i * 4 + 2] = Math.floor(Math.random() * 4);
        agents[i * 4 + 3] = 1.0;
    }
    canvas.__weirdGasket = { agents, numAgents };
}

const state = canvas.__weirdGasket;
const cx = grid.width / 2;
const cy = grid.height / 2;
const r = Math.min(cx, cy) * 0.85;

// The Void Rule: Dark background with Copy-of-Copy Decay (Feedback Loop)
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(4, 6, 8, 0.08)'; // Void Black from cyberdelic_neon
ctx.fillRect(0, 0, grid.width, grid.height);

// Recursive Light / Feedback Distortion
ctx.save();
ctx.translate(cx, cy);
ctx.scale(1.003 + Math.sin(time * 0.5) * 0.002, 1.003 + Math.cos(time * 0.4) * 0.002);
ctx.rotate(Math.sin(time * 0.2) * 0.005);
ctx.translate(-cx, -cy);
ctx.globalAlpha = 0.85;
ctx.drawImage(canvas, 0, 0);
ctx.restore();

// Glitch / Scan-Bend: Occasional horizontal scanner tear
if (Math.random() < 0.03) {
    const sliceY = Math.random() * grid.height;
    const sliceH = Math.random() * 40 + 10;
    const shift = (Math.random() - 0.5) * 30;
    ctx.drawImage(canvas, 0, sliceY, grid.width, sliceH, shift, sliceY, grid.width, sliceH);
}

// 4 Attractors: 3 forming a rotating triangle, 1 acting as a chaotic "parasite"
const v = [
    { x: cx + Math.cos(time * 0.2) * r, y: cy + Math.sin(time * 0.2) * r },
    { x: cx + Math.cos(time * 0.2 + 2.094) * r, y: cy + Math.sin(time * 0.2 + 2.094) * r },
    { x: cx + Math.cos(time * 0.2 + 4.188) * r, y: cy + Math.sin(time * 0.2 + 4.188) * r },
    { x: cx + Math.sin(time * 0.8) * r * 0.6, y: cy + Math.cos(time * 1.3) * r * 0.6 }
];

// Acid Vibration / Cyberdelic Neon Palette
const colors = ['#FF00C8', '#00FFF0', '#B0FF00', '#FF6B00'];
const offsets = [
    {x: 2.0, y: 0.0},
    {x: -2.0, y: 1.0},
    {x: 0.0, y: 2.0},
    {x: 1.0, y: -2.0}
];

const batchesX = [[], [], [], []];
const batchesY = [[], [], [], []];
const batchesS = [[], [], [], []];

// Update agents (Chaos Game + Mycelial Anastomosis + Slime Inflation)
for (let i = 0; i < state.numAgents; i++) {
    let ax = state.agents[i * 4 + 0];
    let ay = state.agents[i * 4 + 1];
    let ac = state.agents[i * 4 + 2];
    
    let targetIndex = Math.floor(Math.random() * 4);
    let tx = v[targetIndex].x;
    let ty = v[targetIndex].y;

    // Fungal Anastomosis: 3% chance to bind to a random sister spore instead of an attractor
    if (Math.random() < 0.03) {
        const neighborIdx = Math.floor(Math.random() * state.numAgents);
        tx = state.agents[neighborIdx * 4 + 0];
        ty = state.agents[neighborIdx * 4 + 1];
    }

    const dx = tx - ax;
    const dy = ty - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Plush/Slime Deformation: The lerp factor breathes based on spatial frequency (Machine Hesitation)
    const lerpFactor = 0.5 + 0.18 * Math.sin(dist * 0.03 - time * 4.0);
    
    ax += dx * lerpFactor;
    ay += dy * lerpFactor;

    // Moiré / Curl Noise Drift
    ax += Math.sin(ay * 0.05 + time) * 0.8;
    ay += Math.cos(ax * 0.05 - time) * 0.8;

    // Halftone dot logic (size modulates based on 2D sine grid)
    const size = Math.max(0.2, 1.2 + 1.5 * Math.sin(ax * 0.08) * Math.sin(ay * 0.08));

    // Update state
    ac = targetIndex;
    state.agents[i * 4 + 0] = ax;
    state.agents[i * 4 + 1] = ay;
    state.agents[i * 4 + 2] = ac;
    state.agents[i * 4 + 3] = size;

    // Batch for rendering
    batchesX[ac].push(ax);
    batchesY[ac].push(ay);
    batchesS[ac].push(size);
}

// Draw Agents with CMYK Misregistration and Additive Glow
ctx.globalCompositeOperation = 'lighter';

for (let c = 0; c < 4; c++) {
    ctx.fillStyle = colors[c];
    ctx.beginPath();
    
    const bx = batchesX[c];
    const by = batchesY[c];
    const bs = batchesS[c];
    const len = bx.length;
    
    const ox = offsets[c].x * Math.sin(time * 2.0); // Breathing misregistration
    const oy = offsets[c].y * Math.cos(time * 2.0);

    for (let i = 0; i < len; i++) {
        const x = bx[i];
        const y = by[i];
        const s = bs[i];
        
        ctx.rect(x + ox, y + oy, s, s);

        // Candy/Sticker Orbit Traps: Generate plush "gumballs" near the core
        const dCenter = Math.sqrt((x - cx)*(x - cx) + (y - cy)*(y - cy));
        if (dCenter < 40 && i % 150 === 0) {
            ctx.moveTo(x, y);
            ctx.arc(x, y, Math.random() * 6 + 2, 0, 6.283);
        }
    }
    ctx.fill();
}

// Reset composite operation
ctx.globalCompositeOperation = 'source-over';