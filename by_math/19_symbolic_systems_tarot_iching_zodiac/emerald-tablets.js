const pCanvas = canvas.pop || (canvas.pop = document.createElement('canvas'));
if (pCanvas.width !== grid.width || pCanvas.height !== grid.height) {
    pCanvas.width = grid.width;
    pCanvas.height = grid.height;
    canvas.pCtx = pCanvas.getContext('2d');
}
const pCtx = canvas.pCtx;

const cx = grid.width / 2;
const cy = grid.height / 2;

// LAYER 1: EMERALD OS (The esoteric terminal void)
ctx.fillStyle = '#020a05';
ctx.fillRect(0, 0, grid.width, grid.height);

const fontSize = 18;
ctx.font = `${fontSize}px monospace`;
const cols = Math.floor(grid.width / fontSize) + 1;
const rows = Math.floor(grid.height / fontSize) + 1;

const esotericLexicon = [
    "THOTH", "AMENTI", "ANTI-DRIFT", "EMERALD_OS", "PSYCHEDELIC_POP", 
    "FLATNESS_RULES", "AS_ABOVE", "SO_BELOW", "MERKABA", "CRYSTAL_RESONANCE",
    "badge_forces_v1.jpg", "analog-artifacts.md", "ERROR: CONTAINMENT_BREACH"
];
const glyphs = "∆∇☿♁♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓";

ctx.textAlign = 'left';
ctx.textBaseline = 'top';

for (let x = 0; x < cols; x++) {
    // Columns shift in opposite directions, bureaucratic failure style
    let speed = (x % 2 === 0 ? 1 : -1) * (15 + (x % 5) * 10);
    let offset = time * speed;
    
    for (let y = 0; y < rows; y++) {
        let yy = (y * fontSize + offset) % grid.height;
        if (yy < 0) yy += grid.height;
        
        // Deterministic chaos seed
        let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        
        let char;
        if (n % 1 < 0.02) char = glyphs[Math.floor(Math.abs(n) * 100) % glyphs.length];
        else char = String.fromCharCode(33 + Math.floor(Math.abs(n) * 90));
        
        // Corrupt some areas with raw file names
        if (n % 1 < 0.005) {
            let word = esotericLexicon[Math.floor(Math.abs(n) * 100) % esotericLexicon.length];
            ctx.fillStyle = '#00FF66';
            ctx.fillText(word, x * fontSize, yy);
            y += Math.floor(word.length / 2); // skip a few to avoid overlap
            continue;
        }
        
        ctx.fillStyle = (n % 1 < 0.01) ? '#ffffff' : ((n % 1 < 0.15) ? '#00ff44' : '#003311');
        ctx.fillText(char, x * fontSize, yy);
    }
}

// LAYER 1.5: THE THOTH GEOMETRY (Golden/Emerald containment sigil)
ctx.save();
ctx.translate(cx, cy);
ctx.rotate(time * 0.1);
ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
ctx.lineWidth = 2;

for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.strokeRect(-120, -120, 240, 240);
    ctx.beginPath();
    ctx.arc(0, 0, 170, 0, Math.PI * 2);
    ctx.stroke();
}

ctx.rotate(-time * 0.2);
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = 'bold 36px monospace';
ctx.fillStyle = '#00FF66';
ctx.fillText("AS ABOVE", 0, -70);
ctx.fillText("SO BELOW", 0, 70);
ctx.restore();


// LAYER 2: PSYCHEDELIC POP VEIL (Offscreen Canvas)
pCtx.clearRect(0, 0, grid.width, grid.height);

const popColors = ['#FF0055', '#FFD700', '#00F0FF', '#7000FF'];
pCtx.lineWidth = 6;
pCtx.strokeStyle = '#050505'; // Anti-drift bold outlines

let maxR = Math.max(grid.width, grid.height) * 1.2;
let ringSpacing = 70 + Math.sin(time * 0.5) * 20;

for (let r = maxR; r > 0; r -= ringSpacing) {
    let cIdx = Math.floor((r - time * 120) / ringSpacing) % popColors.length;
    if (cIdx < 0) cIdx += popColors.length;
    pCtx.fillStyle = popColors[cIdx];
    
    pCtx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        // Flatness rules corrupted by celestial wobble
        let deform = Math.sin(a * 7 + time * 2) * 35 + Math.cos(a * 4 - time) * 20;
        let rx = cx + Math.cos(a) * (r + deform);
        let ry = cy + Math.sin(a) * (r + deform);
        if (a === 0) pCtx.moveTo(rx, ry);
        else pCtx.lineTo(rx, ry);
    }
    pCtx.closePath();
    pCtx.fill();
    pCtx.stroke();
}


// LAYER 3: ALCHEMICAL ERASURE (Carving holes in the pop reality)
pCtx.globalCompositeOperation = 'destination-out';

// The Central Tablet / Hexagon
pCtx.save();
pCtx.translate(cx, cy);
let cutRadius = 220 + Math.sin(time * 3) * 10; // Breathing tension
pCtx.rotate(-time * 0.15);

pCtx.beginPath();
for (let i = 0; i < 6; i++) {
    let a = (i / 6) * Math.PI * 2;
    let x = Math.cos(a) * cutRadius;
    let y = Math.sin(a) * cutRadius;
    if (i === 0) pCtx.moveTo(x, y);
    else pCtx.lineTo(x, y);
}
pCtx.closePath();
pCtx.fill();

// Orbiting Crystal Shards (from merry-style motifs)
for (let i = 0; i < 5; i++) {
    let sa = time * 0.8 + i * ((Math.PI * 2) / 5);
    let sr = 350 + Math.sin(time * 2 + i) * 50;
    let sx = Math.cos(sa) * sr;
    let sy = Math.sin(sa) * sr;
    
    pCtx.save();
    pCtx.translate(sx, sy);
    pCtx.rotate(time * 2 + i);
    pCtx.beginPath();
    pCtx.moveTo(0, -50);
    pCtx.lineTo(30, 0);
    pCtx.lineTo(0, 50);
    pCtx.lineTo(-30, 0);
    pCtx.closePath();
    pCtx.fill();
    pCtx.restore();
}
pCtx.restore();

// The Scrying Interaction (Parasite host logic via mouse)
pCtx.beginPath();
let scryRadius = mouse.isPressed ? 250 + Math.random() * 20 : 60;
pCtx.arc(mouse.x, mouse.y, scryRadius, 0, Math.PI * 2);
pCtx.fill();

// Reset compositing
pCtx.globalCompositeOperation = 'source-over';


// COMPOSITING & ANALOG ARTIFACTS
ctx.drawImage(pCanvas, 0, 0);

// Glitch / Misregistration (System overheated)
if (Math.sin(time * 8) > 0.92) {
    let gY = Math.random() * grid.height;
    let gH = Math.random() * 80 + 20;
    let gX = (Math.random() - 0.5) * 60;
    ctx.drawImage(pCanvas, 0, gY, grid.width, gH, gX, gY, grid.width, gH);
}

// Analog Scanlines
ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
for (let y = 0; y < grid.height; y += 4) {
    ctx.fillRect(0, y, grid.width, 1);
}

// VHS Tracking Line
let trackY = (time * 200) % grid.height;
ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
ctx.fillRect(0, trackY, grid.width, 12);
ctx.fillStyle = 'rgba(0, 255, 102, 0.25)';
ctx.fillRect(0, trackY + 18, grid.width, 3);

// Chromatic Dust / Dead Pixels
let dustCount = mouse.isPressed ? 200 : 50;
for (let i = 0; i < dustCount; i++) {
    let dx = Math.random() * grid.width;
    let dy = Math.random() * grid.height;
    ctx.fillStyle = Math.random() > 0.5 ? '#FF0055' : '#00FF66';
    ctx.fillRect(dx, dy, 2, 2);
}