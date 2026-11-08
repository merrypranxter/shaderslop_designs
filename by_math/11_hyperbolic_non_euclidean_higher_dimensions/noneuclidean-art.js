const OFFSCREEN_SIZE = 500;

if (!canvas.__initialized) {
    // Math structures for 5-fold Penrose/Lisa Frank Quasicrystal
    canvas.__Kx = new Float32Array(5);
    canvas.__Ky = new Float32Array(5);
    for (let i = 0; i < 5; i++) {
        canvas.__Kx[i] = Math.cos(i * Math.PI / 5);
        canvas.__Ky[i] = Math.sin(i * Math.PI / 5);
    }

    // Hyper-saturated Lisa Frank palette
    const lf_colors = [
        [255, 0, 150],   // Hot Pink
        [0, 200, 255],   // Cyan
        [255, 255, 0],   // Yellow
        [50, 255, 50],   // Lime
        [150, 0, 255],   // Purple
        [255, 100, 0],   // Neon Orange
        [255, 0, 150]    // Loop back to Pink
    ];
    
    canvas.__palette = new Uint8Array(1024 * 3);
    for (let i = 0; i < 1024; i++) {
        let t = (i / 1024) * (lf_colors.length - 1);
        let idx = Math.floor(t);
        let fract = t - idx;
        let c1 = lf_colors[idx];
        let c2 = lf_colors[Math.min(idx + 1, lf_colors.length - 1)];
        canvas.__palette[i * 3] = c1[0] + fract * (c2[0] - c1[0]);
        canvas.__palette[i * 3 + 1] = c1[1] + fract * (c2[1] - c1[1]);
        canvas.__palette[i * 3 + 2] = c1[2] + fract * (c2[2] - c1[2]);
    }

    // Offscreen pixel shader buffer
    canvas.__offscreen = document.createElement('canvas');
    canvas.__offscreen.width = OFFSCREEN_SIZE;
    canvas.__offscreen.height = OFFSCREEN_SIZE;
    canvas.__offCtx = canvas.__offscreen.getContext('2d');
    canvas.__imgData = canvas.__offCtx.createImageData(OFFSCREEN_SIZE, OFFSCREEN_SIZE);

    // Particle system residing in the infinite hyperbolic plane
    canvas.__particles = [];
    for (let i = 0; i < 1000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 20;
        canvas.__particles.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r,
            life: Math.random(),
            lastX: undefined,
            lastY: undefined
        });
    }

    // Particle trail buffer
    canvas.__trailCanvas = document.createElement('canvas');
    canvas.__trailCtx = canvas.__trailCanvas.getContext('2d');

    // Twinkling Lisa Frank stars for the void
    canvas.__stars = [];
    for(let i = 0; i < 150; i++) {
        canvas.__stars.push({
            x: Math.random(),
            y: Math.random(),
            phase: Math.random() * Math.PI * 2,
            speed: 1 + Math.random() * 3
        });
    }

    canvas.__ax = 0;
    canvas.__ay = 0;
    canvas.__initialized = true;
}

// Handle resizing
if (canvas.__gridWidth !== grid.width || canvas.__gridHeight !== grid.height) {
    canvas.__trailCanvas.width = grid.width;
    canvas.__trailCanvas.height = grid.height;
    canvas.__gridWidth = grid.width;
    canvas.__gridHeight = grid.height;
}

const Kx = canvas.__Kx;
const Ky = canvas.__Ky;
const palette = canvas.__palette;
const imgData = canvas.__imgData;
const data = imgData.data;

const size = Math.min(grid.width, grid.height);
const offsetX = (grid.width - size) / 2;
const offsetY = (grid.height - size) / 2;

// Celestial rotation of the quasicrystal dimension
const rot = time * 0.1;
const cosR = Math.cos(rot);
const sinR = Math.sin(rot);

// Interactive Möbius focus (pan through hyperbolic space)
let target_ax = 0.6 * Math.cos(time * 0.3);
let target_ay = 0.6 * Math.sin(time * 0.41);

if (mouse.isPressed) {
    const mx0 = (mouse.x - offsetX) / size * 2 - 1;
    const my0 = (mouse.y - offsetY) / size * 2 - 1;
    const mx = mx0 * cosR - my0 * sinR;
    const my = mx0 * sinR + my0 * cosR;
    const m_mag = Math.sqrt(mx * mx + my * my);
    if (m_mag < 0.9) {
        target_ax = mx;
        target_ay = my;
    } else {
        target_ax = (mx / m_mag) * 0.9;
        target_ay = (my / m_mag) * 0.9;
    }
}

canvas.__ax += (target_ax - canvas.__ax) * 0.05;
canvas.__ay += (target_ay - canvas.__ay) * 0.05;
const a_x = canvas.__ax;
const a_y = canvas.__ay;
const scale = 15.0;
const pulse = Math.sin(time * Math.PI * 0.5) * 0.05;

// --- 1. PIXEL SHADER: Hyperbolic Quasicrystal Evaluation ---
let idx = 0;
for (let y = 0; y < OFFSCREEN_SIZE; y++) {
    const ny0 = (y + 0.5) / OFFSCREEN_SIZE * 2 - 1;
    for (let x = 0; x < OFFSCREEN_SIZE; x++) {
        const nx0 = (x + 0.5) / OFFSCREEN_SIZE * 2 - 1;
        
        const z_sq = nx0 * nx0 + ny0 * ny0;
        if (z_sq >= 0.98) {
            if (z_sq < 1.0) {
                // Cyan ring bounding the Poincaré disk
                data[idx++] = 0; data[idx++] = 255; data[idx++] = 255; data[idx++] = 255;
            } else {
                data[idx++] = 0; data[idx++] = 0; data[idx++] = 0; data[idx++] = 0;
            }
            continue;
        }

        // Rotate frame
        const nx = nx0 * cosR - ny0 * sinR;
        const ny = nx0 * sinR + ny0 * cosR;

        // Möbius transformation
        const Dr = 1 - a_x * nx - a_y * ny;
        const Di = a_y * nx - a_x * ny;
        const Dmag = Dr * Dr + Di * Di;
        
        const wr = ((nx - a_x) * Dr + (ny - a_y) * Di) / Dmag;
        const wi = ((ny - a_y) * Dr - (nx - a_x) * Di) / Dmag;
        
        const w_sq = wr * wr + wi * wi;
        const w_mag = Math.min(Math.sqrt(w_sq), 0.9999);
        
        // Hyperbolic projection
        const d = 0.5 * Math.log((1 + w_mag) / (1 - w_mag));
        const mult = (w_mag === 0) ? 0 : (d * scale / w_mag);
        const Wx = wr * mult;
        const Wy = wi * mult;
        
        // 5-fold Quasicrystal Density
        let V = 0;
        let V_spot = 0;
        for (let i = 0; i < 5; i++) {
            const dot = Kx[i] * Wx + Ky[i] * Wy;
            V += Math.cos(dot - time * 2.0);
            V_spot += Math.cos(dot * 4.0 + time); // Parallax leopard spots
        }
        
        const V_norm = (V + 5) * 0.1;
        const V_spot_norm = (V_spot + 5) * 0.1;
        
        // Crystalline Faceting
        const steps = 8;
        const V_scaled = V_norm * steps;
        const V_facet = Math.floor(V_scaled) / steps;
        const edge = V_scaled - Math.floor(V_scaled);
        const shade = 0.4 + 0.6 * edge; // Bevel effect
        
        // Lisa Frank Leopard Spots
        const is_spot_edge = V_spot_norm > 0.75 && V_spot_norm < 0.82;
        const is_spot_center = V_spot_norm >= 0.82;
        
        let r, g, b;
        if (edge < 0.05 || edge > 0.95) {
            r = 255; g = 255; b = 255; // Facet highlights
        } else if (is_spot_edge) {
            r = 0; g = 0; b = 0; // Leopard outline
        } else if (is_spot_center) {
            // Neon core of the spot
            const p_idx = Math.floor((V_facet + w_mag * 0.5 - time * 0.1 + 0.5) * 1024);
            const p_base = (((p_idx % 1024) + 1024) % 1024) * 3;
            r = Math.min(255, palette[p_base] * shade * 1.2);
            g = Math.min(255, palette[p_base + 1] * shade * 1.2);
            b = Math.min(255, palette[p_base + 2] * shade * 1.2);
        } else {
            // Base rainbow crystal
            const p_idx = Math.floor((V_facet + w_mag * 0.5 - time * 0.1 + pulse) * 1024);
            const p_base = (((p_idx % 1024) + 1024) % 1024) * 3;
            r = palette[p_base] * shade;
            g = palette[p_base + 1] * shade;
            b = palette[p_base + 2] * shade;
        }
        
        data[idx++] = r;
        data[idx++] = g;
        data[idx++] = b;
        data[idx++] = 255;
    }
}
canvas.__offCtx.putImageData(imgData, 0, 0);

// --- 2. DRAW STAR VOID & HYPERBOLIC DISK ---
ctx.fillStyle = '#050015';
ctx.fillRect(0, 0, grid.width, grid.height);

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx, y = cy;
    let step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

for (let s of canvas.__stars) {
    ctx.fillStyle = `hsl(${s.phase * 180 / Math.PI}, 100%, 80%)`;
    ctx.globalAlpha = (Math.sin(time * s.speed + s.phase) + 1) / 2;
    drawStar(s.x * grid.width, s.y * grid.height, 5, 4, 1.5);
}
ctx.globalAlpha = 1.0;
ctx.drawImage(canvas.__offscreen, offsetX, offsetY, size, size);

// --- 3. PARTICLE SYSTEM: Flowing along Quasicrystal Valleys ---
const trailCtx = canvas.__trailCtx;
trailCtx.globalCompositeOperation = 'destination-out';
trailCtx.fillStyle = `rgba(0, 0, 0, 0.15)`;
trailCtx.fillRect(0, 0, grid.width, grid.height);
trailCtx.globalCompositeOperation = 'source-over';

const colorBuckets = 12;
const buckets = Array.from({length: colorBuckets}, () => []);

const uncosR = Math.cos(-rot);
const unsinR = Math.sin(-rot);

for (let p of canvas.__particles) {
    // Calculate gradient of the quasicrystal field
    let gradX = 0;
    let gradY = 0;
    for (let i = 0; i < 5; i++) {
        const dot = Kx[i] * p.x + Ky[i] * p.y;
        const sin_val = Math.sin(dot - time * 2.0);
        gradX -= Kx[i] * sin_val;
        gradY -= Ky[i] * sin_val;
    }
    
    // Cross product flow: orbit the crystal facets
    p.x += -gradY * 0.15 + (Math.random() - 0.5) * 0.05;
    p.y += gradX * 0.15 + (Math.random() - 0.5) * 0.05;
    
    const W_mag = Math.sqrt(p.x * p.x + p.y * p.y);
    let z_x = 0, z_y = 0;
    let draw = false;
    
    if (W_mag > 0.001) {
        const d = W_mag / scale;
        const w_mag = Math.tanh(d);
        const w_r = (p.x / W_mag) * w_mag;
        const w_i = (p.y / W_mag) * w_mag;
        
        // Inverse Möbius
        const Nr = w_r + a_x;
        const Ni = w_i + a_y;
        const Dr = 1 + a_x * w_r + a_y * w_i;
        const Di = a_x * w_i - a_y * w_r;
        const Dmag = Dr * Dr + Di * Di;
        
        const z_r = (Nr * Dr + Ni * Di) / Dmag;
        const z_i = (Ni * Dr - Nr * Di) / Dmag;
        
        // Un-rotate to match screen
        const z_r_unrot = z_r * uncosR - z_i * unsinR;
        const z_i_unrot = z_r * unsinR + z_i * uncosR;
        
        z_x = offsetX + (z_r_unrot + 1) / 2 * size;
        z_y = offsetY + (z_i_unrot + 1) / 2 * size;
        draw = true;
    }
    
    if (draw && p.lastX !== undefined) {
        const hue = Math.floor((p.life * 360 + time * 100) % 360);
        const bucketIdx = Math.min(Math.floor((hue / 360) * colorBuckets), colorBuckets - 1);
        buckets[bucketIdx].push({x1: p.lastX, y1: p.lastY, x2: z_x, y2: z_y});
    }
    
    p.lastX = z_x;
    p.lastY = z_y;
    p.life -= 0.01;
    
    if (p.life <= 0 || W_mag > 25) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 20;
        p.x = Math.cos(angle) * r;
        p.y = Math.sin(angle) * r;
        p.life = 1.0;
        p.lastX = undefined;
        p.lastY = undefined;
    }
}

// Render batched particle glowing trails
for (let i = 0; i < colorBuckets; i++) {
    if (buckets[i].length === 0) continue;
    const hue = (i + 0.5) * (360 / colorBuckets);
    trailCtx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
    
    trailCtx.lineWidth = 4;
    trailCtx.globalAlpha = 0.3;
    trailCtx.beginPath();
    for (let line of buckets[i]) {
        trailCtx.moveTo(line.x1, line.y1);
        trailCtx.lineTo(line.x2, line.y2);
    }
    trailCtx.stroke();
    
    trailCtx.lineWidth = 1.5;
    trailCtx.globalAlpha = 1.0;
    trailCtx.beginPath();
    for (let line of buckets[i]) {
        trailCtx.moveTo(line.x1, line.y1);
        trailCtx.lineTo(line.x2, line.y2);
    }
    trailCtx.stroke();
}

// Composite trails over the hyperbolic quasicrystal
ctx.drawImage(canvas.__trailCanvas, 0, 0, grid.width, grid.height);