const W = grid.width;
const H = grid.height;

// Generate Lisa Frank offscreen sprites on first run for massive performance
if (!canvas.__lisaFrankSprites) {
    canvas.__lisaFrankSprites = [];
    const colors = [
        { out: '#FF00FF', in: '#00FFFF' }, // Magenta / Cyan
        { out: '#00FFFF', in: '#FFFF00' }, // Cyan / Yellow
        { out: '#FFFF00', in: '#FF00FF' }, // Yellow / Magenta
        { out: '#00FF00', in: '#8A2BE2' }, // Lime / Purple
        { out: '#8A2BE2', in: '#00FF00' }, // Purple / Lime
        { out: '#FF1493', in: '#7FFF00' }, // Deep Pink / Chartreuse
        { out: '#FF4500', in: '#00BFFF' }, // Orange Red / Sky Blue
        { out: '#7FFF00', in: '#FF1493' }, // Chartreuse / Deep Pink
        { out: '#00BFFF', in: '#FF4500' }, // Sky Blue / Orange Red
        { out: '#FF00FF', in: '#FFFF00' }  // Magenta / Yellow
    ];
    
    for (let i = 0; i < 10; i++) {
        const c = colors[i];
        const sc = document.createElement('canvas');
        sc.width = 64;
        sc.height = 64;
        const sctx = sc.getContext('2d');
        sctx.translate(32, 32);
        
        // Alternate between Leopard Spots and Neon Stars
        if (i % 2 === 0) {
            sctx.shadowBlur = 8;
            sctx.shadowColor = c.out;
            sctx.beginPath();
            for(let a = 0; a < Math.PI * 2; a += 0.3) {
                const rr = 18 * (0.8 + 0.2 * Math.sin(a * 5 + i));
                sctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            sctx.closePath();
            sctx.fillStyle = c.out;
            sctx.fill();
            
            sctx.shadowBlur = 0;
            sctx.beginPath();
            for(let a = 0; a < Math.PI * 2; a += 0.3) {
                const rr = 10 * (0.8 + 0.2 * Math.cos(a * 4 + i));
                sctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            sctx.closePath();
            sctx.fillStyle = c.in;
            sctx.fill();
        } else {
            sctx.shadowBlur = 10;
            sctx.shadowColor = c.out;
            sctx.beginPath();
            for(let j = 0; j < 10; j++) {
                const a = j * Math.PI / 5;
                const rr = j % 2 === 0 ? 22 : 10;
                sctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            sctx.closePath();
            sctx.fillStyle = c.out;
            sctx.fill();
            
            sctx.shadowBlur = 0;
            sctx.beginPath();
            for(let j = 0; j < 10; j++) {
                const a = j * Math.PI / 5 + Math.PI / 5;
                const rr = j % 2 === 0 ? 10 : 4;
                sctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            sctx.closePath();
            sctx.fillStyle = c.in;
            sctx.fill();
        }
        canvas.__lisaFrankSprites.push(sc);
    }
}
const sprites = canvas.__lisaFrankSprites;

// Clear screen with cosmic smear
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(5, 2, 10, 0.4)';
ctx.fillRect(0, 0, W, H);

const mx = (mouse && mouse.x) ? mouse.x : W / 2;
const my = (mouse && mouse.y) ? mouse.y : H / 2;

// The Parasites (Injecting localized Phason strain into the quasicrystal)
const parasites = [
    { x: mx, y: my, radius: (mouse && mouse.isPressed) ? 550 : 350 },
    { x: W/2 + Math.cos(time * 0.4) * W * 0.35, y: H/2 + Math.sin(time * 0.5) * H * 0.35, radius: 400 },
    { x: W/2 + Math.sin(time * 0.3) * W * 0.4, y: H/2 + Math.cos(time * 0.6) * H * 0.4, radius: 300 }
];

// Draw Parasite Auras
ctx.globalCompositeOperation = 'lighter';
for (let p of parasites) {
    const r = Math.max(0, p.radius);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, 'rgba(255, 0, 255, 0.15)');
    grad.addColorStop(0.3, 'rgba(0, 255, 255, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
}

// 5-Fold Penrose Pentagrid Mathematical Generation
const S = 60 + Math.sin(time * 0.5) * 10; // Breathing scale
const globalRot = time * 0.05;
const dirs = [];
const phases = [];

for (let i = 0; i < 5; i++) {
    const theta = i * Math.PI / 5 + globalRot;
    dirs.push({ c: Math.cos(theta), s: Math.sin(theta) });
    // Feral phason drift: this causes the continuous topological flipping
    phases.push(time * 0.4 * Math.cos(i * 1.618) + Math.sin(time * 0.15 + i) * 2.0);
}

// Calculate grid bounding box strictly for on-screen performance
const corners = [
    { x: -W/2/S, y: -H/2/S },
    { x: W/2/S, y: -H/2/S },
    { x: W/2/S, y: H/2/S },
    { x: -W/2/S, y: H/2/S }
];

const mBounds = [];
for (let i = 0; i < 5; i++) {
    const di = dirs[i];
    let minP = Infinity, maxP = -Infinity;
    for (let c of corners) {
        const p = c.x * di.c + c.y * di.s;
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
    }
    mBounds.push({
        min: Math.floor(minP - phases[i]) - 3,
        max: Math.ceil(maxP - phases[i]) + 3
    });
}

const gridLines = [];
for (let i = 0; i < 5; i++) {
    gridLines[i] = {};
    for (let mi = mBounds[i].min; mi <= mBounds[i].max; mi++) {
        gridLines[i][mi] = [];
    }
}

let pairIdx = 0;
const allPoints = [];

// Intersect all 10 pairs of grids to find the Delone set of quasicrystal vertices
for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 5; j++) {
        const di = dirs[i];
        const dj = dirs[j];
        const D = di.c * dj.s - di.s * dj.c;
        
        for (let mi = mBounds[i].min; mi <= mBounds[i].max; mi++) {
            for (let mj = mBounds[j].min; mj <= mBounds[j].max; mj++) {
                const ci = mi + phases[i];
                const cj = mj + phases[j];
                
                const x = (ci * dj.s - cj * di.s) / D;
                const y = (di.c * cj - dj.c * ci) / D;
                
                const unwarped_px = W / 2 + x * S;
                const unwarped_py = H / 2 + y * S;
                
                // Calculate local infection by parasites
                let maxInfection = 0;
                for (let p of parasites) {
                    const d = Math.hypot(unwarped_px - p.x, unwarped_py - p.y);
                    const inf = Math.pow(Math.max(0, 1 - d / p.radius), 2);
                    if (inf > maxInfection) maxInfection = inf;
                }
                
                // Parasitic Phason Warp: melts the grid geometry based on infection
                const push = Math.sin(unwarped_px * 0.02 - time * 2) * maxInfection * 80;
                const angle = Math.atan2(unwarped_py - H/2, unwarped_px - W/2) + maxInfection * Math.PI * 0.8;
                const px = unwarped_px + Math.cos(angle) * push;
                const py = unwarped_py + Math.sin(angle) * push;
                
                const pt = {
                    x: px, y: py,
                    t: [],
                    infection: maxInfection,
                    pairIdx: pairIdx
                };
                
                // Calculate position along each grid line for sorting
                for(let g = 0; g < 5; g++) {
                    pt.t[g] = x * (-dirs[g].s) + y * dirs[g].c;
                }
                
                gridLines[i][mi].push(pt);
                gridLines[j][mj].push(pt);
                allPoints.push(pt);
            }
        }
        pairIdx++;
    }
}

const neonColors = ['#FF00FF', '#00FFFF', '#FFFF00', '#00FF00', '#8A2BE2'];

// Pass 1: Draw Sterile Mathematical Grid
ctx.globalCompositeOperation = 'source-over';
ctx.strokeStyle = 'rgba(120, 160, 190, 0.15)';
ctx.lineWidth = 1;
for (let i = 0; i < 5; i++) {
    for (let mi = mBounds[i].min; mi <= mBounds[i].max; mi++) {
        const pts = gridLines[i][mi];
        if (pts.length < 2) continue;
        
        // Sort vertices along the line to draw continuous paths
        pts.sort((a, b) => a.t[i] - b.t[i]);
        
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) {
            ctx.lineTo(pts[k].x, pts[k].y);
        }
        ctx.stroke();
    }
}

// Pass 2: Draw Infected Lisa Frank Neon Grid
ctx.globalCompositeOperation = 'lighter';
for (let i = 0; i < 5; i++) {
    for (let mi = mBounds[i].min; mi <= mBounds[i].max; mi++) {
        const pts = gridLines[i][mi];
        if (pts.length < 2) continue;
        
        for (let k = 1; k < pts.length; k++) {
            const p1 = pts[k-1];
            const p2 = pts[k];
            const inf = (p1.infection + p2.infection) * 0.5;
            
            if (inf > 0.05) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                
                // Neon glow layer
                ctx.strokeStyle = neonColors[i];
                ctx.lineWidth = 2 + inf * 8;
                ctx.globalAlpha = inf * 0.8;
                ctx.stroke();
                
                // Hot core layer
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1 + inf * 2;
                ctx.globalAlpha = inf;
                ctx.stroke();
            }
        }
    }
}

// Pass 3: Draw Quasicrystal Nodes (Sterile vs Infected)
for (let p of allPoints) {
    if (p.infection > 0.1) {
        ctx.globalCompositeOperation = 'lighter';
        const sprite = sprites[p.pairIdx % sprites.length];
        const size = 15 + p.infection * 45; 
        ctx.globalAlpha = p.infection;
        ctx.drawImage(sprite, p.x - size/2, p.y - size/2, size, size);
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#A0C0D0';
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
}

// Reset context
ctx.globalAlpha = 1.0;
ctx.globalCompositeOperation = 'source-over';