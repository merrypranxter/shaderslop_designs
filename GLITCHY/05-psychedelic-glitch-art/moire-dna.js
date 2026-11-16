const w = grid.width;
const h = grid.height;
const cx = w / 2;
const cy = h / 2;

// Temporal Feedback Moiré (Repo 1: Technique 06) + Cyberdelic Neon (Repo 2)
// Instead of clearing the canvas, we fade it to create glowing memory trails.
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(4, 6, 8, 0.18)'; // Void Black with alpha for feedback decay
ctx.fillRect(0, 0, w, h);

// Mouse interaction drives Anamorphic / Misregistration Moiré (Repo 1: Tech 10 / Repo 2)
const mx = mouse.x || cx;
const my = mouse.y || cy;
const driftX = (mx - cx) * 0.05;
const driftY = (my - cy) * 0.05;

// Chromatic RGB Moiré Layers (Repo 1: Technique 07)
// Colors mapped to Acid Vibration / Cyberdelic Neon palettes (Repo 2 & 3)
const layers = [
    { color: '#00FFF0', petals: 12, scaleDiff: 1.00, phaseDir:  1.2, driftMult:  1.0, waveAmp: 0.08 }, // Neon Cyan
    { color: '#FF00CC', petals: 12, scaleDiff: 1.03, phaseDir: -0.9, driftMult: -0.5, waveAmp: 0.09 }, // Electric Magenta
    { color: '#B0FF00', petals: 12, scaleDiff: 0.97, phaseDir:  0.7, driftMult:  0.0, waveAmp: 0.07 }  // Acid Lime
];

// Additive blending for pure light interference (Wave Moiré / Holographic)
ctx.globalCompositeOperation = 'lighter';
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

const maxR = Math.max(w, h) * 0.8;
const ringStep = 14;
const angleStep = 0.08;

// The Strange Mechanism: Moiré as a living, breathing floral structure
layers.forEach((layer, i) => {
    // Dynamic petal count (Frequency Chirp) creating shifting interference zones
    const activePetals = layer.petals + Math.sin(time * 0.2 + i) * 2;
    
    // CMYK Misregistration offset driven by mouse and time
    const offsetX = Math.sin(time * 0.5 + i * 2) * 15 + driftX * layer.driftMult;
    const offsetY = Math.cos(time * 0.4 + i * 2) * 15 + driftY * layer.driftMult;

    ctx.strokeStyle = layer.color;
    // Line width pulses, creating density contrast (Psychedelic Pop: Pillar 4)
    ctx.lineWidth = 2.5 + Math.sin(time * 3 + i) * 1.5;

    for (let r = 20; r < maxR; r += ringStep) {
        ctx.beginPath();
        const R = r * layer.scaleDiff;
        
        for (let a = 0; a <= Math.PI * 2 + angleStep; a += angleStep) {
            // Spiral Phantom distortion (Repo 1: Technique 03)
            const spiralTwist = R * 0.0015 * Math.sin(time * 0.15);
            const twistedAngle = a + spiralTwist;
            
            // Wave Sinusoidal modulation (Repo 1: Technique 04)
            const wave = Math.sin(twistedAngle * activePetals + time * layer.phaseDir) * (R * layer.waveAmp);
            
            const x = cx + offsetX + (R + wave) * Math.cos(a);
            const y = cy + offsetY + (R + wave) * Math.sin(a);
            
            if (a === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
});

// Central Emblem: The Cosmic Eye (Repo 3: Motifs - Eyes)
// A hard graphic anchor that contrasts the temporal moiré chaos.
ctx.globalCompositeOperation = 'source-over';

// Occasional rapid blink mechanism
const blinkCycle = Math.pow(Math.cos(time * Math.PI * 0.4), 150); 
const eyeHeight = 70 * (1 - blinkCycle);

if (eyeHeight > 5) {
    // Sclera (Void Black to ground the neon)
    ctx.fillStyle = '#040608';
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy);
    ctx.quadraticCurveTo(cx, cy - eyeHeight, cx + 130, cy);
    ctx.quadraticCurveTo(cx, cy + eyeHeight, cx - 130, cy);
    ctx.fill();
    
    // Outer graphic sticker line (Psychedelic Pop: Shape Language)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFFFFF'; // Hot White
    ctx.stroke();

    // Iris (Neon Cyan)
    ctx.beginPath();
    ctx.arc(cx, cy, eyeHeight * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#00FFF0';
    ctx.fill();

    // Pupil (Electric Magenta Star - Repo 3: Celestial Motifs)
    ctx.beginPath();
    const starPoints = 10;
    for(let i = 0; i < starPoints; i++) {
        const radius = i % 2 === 0 ? eyeHeight * 0.25 : eyeHeight * 0.1;
        const angle = (i / starPoints) * Math.PI * 2 + time * 0.5;
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy + Math.sin(angle) * radius;
        if(i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = '#FF00CC';
    ctx.fill();
    
    // Eye highlight (Graphic flatness)
    ctx.beginPath();
    ctx.arc(cx + 15, cy - 15, eyeHeight * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
} else {
    // Closed eye line
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy);
    ctx.quadraticCurveTo(cx, cy + 20, cx + 130, cy);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
}

// Glitch / Scan-Bend Artifacts (Repo 2: Glitch Neon Composite)
// Horizontal scanlines to break the radial symmetry and ground it in digital/print medium
ctx.fillStyle = 'rgba(4, 6, 8, 0.4)';
for (let y = 0; y < h; y += 6) {
    // Wavy scanlines (Domain Warping)
    const scanWave = Math.sin(y * 0.05 + time) * 2;
    ctx.fillRect(0, y + scanWave, w, 2);
}