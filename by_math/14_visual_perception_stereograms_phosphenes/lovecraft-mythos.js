const cx = grid.width / 2;
const cy = grid.height / 2;
const mx = mouse.x || cx;
const my = mouse.y || cy;

// The "Chaos Engineering" panic state
const panic = mouse.isPressed ? 5.0 : 1.0;
const t = time * panic;

// Palettes extracted from repository clash
// Psychedelic Pop meets Terminal Green meets Op-Art High Contrast
const POP_COLORS = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF3366', '#39FF14'];
const OS_LOGS = [
    "INIT: AZATHOTH_CPU_BOOT...",
    "WARN: RAFT_CLUSTER_DRIFT DETECTED",
    "ERR: MYSPACE_CSS_OVERFLOW",
    "PROC: RETINAL_SURREALISM.EXE",
    "CRIT: NON_EUCLIDEAN_MEMORY_LEAK",
    "MSG: CUTE_CTHULHU_AESTHETIC_APPLIED"
];

// Clean slate, deep void
ctx.fillStyle = '#080808';
ctx.fillRect(0, 0, grid.width, grid.height);

// --- LAYER 1: OP-ART / RADIAL HYPNOSIS BACKGROUND ---
// Simulates the churning center of the simulation OS
ctx.save();
ctx.translate(cx, cy);
ctx.rotate(t * 0.2);
const maxRadius = Math.hypot(cx, cy) * 1.5;

for (let r = maxRadius; r > 10; r -= 25) {
    ctx.beginPath();
    // Moire distortion based on mouse proximity
    const distortion = Math.sin(t * 3 + r * 0.02) * (mouse.isPressed ? 30 : 5);
    ctx.arc(distortion, 0, r, 0, Math.PI * 2);
    
    ctx.lineWidth = 10 + Math.sin(t + r * 0.1) * 8;
    ctx.strokeStyle = r % 50 === 0 ? POP_COLORS[0] : '#FFFFFF';
    
    // Early Internet aliased/raw look
    if (r % 75 === 0) {
        ctx.setLineDash([10, 15]);
    } else {
        ctx.setLineDash([]);
    }
    ctx.stroke();
}
ctx.restore();

// --- LAYER 2: THE PROCESS_ENTITY (Lovecraft + Psychedelic Pop) ---
// Tentacles mapped as OS process threads going rogue
const numThreads = 16;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

for (let i = 0; i < numThreads; i++) {
    const angle = (i / numThreads) * Math.PI * 2 + Math.sin(t * 0.5) * 0.5;
    const baseLength = grid.height * 0.45;
    
    // Chaos engineering: thread length fluctuates wildly
    const length = baseLength + Math.sin(t * 4 + i * 1.3) * 100 * panic;
    
    const endX = cx + Math.cos(angle) * length;
    const endY = cy + Math.sin(angle) * length;
    
    // Control points for bezier (organic, gooey movement)
    const cp1x = cx + Math.cos(angle + 1) * length * 0.4;
    const cp1y = cy + Math.sin(angle + 1) * length * 0.4;
    const cp2x = endX + Math.cos(angle - 1) * length * 0.2;
    const cp2y = endY + Math.sin(angle - 1) * length * 0.2;

    // Vector pop-art style: thick black outline, bright flat fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    
    // Outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 40;
    ctx.stroke();
    
    // Fill
    ctx.strokeStyle = POP_COLORS[i % POP_COLORS.length];
    ctx.lineWidth = 24;
    ctx.stroke();

    // Suction cups / Data nodes (Cute Pop motif)
    const steps = 4;
    for (let j = 1; j <= steps; j++) {
        const t_bez = j / steps;
        // Basic bezier interpolation for node placement
        const bx = Math.pow(1-t_bez, 3)*cx + 3*Math.pow(1-t_bez,2)*t_bez*cp1x + 3*(1-t_bez)*Math.pow(t_bez,2)*cp2x + Math.pow(t_bez,3)*endX;
        const by = Math.pow(1-t_bez, 3)*cy + 3*Math.pow(1-t_bez,2)*t_bez*cp1y + 3*(1-t_bez)*Math.pow(t_bez,2)*cp2y + Math.pow(t_bez,3)*endY;
        
        ctx.beginPath();
        ctx.arc(bx, by, 8 + Math.sin(t * 10 + j) * 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

// --- LAYER 3: THE ALL-SEEING KERNEL PANIC (Eye Object Iconography) ---
// A giant, cute, but unsettling eye serving as the CPU core
ctx.beginPath();
const eyeW = grid.width * 0.15 + Math.sin(t * 6) * 15 * panic;
const eyeH = grid.width * 0.1 + Math.cos(t * 4) * 10;
ctx.ellipse(cx, cy, eyeW, eyeH, 0, 0, Math.PI * 2);
ctx.fillStyle = '#FFFFFF';
ctx.fill();
ctx.lineWidth = 12;
ctx.strokeStyle = '#000000';
ctx.stroke();

// Iris (Chromatic Interference)
const dx = mx - cx;
const dy = my - cy;
const dist = Math.hypot(dx, dy);
const maxPupilShift = eyeW * 0.4;
const lookX = cx + (dx / dist) * Math.min(dist * 0.1, maxPupilShift) || cx;
const lookY = cy + (dy / dist) * Math.min(dist * 0.1, eyeH * 0.4) || cy;

ctx.beginPath();
ctx.arc(lookX, lookY, eyeH * 0.6, 0, Math.PI * 2);
ctx.fillStyle = POP_COLORS[1]; // Cyan
ctx.fill();
ctx.stroke();

// Pupil (Lovecraftian Slit + Op-Art geometry)
ctx.beginPath();
ctx.ellipse(lookX, lookY, eyeH * 0.1, eyeH * 0.5 + Math.sin(t*8)*10, 0, 0, Math.PI * 2);
ctx.fillStyle = '#000000';
ctx.fill();

// --- LAYER 4: SYSTEM OVERLAYS & CHROMATIC INTERFERENCE ---
// Simulating the "Lovecraft OS" failing to render the "Psychedelic Pop" cleanly
ctx.globalCompositeOperation = 'difference';

// Y2K/Early Web Glitch bars
const numGlitchBars = mouse.isPressed ? 20 : 5;
for (let i = 0; i < numGlitchBars; i++) {
    const yPos = (t * 200 + i * 150) % grid.height;
    ctx.fillStyle = POP_COLORS[i % POP_COLORS.length];
    ctx.fillRect(0, yPos, grid.width, 10 + Math.random() * 30);
}

ctx.globalCompositeOperation = 'source-over';

// Terminal Output Overlay (Dead Web Nostalgia + OS Architecture)
ctx.font = "bold 14px monospace";
ctx.textAlign = "left";

for (let i = 0; i < OS_LOGS.length; i++) {
    const logY = 40 + i * 25;
    // Glitch the x position slightly
    const logX = 20 + (Math.random() > 0.95 ? Math.random() * 10 - 5 : 0);
    
    // Text background box (Old web aesthetic)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textWidth = ctx.measureText(OS_LOGS[i]).width;
    ctx.fillRect(logX - 5, logY - 14, textWidth + 10, 20);
    
    // Text
    ctx.fillStyle = POP_COLORS[4]; // Terminal Lime Green
    
    // Corrupt text randomly
    let displayText = OS_LOGS[i];
    if (Math.random() > 0.9) {
        const chars = displayText.split('');
        chars[Math.floor(Math.random() * chars.length)] = String.fromCharCode(33 + Math.random() * 90);
        displayText = chars.join('');
    }
    
    ctx.fillText(displayText, logX, logY);
}

// Draw a fake cursor trailing behind the real one (Early internet custom cursors)
ctx.fillStyle = POP_COLORS[0];
ctx.beginPath();
ctx.moveTo(mx, my);
ctx.lineTo(mx + 15, my + 15);
ctx.lineTo(mx + 5, my + 20);
ctx.lineTo(mx, my + 30);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 2;
ctx.stroke();