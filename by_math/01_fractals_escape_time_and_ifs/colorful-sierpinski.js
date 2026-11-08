const w = grid.width;
const h = grid.height;
const cx = w / 2;
const cy = h / 2;

// [THE VOID RULE] - Initialize the feral substrate
if (!canvas.__feralSierpinski) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, h);
    
    // Initialize fungal spores (agents for the Iterated Function System)
    canvas.__feralSierpinski = {
        points: Array.from({length: 200}, () => ({
            x: cx + (Math.random() - 0.5) * 10, 
            y: cy + (Math.random() - 0.5) * 10,
            r: 255, g: 255, b: 255,
            ox: cx, oy: cy
        }))
    };
}
const state = canvas.__feralSierpinski;

// 1. ENVIRONMENTAL DECAY & OUTWARD GROWTH PRESSURE
// (Repo: Damage Aesthetics - Copy of Copy Decay + Repo: Mycelial Networks - Expansion)
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(5, 5, 5, 0.07)';
ctx.fillRect(0, 0, w, h);

// Anastomosis drift / zoom feedback
ctx.save();
ctx.translate(cx, cy);
ctx.rotate(Math.sin(time * 0.2) * 0.0015);
ctx.scale(1.004, 1.004); // Fungal growth pressure
ctx.translate(-cx, -cy);
ctx.globalAlpha = 0.88;
ctx.drawImage(canvas, 0, 0);
ctx.restore();

// 2. DEFINE THE ATTRACTORS
// (Repo: Psychedelic Collage - Cyberdelic Neon Palette + Radial Centered Composition)
const R = Math.min(w, h) * 0.38 + Math.sin(time * 0.7) * 25.0;
const rot = time * 0.2;

// The canonical Sierpinski anchors, but mutating
const anchors = [
    { x: cx + R * Math.cos(rot), y: cy + R * Math.sin(rot), c: [255, 107, 0] },         // Electric Orange
    { x: cx + R * Math.cos(rot + 2.094), y: cy + R * Math.sin(rot + 2.094), c: [0, 255, 240] },   // Neon Cyan
    { x: cx + R * Math.cos(rot + 4.188), y: cy + R * Math.sin(rot + 4.188), c: [255, 0, 200] }    // Hot Magenta
];

// The Parasite / Mythic Attractor (Repo: THE-LISTS - Divine Data Corruption)
// A 4th anchor that orbits erratically, injecting chaos into the strict Sierpinski math
const parasite = {
    x: cx + R * 0.6 * Math.cos(time * -1.4) * Math.sin(time * 0.5),
    y: cy + R * 0.6 * Math.sin(time * 1.1) * Math.cos(time * 0.3),
    c: [170, 255, 0] // Acid Lime
};

// Draw the fruiting bodies (anchors)
ctx.globalCompositeOperation = 'screen';
for (let a of [...anchors, parasite]) {
    let pulse = Math.max(0, 6 + Math.sin(time * 8 + a.x) * 3);
    ctx.beginPath();
    ctx.arc(a.x, a.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${a.c[0]}, ${a.c[1]}, ${a.c[2]}, 0.15)`;
    ctx.fill();
}

// 3. FERAL IFS ITERATION (The Wet Engine)
const ITERS = 250; // Hits per frame per spore

for (let p of state.points) {
    for (let i = 0; i < ITERS; i++) {
        p.ox = p.x;
        p.oy = p.y;

        // Pick an anchor
        let a;
        let isParasite = Math.random() < 0.09; // 9% chance to follow parasite logic
        if (isParasite) {
            a = parasite;
        } else {
            a = anchors[Math.floor(Math.random() * 3)];
        }
        
        // Machine Hesitation / Fungal Distortion
        // Instead of the pristine 0.5 ratio of a Sierpinski gasket, the ratio warps based on spatial noise
        let hesitation = 0.5 
            + 0.045 * Math.sin(p.x * 0.015 + time) 
            + 0.045 * Math.cos(p.y * 0.015 - time * 0.8);
        
        if (isParasite) hesitation = 0.58; // Parasite pulls with a different gravitational weight
        
        p.x += (a.x - p.x) * hesitation;
        p.y += (a.y - p.y) * hesitation;
        
        // Chromatic assimilation (Spore absorbs the anchor's color)
        p.r = p.r * 0.88 + a.c[0] * 0.12;
        p.g = p.g * 0.88 + a.c[1] * 0.12;
        p.b = p.b * 0.88 + a.c[2] * 0.12;
        
        // Orbit Traps (Repo: Fractals - Orbit trap shimmer)
        let dCenter = Math.hypot(p.x - cx, p.y - cy);
        let dParasite = Math.hypot(p.x - parasite.x, p.y - parasite.y);
        
        let size = 1.2;
        let alpha = 0.35;
        
        // Trap 1: The Core (Gumball aesthetic)
        if (dCenter < R * 0.18) {
            size = 2.8;
            alpha = 0.8;
        }
        // Trap 2: Parasitic Halo (Glitter mold)
        else if (dParasite < R * 0.25) {
            size = 2.0;
            alpha = 0.6;
        }
        
        // Deposit spore
        ctx.fillStyle = `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${alpha})`;
        ctx.fillRect(p.x, p.y, size, size);
        
        // Mycelial Cord Formation / Anastomosis (Repo: Mycelial Networks)
        // Occasionally draw the path the spore took, simulating hyphal threads
        if (Math.random() < 0.0015) {
            ctx.strokeStyle = `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, 0.5)`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.ox, p.oy);
            // Curvature injection for organic feel
            let cx_ctrl = (p.ox + p.x) / 2 + (Math.random() - 0.5) * 30;
            let cy_ctrl = (p.oy + p.y) / 2 + (Math.random() - 0.5) * 30;
            ctx.quadraticCurveTo(cx_ctrl, cy_ctrl, p.x, p.y);
            ctx.stroke();
        }
    }
}

// 4. GLITCH / ABERRATION PASS (Repo: Damage Aesthetics - Scanline Dropout)
// Emulate "Divine Data Corruption" via periodic horizontal tearing
if (Math.random() < 0.08) {
    let sliceY = Math.random() * h;
    let sliceH = Math.random() * 15 + 2;
    let shiftX = (Math.random() - 0.5) * 12;
    
    ctx.globalCompositeOperation = 'source-over';
    // Copy a horizontal slice and shift it
    ctx.drawImage(canvas, 0, sliceY, w, sliceH, shiftX, sliceY, w, sliceH);
    
    // Add RGB split halo to the tear
    ctx.fillStyle = 'rgba(255, 0, 200, 0.1)';
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(shiftX, sliceY, w, sliceH);
}