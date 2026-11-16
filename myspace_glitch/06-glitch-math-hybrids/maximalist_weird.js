const w = canvas.width;
const h = canvas.height;
const cx = w / 2;
const cy = h / 2;

// Initialize the feral state
if (!canvas.weirdState) {
    canvas.weirdState = {
        nodes: [],
        glitchBuffer: document.createElement('canvas'),
        packets: [
            "NODE01_TEMPORAL_RECURSION", "NODE02_OBSERVER_EFFECT", 
            "NODE06_CHURNING_OCEAN", "NODE08_SHIVAS_TANDAVA", 
            "FATAL_CODEC_CORRUPTION", "PALETTE_ENERGY_OVERLOAD"
        ],
        inkSplats: []
    };
    canvas.weirdState.glitchBuffer.width = w;
    canvas.weirdState.glitchBuffer.height = h;
    
    // Generate Indra's Net nodes
    for (let i = 0; i < 150; i++) {
        canvas.weirdState.nodes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            freq: Math.random() * 0.1,
            phase: Math.random() * Math.PI * 2,
            mass: Math.random() * 10 + 1
        });
    }
}

const s = canvas.weirdState;
const gCtx = s.glitchBuffer.getContext('2d');

// --- 1. TEMPORAL RECURSION (Smear & Fade) ---
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = mouse.isPressed ? 'rgba(255, 255, 255, 0.1)' : 'rgba(5, 2, 10, 0.08)';
ctx.fillRect(0, 0, w, h);

// --- 2. VEDIC OS / GLITCHCORE TYPOGRAPHY ---
ctx.globalCompositeOperation = 'screen';
if (Math.random() > 0.9) {
    ctx.font = `900 ${Math.random() * 60 + 20}px monospace`;
    ctx.fillStyle = `hsla(${Math.random() * 360}, 100%, 50%, 0.3)`;
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.rotate((Math.random() - 0.5) * 0.5);
    ctx.fillText(s.packets[Math.floor(Math.random() * s.packets.length)], -w/2 + Math.random()*200, (Math.random()-0.5)*h);
    ctx.restore();
}

// --- 3. INDRA'S NET & SHIVA'S TANDAVA (Particle Physics) ---
const mouseOverclock = mouse.isPressed ? 5 : 1;
ctx.lineWidth = 1;

for (let i = 0; i < s.nodes.length; i++) {
    let n = s.nodes[i];
    
    // Cosmic vibratory substrate movement
    n.vx += Math.sin(time * n.freq + n.phase) * 0.5;
    n.vy += Math.cos(time * n.freq + n.phase) * 0.5;
    
    // Observer Effect (Mouse interaction)
    let dx = mouse.x - n.x;
    let dy = mouse.y - n.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 250) {
        let force = (250 - dist) / 250;
        n.vx -= (dx / dist) * force * 2 * mouseOverclock;
        n.vy -= (dy / dist) * force * 2 * mouseOverclock;
        
        // Steadman Ink Splatter Injection
        if (Math.random() > 0.95) {
            s.inkSplats.push({
                x: n.x, y: n.y,
                vx: -dx * 0.1 + (Math.random()-0.5)*10,
                vy: -dy * 0.1 + (Math.random()-0.5)*10,
                life: 1.0,
                color: `hsl(${(time*200 + dist)%360}, 100%, 50%)`
            });
        }
    }
    
    n.vx *= 0.9; // Friction
    n.vy *= 0.9;
    n.x += n.vx * mouseOverclock;
    n.y += n.vy * mouseOverclock;
    
    // Screen wrap (Multiverse boundary)
    if (n.x < 0) n.x = w; if (n.x > w) n.x = 0;
    if (n.y < 0) n.y = h; if (n.y > h) n.y = 0;

    // Draw Node
    ctx.fillStyle = `hsl(${(time * 50 + n.mass * 20) % 360}, 100%, 60%)`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, Math.abs(Math.sin(time * 3 + n.phase)) * n.mass, 0, Math.PI * 2);
    ctx.fill();

    // Draw Net Connections
    for (let j = i + 1; j < s.nodes.length; j++) {
        let n2 = s.nodes[j];
        let d2 = Math.sqrt((n.x-n2.x)**2 + (n.y-n2.y)**2);
        if (d2 < 80) {
            ctx.strokeStyle = `hsla(${(time * 100) % 360}, 100%, 50%, ${1 - d2/80})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            // Steadman jagged connection
            ctx.quadraticCurveTo(n.x + (Math.random()-0.5)*50, n.y + (Math.random()-0.5)*50, n2.x, n2.y);
            ctx.stroke();
        }
    }
}

// --- 4. RALPH STEADMAN GONZO INK SPLATTERS ---
ctx.globalCompositeOperation = 'source-over';
for (let i = s.inkSplats.length - 1; i >= 0; i--) {
    let splat = s.inkSplats[i];
    splat.x += splat.vx;
    splat.y += splat.vy;
    splat.life -= 0.02;
    splat.vy += 0.5; // Gravity pull on ink
    
    ctx.fillStyle = splat.color;
    ctx.beginPath();
    // Grotesque, uneven blobs
    for(let a = 0; a < Math.PI * 2; a += 0.5) {
        let r = Math.random() * 15 * splat.life + 2;
        if (Math.random() > 0.8) r += Math.random() * 40 * splat.life; // Sharp spikes
        ctx.lineTo(splat.x + Math.cos(a)*r, splat.y + Math.sin(a)*r);
    }
    ctx.fill();

    if (splat.life <= 0) s.inkSplats.splice(i, 1);
}

// --- 5. GLITCHCORE CODEC CORRUPTION (RGB Shift & Tearing) ---
if (Math.random() > (mouse.isPressed ? 0.3 : 0.85)) {
    gCtx.clearRect(0, 0, w, h);
    gCtx.drawImage(canvas, 0, 0);
    
    // Tearing
    let tearY = Math.random() * h;
    let tearH = Math.random() * 150 + 10;
    let shiftX = (Math.random() - 0.5) * 200;
    
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(s.glitchBuffer, 0, tearY, w, tearH, shiftX, tearY, w, tearH);
    
    // RGB Channel Separation (Chromatic Aberration via Lighter)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(shiftX, tearY, w, tearH);
    ctx.drawImage(s.glitchBuffer, 0, tearY, w, tearH, shiftX + 10, tearY, w, tearH);
}

// Random absolute void squares (Dead Pixels/Artifact Drivers)
ctx.globalCompositeOperation = 'source-over';
for(let k=0; k<5; k++) {
    if(Math.random() > 0.5) {
        ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
        let sz = Math.random() * 30 + 5;
        ctx.fillRect(Math.random() * w, Math.random() * h, sz, sz);
    }
}