const PI = Math.PI;
const cx = grid.width / 2;
const cy = grid.height / 2;

// --- INITIALIZATION ---
if (!canvas.crystals) {
    function createCubic() {
        let v = [];
        for(let i=0; i<8; i++) v.push({x:(i&1?1:-1), y:(i&2?1:-1), z:(i&4?1:-1)});
        return v;
    }
    function createHexagonal() {
        let v = [];
        for(let i=0; i<6; i++) {
            let a = i * PI / 3;
            v.push({x:Math.cos(a), y:1, z:Math.sin(a)});
            v.push({x:Math.cos(a), y:-1, z:Math.sin(a)});
        }
        return v;
    }
    function createTetragonal() {
        let v = [];
        for(let i=0; i<8; i++) v.push({x:(i&1?1:-1)*0.6, y:(i&2?1:-1)*1.8, z:(i&4?1:-1)*0.6});
        return v;
    }

    canvas.crystals = [];
    const NUM_CRYSTALS = 45;
    
    for(let i=0; i<NUM_CRYSTALS; i++) {
        let typeR = Math.random();
        let type = typeR < 0.33 ? 'cubic' : (typeR < 0.66 ? 'hexagonal' : 'tetragonal');
        let vertices = type === 'cubic' ? createCubic() : (type === 'hexagonal' ? createHexagonal() : createTetragonal());
        
        let edges = [];
        for(let j=0; j<vertices.length; j++) {
            for(let k=j+1; k<vertices.length; k++) {
                let dx = vertices[j].x - vertices[k].x;
                let dy = vertices[j].y - vertices[k].y;
                let dz = vertices[j].z - vertices[k].z;
                let d = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if ((type==='cubic' && d<2.1) || (type==='hexagonal' && d<2.1) || (type==='tetragonal' && d<2.5)) {
                    edges.push([j, k]);
                }
            }
        }
        
        canvas.crystals.push({
            type, vertices, edges,
            baseRadius: 2.5 + Math.random() * 5,
            baseY: (Math.random() - 0.5) * 10,
            angle: Math.random() * PI * 2,
            orbitSpeed: (Math.random() - 0.5) * 0.02,
            rot: {x: Math.random()*PI, y: Math.random()*PI, z: Math.random()*PI},
            rotSpeed: {x: (Math.random()-0.5)*0.05, y: (Math.random()-0.5)*0.05, z: (Math.random()-0.5)*0.05},
            pos: {x:0, y:0, z:0},
            scale: 0.2 + Math.random() * 0.5
        });
    }

    // Psychedelic Collage Halftone/Riso Pattern
    let off = document.createElement('canvas');
    off.width = 64;
    off.height = 64;
    let octx = off.getContext('2d');
    
    octx.fillStyle = 'rgba(255, 0, 204, 0.12)';
    octx.beginPath(); octx.arc(16, 16, 12, 0, PI*2); octx.fill();
    octx.beginPath(); octx.arc(48, 48, 14, 0, PI*2); octx.fill();
    
    octx.fillStyle = 'rgba(0, 255, 240, 0.12)';
    octx.beginPath(); octx.arc(48, 16, 10, 0, PI*2); octx.fill();
    octx.beginPath(); octx.arc(16, 48, 16, 0, PI*2); octx.fill();
    
    octx.fillStyle = 'rgba(176, 255, 0, 0.15)';
    for(let x=0; x<64; x+=8) {
        for(let y=0; y<64; y+=8) {
            octx.beginPath(); octx.arc(x, y, 1.5, 0, PI*2); octx.fill();
        }
    }
    canvas.halftonePattern = ctx.createPattern(off, 'repeat');
}

// --- MATH & PHYSICS ---
function project(p) {
    let z = Math.max(0.1, p.z);
    let f = 600 / z; // AdS depth warp
    return { x: cx + p.x * f, y: cy + p.y * f, z: z, f: f };
}

function rotate3D(p, rot) {
    let sx = Math.sin(rot.x), cx_ = Math.cos(rot.x);
    let sy = Math.sin(rot.y), cy_ = Math.cos(rot.y);
    let sz = Math.sin(rot.z), cz = Math.cos(rot.z);
    
    let x1 = p.x * cy_ - p.z * sy;
    let z1 = p.x * sy + p.z * cy_;
    let y1 = p.y;
    
    let y2 = y1 * cx_ - z1 * sx;
    let z2 = y1 * sx + z1 * cx_;
    let x2 = x1;
    
    let x3 = x2 * cz - y2 * sz;
    let y3 = x2 * sz + y2 * cz;
    
    return {x: x3, y: y3, z: z2};
}

// --- RENDERING PIPELINE ---
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = '#040608'; // Void Black
ctx.fillRect(0, 0, grid.width, grid.height);

// Ambient Acid Vibration Background
ctx.save();
ctx.translate(cx, cy);
ctx.rotate(time * 0.05);
ctx.strokeStyle = 'rgba(255, 0, 204, 0.03)';
ctx.lineWidth = 40;
ctx.beginPath();
for(let i=0; i<6; i++) {
    let a = i * PI / 3;
    let r = Math.min(grid.width, grid.height) * 0.45;
    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
}
ctx.closePath();
ctx.stroke();
ctx.restore();

// Holographic Light Sheet Scanner
let scanY = -10 + (time * 3) % 20;

let projectedCrystals = [];
canvas.crystals.forEach(c => {
    c.angle += c.orbitSpeed;
    
    let targetX = Math.cos(c.angle) * c.baseRadius;
    let targetY = c.baseY + Math.sin(time + c.angle) * 1.5;
    let targetZ = Math.sin(c.angle) * c.baseRadius + 7;
    
    // Boundary dictates bulk: Mouse entanglement pull
    if (mouse.isPressed) {
        let mx = (mouse.x - cx) * targetZ / 600;
        let my = (mouse.y - cy) * targetZ / 600;
        targetX = mx + (Math.random()-0.5)*2;
        targetY = my + (Math.random()-0.5)*2;
        targetZ -= 3;
    }
    
    c.pos.x += (targetX - c.pos.x) * 0.08;
    c.pos.y += (targetY - c.pos.y) * 0.08;
    c.pos.z += (targetZ - c.pos.z) * 0.08;
    
    c.rot.x += c.rotSpeed.x;
    c.rot.y += c.rotSpeed.y;
    c.rot.z += c.rotSpeed.z;
    
    let projVerts = [];
    c.vertices.forEach(v => {
        let rv = rotate3D({x: v.x * c.scale, y: v.y * c.scale, z: v.z * c.scale}, c.rot);
        projVerts.push(project({x: c.pos.x + rv.x, y: c.pos.y + rv.y, z: c.pos.z + rv.z}));
    });
    
    let isActive = Math.abs(c.pos.y - scanY) < 1.8;
    
    projectedCrystals.push({
        crystal: c,
        projVerts: projVerts,
        isActive: isActive,
        z: c.pos.z
    });
});

// Painter's algorithm sort
projectedCrystals.sort((a, b) => b.z - a.z);

// Black Hole / Holographic Horizon
let horizonProj = project({x: 0, y: 0, z: 7});
let hRadius = 3.0 * horizonProj.f;

ctx.globalCompositeOperation = 'source-over';
ctx.save();
ctx.beginPath();
ctx.arc(horizonProj.x, horizonProj.y, Math.max(0, hRadius), 0, PI*2);
ctx.clip();
ctx.translate(horizonProj.x, horizonProj.y);
ctx.rotate(time * 0.3);
let hGrad = ctx.createLinearGradient(-hRadius, -hRadius, hRadius, hRadius);
hGrad.addColorStop(0, '#FF00CC');
hGrad.addColorStop(0.5, '#00FFF0');
hGrad.addColorStop(1, '#B0FF00');
ctx.fillStyle = hGrad;
ctx.fillRect(-hRadius, -hRadius, hRadius*2, hRadius*2);
for(let r=hRadius; r>0; r-=15) {
    ctx.strokeStyle = '#040608';
    ctx.lineWidth = 3;
    ctx.setLineDash([Math.max(1, Math.random()*15), Math.max(1, Math.random()*10)]);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, r), 0, PI*2);
    ctx.stroke();
}
ctx.restore();

// CMYK Misregistration Passes for Cyberdelic Neon
const passes = [
    {rgb: '0, 255, 240', hex: '#00FFF0', offX: -3, offY: 0},
    {rgb: '255, 0, 204', hex: '#FF00CC', offX: 3, offY: -2},
    {rgb: '176, 255, 0', hex: '#B0FF00', offX: 0, offY: 3}
];

// Stretched Horizon Ring
ctx.globalCompositeOperation = 'screen';
ctx.setLineDash([]);
passes.forEach(p => {
    ctx.strokeStyle = p.hex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(horizonProj.x + p.offX, horizonProj.y + p.offY, Math.max(0, hRadius * 1.05 + Math.sin(time*3)*6), 0, PI*2);
    ctx.stroke();
});

// RT Minimal Surfaces (Entanglement Bridges)
for(let i=0; i<projectedCrystals.length; i++) {
    for(let j=i+1; j<projectedCrystals.length; j++) {
        let ci = projectedCrystals[i];
        let cj = projectedCrystals[j];
        let dx = ci.crystal.pos.x - cj.crystal.pos.x;
        let dy = ci.crystal.pos.y - cj.crystal.pos.y;
        let dz = ci.crystal.pos.z - cj.crystal.pos.z;
        let d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < 3.2) {
            let p1 = project(ci.crystal.pos);
            let p2 = project(cj.crystal.pos);
            ctx.strokeStyle = `rgba(0, 255, 240, ${1 - d/3.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }
}

// Draw Crystals
const fillColors = ['#FF00CC', '#00FFF0', '#B0FF00', '#FFE600'];

projectedCrystals.forEach(pc => {
    let cx2 = 0, cy2 = 0;
    pc.projVerts.forEach(v => { cx2+=v.x; cy2+=v.y; });
    cx2 /= pc.projVerts.length;
    let sorted = pc.projVerts.slice().sort((a,b) => Math.atan2(a.y - cy2, a.x - cx2) - Math.atan2(b.y - cy2, b.x - cx2));

    // Surreal Photomontage Cutout Fill (if active)
    if (pc.isActive) {
        ctx.globalCompositeOperation = 'source-over';
        
        // Collage Drop Shadow
        ctx.fillStyle = 'rgba(4, 6, 8, 0.85)';
        ctx.beginPath();
        if(sorted.length > 0) {
            ctx.moveTo(sorted[0].x + 8, sorted[0].y + 8);
            for(let i=1; i<sorted.length; i++) ctx.lineTo(sorted[i].x + 8, sorted[i].y + 8);
            ctx.closePath();
            ctx.fill();
        }
        
        // Acid Color Fill
        let color = fillColors[pc.crystal.vertices.length % fillColors.length];
        ctx.fillStyle = color;
        ctx.beginPath();
        if(sorted.length > 0) {
            ctx.moveTo(sorted[0].x, sorted[0].y);
            for(let i=1; i<sorted.length; i++) ctx.lineTo(sorted[i].x, sorted[i].y);
            ctx.closePath();
            ctx.fill();
        }

        // Precursor Ghost (Expanded Aura)
        ctx.globalCompositeOperation = 'screen';
        passes.forEach(p => {
            ctx.strokeStyle = `rgba(${p.rgb}, 0.25)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            pc.crystal.edges.forEach(edge => {
                let v1 = pc.projVerts[edge[0]];
                let v2 = pc.projVerts[edge[1]];
                let sx1 = cx2 + (v1.x - cx2)*1.4;
                let sy1 = cy2 + (v1.y - cy2)*1.4;
                let sx2 = cx2 + (v2.x - cx2)*1.4;
                let sy2 = cy2 + (v2.y - cy2)*1.4;
                ctx.moveTo(sx1 + p.offX, sy1 + p.offY);
                ctx.lineTo(sx2 + p.offX, sy2 + p.offY);
            });
            ctx.stroke();
        });
    }
    
    // CMYK Misregistration Wireframes
    ctx.globalCompositeOperation = 'screen';
    passes.forEach(p => {
        ctx.strokeStyle = p.hex;
        ctx.lineWidth = 1;
        ctx.beginPath();
        pc.crystal.edges.forEach(edge => {
            let v1 = pc.projVerts[edge[0]];
            let v2 = pc.projVerts[edge[1]];
            ctx.moveTo(v1.x + p.offX, v1.y + p.offY);
            ctx.lineTo(v2.x + p.offX, v2.y + p.offY);
        });
        ctx.stroke();
    });
});

// Light Sheet Scanner Plane
let yProj = project({x: 0, y: scanY, z: 7}).y;
ctx.globalCompositeOperation = 'screen';
ctx.fillStyle = 'rgba(176, 255, 0, 0.15)';
ctx.fillRect(0, yProj - 30, grid.width, 60);
ctx.fillStyle = '#B0FF00';
ctx.fillRect(0, yProj, grid.width, 2);

// Print Artifacts: Scratches & Dust
ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
ctx.lineWidth = 1;
for(let i=0; i<6; i++) {
    if(Math.random() > 0.4) {
        ctx.beginPath();
        let x = Math.random() * grid.width;
        let y = Math.random() * grid.height;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random()-0.5)*80, y + (Math.random()-0.5)*120);
        ctx.stroke();
    }
}

// Final Zine/Riso Overlay Pass
ctx.globalCompositeOperation = 'screen';
ctx.fillStyle = canvas.halftonePattern;
ctx.fillRect(0, 0, grid.width, grid.height);

// Vintage Duotone / Collage Vignette Burn
let grad = ctx.createRadialGradient(cx, cy, grid.height*0.4, cx, cy, grid.height*0.9);
grad.addColorStop(0, 'rgba(4, 6, 8, 0)');
grad.addColorStop(1, 'rgba(4, 6, 8, 0.85)');
ctx.globalCompositeOperation = 'multiply';
ctx.fillStyle = grad;
ctx.fillRect(0, 0, grid.width, grid.height);