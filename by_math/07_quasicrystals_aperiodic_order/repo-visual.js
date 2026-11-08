const w = grid.width;
const h = grid.height;
let mx = mouse.x || w/2;
let my = mouse.y || h/2;
let isPressed = mouse.isPressed;

// Initialize persistent state for Quasicrystal and MySpace debris
if (!window.weirdStateInitialized || window.lastInput !== input) {
    window.lastInput = input;
    window.weirdStateInitialized = true;
    
    // Generate Fibonacci Word for Aperiodic Tiling (1D Quasicrystal projection)
    let temp = "LS";
    for (let i = 0; i < 7; i++) {
        let next = "";
        for (let j = 0; j < temp.length; j++) {
            next += temp[j] === 'L' ? "LS" : "L";
        }
        temp = next;
    }
    window.fibWord = temp;

    // Initialize MySpace Text and Sparkle Debris
    window.myDebris = [];
    const texts = [
        "xoxo", "loading...", "ERROR 404", "<3", "brb", "glitch", "tau=1.618", 
        "seen 2:34am", "connection lost", "beautiful malfunction", "hyperpop rupture",
        input || "candy broadcast"
    ];
    for (let i = 0; i < 45; i++) {
        window.myDebris.push({
            x: Math.random() * w,
            y: Math.random() * h,
            type: Math.random() > 0.65 ? 'text' : 'sparkle',
            text: texts[Math.floor(Math.random() * texts.length)],
            speedY: (Math.random() - 0.5) * 1.5,
            speedX: (Math.random() - 0.5) * 1.5,
            size: Math.random() * 18 + 12,
            phase: Math.random() * Math.PI * 2
        });
    }

    // Initialize Offscreen Canvas for Glitch Compositing
    if (!window.offCanvas) {
        window.offCanvas = document.createElement('canvas');
        window.offCtx = window.offCanvas.getContext('2d');
    }
    
    // Initialize Ditherpunk Bayer Matrix Pattern
    const dC = document.createElement('canvas');
    dC.width = 4; dC.height = 4;
    const dCtx = dC.getContext('2d');
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const imgData = dCtx.createImageData(4, 4);
    for (let i = 0; i < 16; i++) {
        imgData.data[i*4] = 0; imgData.data[i*4+1] = 0; imgData.data[i*4+2] = 0;
        imgData.data[i*4+3] = (bayer[i] / 16) * 255 > 128 ? 85 : 0;
    }
    dCtx.putImageData(imgData, 0, 0);
    window.ditherPattern = ctx.createPattern(dC, 'repeat');

    // Initialize CRT Scanline Pattern
    const sC = document.createElement('canvas');
    sC.width = 1; sC.height = 4;
    const sCtx = sC.getContext('2d');
    sCtx.fillStyle = 'rgba(0,0,0,0.4)';
    sCtx.fillRect(0, 0, 1, 2);
    window.scanlinePattern = ctx.createPattern(sC, 'repeat');
}

const offC = window.offCanvas;
const offCtx = window.offCtx;
if (offC.width !== w || offC.height !== h) {
    offC.width = w;
    offC.height = h;
}

// 1. TEMPORAL ECHO (Phosphor Noir Background)
let targetScale = isPressed ? 120 : 35 + Math.sin(time * 0.5) * 15;
window.currentScale = window.currentScale || 35;
window.currentScale += (targetScale - window.currentScale) * 0.08;
let baseScale = window.currentScale;

let fade = isPressed ? 0.08 : 0.3 - Math.sin(time) * 0.1;
let bgR = Math.floor(Math.sin(time * 0.2) * 5 + 10);
let bgG = Math.floor(Math.sin(time * 0.3) * 5 + 5);
let bgB = Math.floor(Math.sin(time * 0.25) * 10 + 15);

ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = `rgba(${bgR}, ${bgG}, ${bgB}, ${fade})`;
ctx.fillRect(0, 0, w, h);

// Clear offscreen for fresh geometry
offCtx.clearRect(0, 0, w, h);

// 2. APERIODIC LATTICE (De Bruijn Pentagrid / Penrose Projection)
const cx = w / 2 + Math.sin(time * 0.3) * 40;
const cy = h / 2 + Math.cos(time * 0.4) * 40;
const PHI = 1.6180339887;

offCtx.globalCompositeOperation = 'lighter';
offCtx.lineWidth = 1.5;

const palettes = [
    ['#FF0080', '#00FFFF'], // Hot Magenta, Electric Cyan
    ['#00FFFF', '#FFFAFA'], // Cyan, Pearl White
    ['#FF0080', '#FFFAFA'], // Magenta, Pearl White
    ['#8A2BE2', '#00FFFF'], // Blue Violet, Cyan
    ['#FF1493', '#FFD700']  // Deep Pink, Bright Gold
];

for (let i = 0; i < 5; i++) {
    let angle = i * Math.PI / 5 + time * 0.05;
    let nx = Math.cos(angle);
    let ny = Math.sin(angle);
    let col = palettes[i];
    
    let pos = 0;
    let distances = [0];
    for (let char of window.fibWord) {
        pos += (char === 'L' ? PHI : 1) * baseScale;
        distances.push(pos);
        distances.push(-pos);
    }
    
    for (let j = 0; j < distances.length; j++) {
        let d = distances[j];
        d += Math.sin(time + d * 0.01) * 15; // Temporal drift
        
        let lineAlpha = Math.max(0.05, 1.0 - Math.abs(d) / (w * 0.8));
        offCtx.strokeStyle = col[j % 2];
        offCtx.globalAlpha = lineAlpha;
        offCtx.beginPath();
        
        let isFirst = true;
        for (let s = -w; s <= w; s += 40) {
            let x = cx + d * nx - s * ny;
            let y = cy + d * ny + s * nx;
            
            // Magnetic Anomaly / Candy Crash Compression Zone
            if (Math.abs(x - mx) < 350 && Math.abs(y - my) < 350) {
                let dx = x - mx;
                let dy = y - my;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 350) {
                    let block = 48;
                    let bx = Math.floor(x / block) * block;
                    let by = Math.floor(y / block) * block;
                    let force = Math.pow((350 - dist)/350, 2) * (isPressed ? 400 : 120);
                    x += (dx/dist) * force + Math.sin(time * 8 + bx * 0.02) * 25;
                    y += (dy/dist) * force + Math.cos(time * 8 + by * 0.02) * 25;
                }
            }
            
            // Edge Chatter
            if (Math.random() < 0.03) {
                x += (Math.random() - 0.5) * 20;
                y += (Math.random() - 0.5) * 20;
            }
            
            if (isFirst) { offCtx.moveTo(x, y); isFirst = false; } 
            else { offCtx.lineTo(x, y); }
        }
        offCtx.stroke();
    }
}

// 3. MYSPACE DEBRIS (Text & Sparkles)
offCtx.globalAlpha = 1.0;
offCtx.textAlign = 'center';
offCtx.textBaseline = 'middle';

for (let d of window.myDebris) {
    d.x += d.speedX;
    d.y += d.speedY;
    d.phase += 0.04;
    
    if (d.x < -50) d.x = w + 50; if (d.x > w + 50) d.x = -50;
    if (d.y < -50) d.y = h + 50; if (d.y > h + 50) d.y = -50;
    
    let dx = d.x - mx; let dy = d.y - my;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 200) {
        d.x += (dx / dist) * 8;
        d.y += (dy / dist) * 8;
    }
    
    let alpha = Math.sin(d.phase) * 0.4 + 0.6;
    
    if (d.type === 'text') {
        offCtx.font = `bold ${d.size}px monospace`;
        offCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        offCtx.shadowColor = '#FF0080';
        offCtx.shadowBlur = 12;
        
        let txt = d.text;
        if (Math.random() < 0.06) {
            const chars = "!<>-_\\/[]{}—=+*^?#_";
            txt = txt.split('').map(c => Math.random() > 0.6 ? chars[Math.floor(Math.random()*chars.length)] : c).join('');
        }
        offCtx.fillText(txt, d.x, d.y);
        offCtx.shadowBlur = 0;
    } else {
        offCtx.shadowColor = '#00FFFF';
        offCtx.shadowBlur = 15;
        offCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        offCtx.beginPath();
        let s = d.size;
        offCtx.moveTo(d.x, d.y - s);
        offCtx.quadraticCurveTo(d.x, d.y, d.x + s, d.y);
        offCtx.quadraticCurveTo(d.x, d.y, d.x, d.y + s);
        offCtx.quadraticCurveTo(d.x, d.y, d.x - s, d.y);
        offCtx.quadraticCurveTo(d.x, d.y, d.x, d.y - s);
        offCtx.fill();
        offCtx.shadowBlur = 0;
    }
}

// 4. COMPRESSION CHEW & MACROBLOCK TEAR
ctx.globalCompositeOperation = 'lighter';
let sliceH = 56;
for (let y = 0; y < h; y += sliceH) {
    let sh = Math.min(sliceH, h - y);
    if (Math.random() < (isPressed ? 0.25 : 0.03)) {
        let offsetX = (Math.random() - 0.5) * (isPressed ? 200 : 60);
        ctx.drawImage(offC, 0, y, w, sh, offsetX, y, w, sh);
    } else {
        ctx.drawImage(offC, 0, y, w, sh, 0, y, w, sh);
    }
}

// 5. RGB PHANTOM (Phase Lag Duplication)
ctx.globalCompositeOperation = 'screen';
ctx.globalAlpha = 0.55;
ctx.drawImage(offC, Math.sin(time * 2.2) * 18, Math.cos(time * 2.7) * 18);
ctx.globalAlpha = 0.35;
ctx.drawImage(offC, -Math.sin(time * 3.1) * 28, -Math.cos(time * 1.6) * 28);
ctx.globalAlpha = 1.0;

// 6. BLOOM CONTAMINATION
ctx.filter = 'blur(14px)';
ctx.globalCompositeOperation = 'screen';
ctx.globalAlpha = 0.5;
ctx.drawImage(offC, 0, 0);
ctx.filter = 'none';

// 7. DITHERPUNK & CRT SCANLINES
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 1.0;
ctx.fillStyle = window.ditherPattern;
ctx.fillRect(0, 0, w, h);
ctx.fillStyle = window.scanlinePattern;
ctx.fillRect(0, 0, w, h);