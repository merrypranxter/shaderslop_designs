const w = grid.width;
const h = grid.height;

// Core background - crushed blacks of an old tape
ctx.fillStyle = '#030405';
ctx.fillRect(0, 0, w, h);

const t = time;
const trackingSpeed = 140;
// Non-linear wrapping tracking tear
const trackingY = (t * trackingSpeed) % (h * 1.8) - h * 0.4;

// The Strange Mechanism: The geometry itself is routed through a failing analog head.
// We distort the X coordinate based on Y position and time before drawing.
const getVhsOffset = (y) => {
    let dx = Math.sin(y * 0.015 + t * 4) * 2; // Tape wow & flutter
    
    // Heavy localized tracking tear
    let dist = Math.abs(y - trackingY);
    if (dist < 80) {
        let tearForce = Math.pow((80 - dist) / 80, 2);
        // High frequency noise in the tear
        dx += Math.sin(y * 1.2 - t * 20) * 40 * tearForce;
        dx += (Math.sin(y * 45.3 + t) * 15) * tearForce; // jagged edges
    }
    
    // Head switching noise at the very bottom
    if (y > h - 45) {
        dx += Math.sin(y * 10 + t * 50) * 20 + (Math.random() - 0.5) * 15;
    }
    
    // Sudden magnetic dropouts
    if (Math.sin(y * 0.1 + t * 12) > 0.995) {
        dx += (Math.random() - 0.5) * 150;
    }
    
    return dx;
};

// Setup for chroma separation (damage_aesthetics: chroma_luma_failures)
ctx.globalCompositeOperation = 'screen';
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// R, G, B channels misaligned
const channels = [
    { color: '#FF1133', off: 3 + Math.sin(t * 7) * 4 },
    { color: '#11FF33', off: -1 + Math.cos(t * 3) * 1 },
    { color: '#1133FF', off: -4 - Math.sin(t * 5) * 3 }
];

let cx = w / 2;
let cy = h / 2;

channels.forEach(ch => {
    const c = ch.color;
    const ox = ch.off;
    
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    
    // --- 1. THE ASTRAL ANU (Victorian Theosophy Hardware) ---
    // A complex, interlaced, dimensional coil structure
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let s = 0; s < 7; s++) {
        let sPhase = (s / 7) * Math.PI * 2;
        for (let i = 0; i <= 200; i++) {
            let p = i / 200;
            // Theosophical heart-shape projection
            let angle = p * Math.PI * 24 + t * 0.8 + sPhase;
            let r = 160 * Math.sin(p * Math.PI) * (1 + 0.2 * Math.sin(p * Math.PI * 12 - t*2));
            
            let x = cx + Math.cos(angle) * r;
            let y = cy + (p - 0.5) * 350 + Math.sin(angle) * 30; // 3D pitch
            
            let dx = getVhsOffset(y) + ox;
            if (i === 0) ctx.moveTo(x + dx, y);
            else ctx.lineTo(x + dx, y);
        }
    }
    ctx.stroke();

    // --- 2. ELEMENTAL GEOMETRIES (Containment fields) ---
    ctx.lineWidth = 0.8;
    for(let r = 80; r <= 320; r += 60) {
        ctx.beginPath();
        let segs = r * 1.5;
        for(let i = 0; i <= segs; i++) {
            let angle = (i / segs) * Math.PI * 2 + (r % 120 === 0 ? t * 0.3 : -t * 0.2);
            let x = cx + Math.cos(angle) * r;
            let y = cy + Math.sin(angle) * r * 0.8; // slight isometric squash
            
            let dx = getVhsOffset(y) + ox;
            if(i === 0) ctx.moveTo(x + dx, y);
            else ctx.lineTo(x + dx, y);
        }
        ctx.stroke();
    }

    // --- 3. ON SCREEN DISPLAY (Early Internet / Glitchcore UI) ---
    ctx.font = 'bold 16px monospace';
    
    const drawText = (txt, px, py) => {
        let dx = getVhsOffset(py) + ox;
        // Text databending: randomly swap chars to simulate bad memory reads
        let out = txt.split('').map(char => {
            if (char === ' ') return char;
            return Math.random() < 0.03 ? String.fromCharCode(33 + Math.floor(Math.random() * 90)) : char;
        }).join('');
        ctx.fillText(out, px + dx, py);
    };

    // VCR UI
    if (t % 2 < 1.5) drawText("PLAY ►", 50, 60);
    drawText("SP", 50, 85);
    
    // Timecode
    let tcH = Math.floor(t / 3600).toString().padStart(2, '0');
    let tcM = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    let tcS = Math.floor(t % 60).toString().padStart(2, '0');
    let tcF = Math.floor((t * 30) % 30).toString().padStart(2, '0');
    drawText(`TCR ${tcH}:${tcM}:${tcS}:${tcF}`, w - 220, 60);
    
    // Repo metadata overlay
    ctx.font = '12px monospace';
    drawText("ASTRAL_OS // ANU_KERNEL_LOAD", 50, h - 100);
    drawText("ERR: broadcast_signal_failure", 50, h - 80);
    drawText("TARGET: shadow_strand_architecture.json", 50, h - 60);
    drawText("SYS: signal-density-system OVERLOAD", 50, h - 40);

    // Esoteric hex dumps
    for(let i = 0; i < 8; i++) {
        let mem = Math.floor(Math.abs(Math.sin(t*0.1 + i)) * 0xFFFFF).toString(16).toUpperCase().padStart(5, '0');
        drawText(`0x${mem}`, w - 100, h - 180 + i * 18);
    }
});

// --- 4. ANALOG ARTIFACTS & TAPE DAMAGE OVERLAYS ---
ctx.globalCompositeOperation = 'source-over';

// White noise speckles in the tracking tear
if (trackingY > 0 && trackingY < h) {
    ctx.fillStyle = `rgba(200, 220, 255, ${0.1 + Math.random() * 0.2})`;
    for (let i = 0; i < 150; i++) {
        let nx = Math.random() * w;
        let ny = trackingY + (Math.random() - 0.5) * 120;
        let nw = Math.random() * 80 + 5;
        let nh = Math.random() * 3 + 1;
        ctx.fillRect(nx, ny, nw, nh);
    }
}

// Random horizontal dropout streaks
ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
for (let i = 0; i < 8; i++) {
    let y = Math.random() * h;
    let bandH = Math.random() * 3 + 1;
    let bandW = Math.random() * w;
    let bandX = Math.random() * (w - bandW);
    ctx.fillRect(bandX, y, bandW, bandH);
}

// CRT Scanlines (thick, dark, interlaced feel)
ctx.fillStyle = 'rgba(0, 0, 5, 0.35)';
for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
}

// Luma crushing vignette
let grad = ctx.createRadialGradient(w/2, h/2, h*0.4, w/2, h/2, h*0.9);
grad.addColorStop(0, 'rgba(0,0,0,0)');
grad.addColorStop(1, 'rgba(0,0,0,0.8)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, w, h);