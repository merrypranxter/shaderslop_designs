const w = canvas.width;
const h = canvas.height;

if (!window.__feral_tapestry) {
    window.__feral_tapestry = {
        particles: [],
        osCanvas: document.createElement('canvas'),
        osCtx: null,
        w: 0, h: 0,
        colors: ['#FF007F', '#00E5FF', '#FFEA00', '#B200FF', '#FF3300']
    };
}

let state = window.__feral_tapestry;

if (state.w !== w || state.h !== h) {
    state.w = w;
    state.h = h;
    state.osCanvas.width = w;
    state.osCanvas.height = h;
    state.osCtx = state.osCanvas.getContext('2d', { alpha: false });
    state.osCtx.fillStyle = '#0a0011';
    state.osCtx.fillRect(0, 0, w, h);
    
    state.particles = [];
    for (let i = 0; i < 4000; i++) {
        state.particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            a: Math.random() * Math.PI * 2,
            s: 1 + Math.random() * 2,
            c: state.colors[Math.floor(Math.random() * state.colors.length)],
            life: Math.random() * 100
        });
    }
}

let osCtx = state.osCtx;

osCtx.globalCompositeOperation = 'source-over';
osCtx.fillStyle = `rgba(10, 0, 17, 0.04)`;
osCtx.fillRect(0, 0, w, h);

osCtx.globalCompositeOperation = 'lighter';

const panic = mouse.isPressed ? 5.0 : 1.0;
const timePhase = time * 0.5;

for (let p of state.particles) {
    let nx = Math.sin(p.y * 0.015) + Math.cos(p.x * 0.011 + timePhase);
    let ny = Math.cos(p.x * 0.015) + Math.sin(p.y * 0.011 - timePhase);
    
    let whiplash = Math.sin((p.x + p.y) * 0.03) * 1.5;
    
    let targetAngle = Math.atan2(ny + whiplash, nx - whiplash);

    if (mouse.isPressed) {
        let dx = p.x - mouse.x;
        let dy = p.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
            targetAngle = Math.atan2(dy, dx) + Math.PI / 2; 
        }
    }

    p.a += (targetAngle - p.a) * 0.1 * panic;
    
    let nextX = p.x + Math.cos(p.a) * p.s * panic;
    let nextY = p.y + Math.sin(p.a) * p.s * panic;

    osCtx.strokeStyle = p.c;
    osCtx.lineWidth = mouse.isPressed ? 3 : 1.2;
    osCtx.beginPath();
    osCtx.moveTo(p.x, p.y);
    osCtx.lineTo(nextX, nextY);
    osCtx.stroke();

    p.x = nextX;
    p.y = nextY;
    p.life -= 0.1;

    if (p.x < 0) p.x += w;
    if (p.x > w) p.x -= w;
    if (p.y < 0) p.y += h;
    if (p.y > h) p.y -= h;

    if (p.life <= 0) {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.life = 50 + Math.random() * 100;
        p.c = state.colors[Math.floor(Math.random() * state.colors.length)];
    }
}

ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, w, h);

let glitchSeverity = Math.sin(time * 2.3) * Math.cos(time * 1.7);
let isGlitching = glitchSeverity > 0.6 || mouse.isPressed;

if (isGlitching) {
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(state.osCanvas, (Math.random() - 0.5) * 10, 0);
    ctx.drawImage(state.osCanvas, (Math.random() - 0.5) * -10, 0);
} else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.osCanvas, 0, 0);
}

ctx.globalCompositeOperation = 'source-over';
if (isGlitching || Math.random() > 0.95) {
    let tears = Math.floor(Math.random() * 8) + 2;
    for (let i = 0; i < tears; i++) {
        let ty = Math.random() * h;
        let th = Math.random() * 40 + 5;
        let tx = (Math.random() - 0.5) * (mouse.isPressed ? 200 : 50);
        
        ctx.drawImage(state.osCanvas, 0, ty, w, th, tx, ty, w, th);
        
        if (Math.random() > 0.7) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = state.colors[Math.floor(Math.random() * state.colors.length)];
            ctx.fillRect(tx, ty, w, th);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}

let trackingY = (time * 200) % (h + 100) - 50;
ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
ctx.fillRect(0, trackingY, w, 15 + Math.random() * 10);
ctx.fillStyle = `rgba(0, 229, 255, ${Math.random() * 0.1})`;
ctx.fillRect(0, trackingY - 5, w, 5);

if (Math.random() > 0.98) {
    ctx.fillStyle = `rgba(255, 0, 127, 0.2)`;
    ctx.fillRect(0, 0, w, h);
}