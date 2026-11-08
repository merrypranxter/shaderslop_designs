const cx = grid.width / 2;
const cy = grid.height / 2;

// REPO 3 & 5: Entropy with Intention / Paradox Engines
// Breaking temporal symmetry to create a "Time Crystal"
// The flow of time stutters, reverses slightly, and jumps
const t_crystal = time + Math.sin(time * 2.718) * 0.4 + Math.cos(time * 3.14) * 0.2;

// Mouse interaction drives anisotropic field torsion
const mx = mouse.x || cx;
const my = mouse.y || cy;
const distToMouse = Math.hypot(mx - cx, my - cy);
const warpField = Math.min(distToMouse / (grid.width * 0.2), 2.5);

// REPO 4 & 6: Damage Aesthetics / Glitchcore Style
const isGlitching = Math.random() < (0.05 + warpField * 0.05);
const lumaFailure = Math.sin(time * 43.5) > 0.9;

// REPO 1: Psychedelic Pop Palette (High contrast, neon, celestial)
const palettes = [
    ['#FF0055', '#00FFFF', '#E5FF00'], // Magenta, Cyan, Lime
    ['#FF3399', '#33FF33', '#6600FF'], // Hot Pink, Neon Green, Deep Violet
    ['#FFFFFF', '#111111', '#FF3131']  // Pop Art High Contrast
];
const pIndex = Math.floor(t_crystal * 0.2) % palettes.length;
const currentPalette = palettes[pIndex < 0 ? 0 : pIndex];

// Clear screen with authenticity-vs-simulation temporal smear
ctx.globalCompositeOperation = 'source-over';
if (lumaFailure) {
    ctx.fillStyle = '#FFFFFF';
} else {
    ctx.fillStyle = `rgba(10, 5, 20, ${isGlitching ? 0.8 : 0.15})`;
}
ctx.fillRect(0, 0, grid.width, grid.height);

// The 11 Dimensions mapped to 2D projection variables
const D1 = Math.sin(t_crystal * 0.11); // Base Scale
const D2 = Math.cos(t_crystal * 0.13); // Global Yaw
const D3 = Math.sin(t_crystal * 0.17 + mx / grid.width); // Pitch Torsion
const D4 = Math.cos(t_crystal * 0.19 + my / grid.height); // Roll Torsion
const D5 = Math.tan(Math.sin(t_crystal * 0.2)); // Spatial Tearing (clamped later)
const D6 = (t_crystal * 1.5) % (Math.PI * 2); // Temporal Sawtooth
const D7 = Math.sin(t_crystal * 0.23) > 0 ? 1 : -1; // Binary Phase Flip
const D8 = Math.max(3, Math.floor(Math.sin(t_crystal * 0.31) * 3 + 6)); // Mineral Facet Quantization
const D9 = Math.cos(t_crystal * 0.37); // Chromatic Aberration Spread
const D10 = Math.sin(t_crystal * 0.41 + distToMouse / 100); // Signal Density
const D11 = Math.cos(t_crystal * 0.43); // Inner Void Collapse

// REPO 2: Minerals - Malachite/Fluorite growth logic
// Project an 11D coordinate into 2D space
const project11D = (theta, radius, stratum) => {
    // Start with polar
    let x = Math.cos(theta) * radius;
    let y = Math.sin(theta) * radius;
    
    // Mineral Faceting (Quantizing angles to create sharp crystal edges)
    let facetAngle = Math.PI * 2 / D8;
    let quantizedTheta = Math.round(theta / facetAngle) * facetAngle;
    
    // Interpolate between smooth circle and sharp crystal based on D10
    let facetStrength = Math.abs(D10);
    let fx = Math.cos(quantizedTheta) * radius;
    let fy = Math.sin(quantizedTheta) * radius;
    
    x = x * (1 - facetStrength) + fx * facetStrength;
    y = y * (1 - facetStrength) + fy * facetStrength;

    // Apply Anisotropic Torsion (D3, D4)
    let torsion = Math.sin(radius * 0.005 - D6) * warpField;
    let tx = x * Math.cos(torsion) - y * Math.sin(torsion);
    let ty = x * Math.sin(torsion) + y * Math.cos(torsion);

    // Apply Spatial Tearing (D5 - Paradox Engine)
    let tear = Math.max(-2, Math.min(2, D5));
    tx += Math.sin(theta * 7 + D2) * tear * stratum;
    ty += Math.cos(theta * 11 - D1) * tear * stratum;

    // Z-depth simulation (Folded space)
    let z = 1 + Math.sin(t_crystal * 1.1 + stratum * 0.5) * 0.3;

    return {
        x: cx + tx * z * D7,
        y: cy + ty * z
    };
};

// Render the 11D Time Crystal
// Using 'difference' blending to create intense, malachite-like psychedelic banding
ctx.globalCompositeOperation = 'difference';
ctx.lineJoin = 'bevel'; // Sharp mineral corners

const strataCount = 12; // Layers of the crystal

for (let stratum = strataCount; stratum > 0; stratum--) {
    // Base radius pulses with D1 and collapses with D11
    let baseRadius = (30 + stratum * 25) * (1 + D1 * 0.2) * (1 + D11 * 0.1);
    
    // REPO 4: Chroma Luma Failures - Separate RGB channels
    for (let c = 0; c < 3; c++) {
        ctx.fillStyle = currentPalette[c];
        ctx.strokeStyle = currentPalette[(c + 1) % 3];
        
        // Chromatic drift based on D9 and warpField
        let driftX = (c - 1) * D9 * 15 * warpField;
        let driftY = (c - 1) * Math.sin(D6) * 15 * warpField;

        // Glitch injection into specific color channels
        if (isGlitching && c === 1) driftX += (Math.random() - 0.5) * 100;

        ctx.beginPath();
        let segments = 90; // High res for smooth curves between facets
        for (let i = 0; i <= segments; i++) {
            let theta = (i / segments) * Math.PI * 2;
            let pt = project11D(theta, baseRadius, stratum);
            
            if (i === 0) ctx.moveTo(pt.x + driftX, pt.y + driftY);
            else ctx.lineTo(pt.x + driftX, pt.y + driftY);
        }
        ctx.closePath();
        
        // Alternate between solid fills and thick pop-art outlines
        if (stratum % 2 === 0) {
            ctx.fill();
        } else {
            ctx.lineWidth = 3 + Math.abs(Math.sin(D6 + stratum)) * 5;
            ctx.stroke();
        }
    }
}

// REPO 4 & 6: Post-Processing Artifact Stack & Broadcast Signal Failure
ctx.globalCompositeOperation = 'source-over';

// 1. Horizontal sync loss (slicing the canvas and shifting it)
if (Math.random() < 0.2 + warpField * 0.1) {
    let sliceCount = Math.floor(Math.random() * 5) + 1;
    for (let s = 0; s < sliceCount; s++) {
        let sliceY = Math.random() * grid.height;
        let sliceH = Math.random() * 40 + 5;
        let shiftX = (Math.random() - 0.5) * 80 * (1 + warpField);
        
        // Self-referential canvas drawing for glitch slicing
        ctx.drawImage(canvas, 
            0, sliceY, grid.width, sliceH, 
            shiftX, sliceY, grid.width, sliceH
        );
    }
}

// 2. Psychedelic Pop Halftone / Dead Pixel Pollen
const particleCount = Math.floor(50 + warpField * 150);
for(let i = 0; i < particleCount; i++) {
    let px = Math.random() * grid.width;
    let py = Math.random() * grid.height;
    let pSize = Math.random() > 0.9 ? Math.random() * 6 + 2 : Math.random() * 2; // Mix of fine dust and pop-art dots
    
    // Particles cluster around the crystal or scatter based on D5 tearing
    if (Math.random() < 0.7) {
        let angle = Math.random() * Math.PI * 2;
        let r = Math.random() * (grid.width/2) * Math.abs(D5);
        px = cx + Math.cos(angle) * r;
        py = cy + Math.sin(angle) * r;
    }

    if (Math.random() < 0.2) {
        ctx.fillStyle = currentPalette[Math.floor(Math.random() * 3)];
    } else {
        ctx.fillStyle = Math.random() > 0.5 ? '#FFFFFF' : '#000000';
    }
    
    // Draw rigid squares (dead pixels) or circles (halftones) based on mineral logic D8
    if (D8 % 2 === 0) {
        ctx.fillRect(px, py, pSize, pSize);
    } else {
        ctx.beginPath();
        ctx.arc(px, py, pSize/2, 0, Math.PI*2);
        ctx.fill();
    }
}

// 3. Central Celestial Motif (Repo 1) - Corrupted
ctx.globalCompositeOperation = 'difference';
ctx.fillStyle = '#FFFFFF';
ctx.beginPath();
let starRadius = 20 + Math.sin(t_crystal * 5) * 10;
for(let i=0; i<8; i++) {
    let angle = (i/8) * Math.PI * 2 + D6;
    let r = i % 2 === 0 ? starRadius : starRadius * 0.3;
    let sx = cx + Math.cos(angle) * r;
    let sy = cy + Math.sin(angle) * r;
    if(i===0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
}
ctx.closePath();
ctx.fill();