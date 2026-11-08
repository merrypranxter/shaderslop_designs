// rainbow rainblown Apollonian Gasket full canvas design
// Incorporating: 
// - Apollonian Gasket fractal generation (Descartes' Circle Theorem)
// - Fluid "rainblown" domain warping via 3D value noise
// - Psychedelic Pop Style motifs (Eyes, Stars, Vibrant Cosine Palettes)
// - Print artifacts (CMYK chromatic aberration, scanlines)

function fract(x) { 
    return x - Math.floor(x); 
}

function hash3(x, y, z) {
    let p = x * 127.1 + y * 311.7 + z * 74.7;
    let res = Math.sin(p) * 43758.5453123;
    return res - Math.floor(res);
}

function noise3D(x, y, z) {
    let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = fract(x), fy = fract(y), fz = fract(z);
    
    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uy = fy * fy * (3.0 - 2.0 * fy);
    let uz = fz * fz * (3.0 - 2.0 * fz);
    
    let a = hash3(ix, iy, iz);
    let b = hash3(ix + 1, iy, iz);
    let c = hash3(ix, iy + 1, iz);
    let d = hash3(ix + 1, iy + 1, iz);
    let e = hash3(ix, iy, iz + 1);
    let f_ = hash3(ix + 1, iy, iz + 1);
    let g = hash3(ix, iy + 1, iz + 1);
    let h = hash3(ix + 1, iy + 1, iz + 1);
    
    return a * (1-ux)*(1-uy)*(1-uz) +
           b * ux*(1-uy)*(1-uz) +
           c * (1-ux)*uy*(1-uz) +
           d * ux*uy*(1-uz) +
           e * (1-ux)*(1-uy)*uz +
           f_ * ux*(1-uy)*uz +
           g * (1-ux)*uy*uz +
           h * ux*uy*uz;
}

// Fluid deformation field simulating wind and rain drips
function deform(x, y, t) {
    let wx = x;
    let wy = y;
    
    // Slow flowing waves
    let n1 = noise3D(x * 1.2, y * 1.2, t * 0.2);
    wx += Math.sin(n1 * Math.PI * 2) * 0.15;
    wy += Math.cos(n1 * Math.PI * 2) * 0.15;
    
    // Fast rainblown drips (streaking downwards)
    let n2 = noise3D(x * 3.0, y * 3.0 - t * 1.5, t * 0.4);
    let streak = Math.pow(n2, 2.5) * 0.3; 
    wx += streak * 0.3;  // slight diagonal drift
    wy += streak * 1.2;  // strong downward pull
    
    return [wx, wy];
}

// Vibrant cyberdelic neon cosine palette
function palette(t) {
    let r = 0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.0));
    let g = 0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.33));
    let b = 0.5 + 0.5 * Math.cos(6.28318 * (1.0 * t + 0.67));
    
    // Boost saturation
    r = Math.pow(r, 0.6);
    g = Math.pow(g, 0.6);
    b = Math.pow(b, 0.6);
    return [r, g, b];
}

// --- Main Execution ---

// Generate the Apollonian Gasket fractal once and cache it
if (!canvas.__circles) {
    let circles = [];
    
    // Initial mutually tangent quadruple
    let c1 = {k: -1, x: 0, y: 0, r: 1};
    let c2 = {k: 2, x: 0.5, y: 0, r: 0.5};
    let c3 = {k: 2, x: -0.5, y: 0, r: 0.5};
    let c4 = {k: 3, x: 0, y: 2/3, r: 1/3};
    
    circles.push(c1, c2, c3, c4);
    
    // Recursive Soddy circle generation using Descartes' Theorem
    function gen(targets, depth, replacedIndex) {
        if (depth === 0) return;
        
        for (let i = 0; i < 4; i++) {
            if (i === replacedIndex) continue;
            
            let target = targets[i];
            let others = targets.filter((_, idx) => idx !== i);
            let a = others[0], b = others[1], c = others[2];
            
            let k_new = 2 * (a.k + b.k + c.k) - target.k;
            if (k_new <= 0) continue;
            
            let x_new = (2 * (a.k * a.x + b.k * b.x + c.k * c.x) - target.k * target.x) / k_new;
            let y_new = (2 * (a.k * a.y + b.k * b.y + c.k * c.y) - target.k * target.y) / k_new;
            let r_new = 1 / k_new;
            
            // Culling extremely small circles to maintain performance
            if (r_new < 0.003) continue;
            
            let c_new = {k: k_new, x: x_new, y: y_new, r: r_new};
            circles.push(c_new);
            
            let newTargets = [...targets];
            newTargets[i] = c_new;
            gen(newTargets, depth - 1, i);
        }
    }
    
    gen([c1, c2, c3, c4], 6, -1);
    
    // Second branch for the symmetrically opposite inner circle
    let c5 = {k: 3, x: 0, y: -2/3, r: 1/3};
    circles.push(c5);
    gen([c1, c2, c3, c5], 6, 3);
    
    // Painter's algorithm: draw largest circles first
    circles.sort((a, b) => b.r - a.r);
    canvas.__circles = circles;
}

let circles = canvas.__circles;

// Clear canvas with dark void background
ctx.fillStyle = '#040608';
ctx.fillRect(0, 0, grid.width, grid.height);

let t = time * 0.4;
let scale = Math.max(grid.width, grid.height) * 0.8;
let cx = grid.width / 2;
let cy = grid.height / 2 - scale * 0.2; // Shift up to accommodate downward drips

ctx.lineJoin = 'round';

// Draw the warped fractal circles
circles.forEach((c) => {
    let steps = Math.max(16, Math.floor(c.r * scale * 0.6));
    if (steps > 100) steps = 100;
    
    let pts = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (let j = 0; j <= steps; j++) {
        let angle = (j / steps) * Math.PI * 2;
        let px = c.x + Math.cos(angle) * c.r;
        let py = c.y + Math.sin(angle) * c.r;
        
        let d = deform(px, py, t);
        let sx = cx + d[0] * scale;
        let sy = cy + d[1] * scale;
        
        pts.push({x: sx, y: sy});
        
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
    }
    
    let tBase = Math.log(c.k + 2) * 0.15 + (c.x + c.y) * 0.2 + t * 0.3;
    let color1 = palette(tBase);
    let color2 = palette(tBase + 0.2);
    
    // Iridescent gradient fill
    let grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
    grad.addColorStop(0, `rgb(${color1[0]*255},${color1[1]*255},${color1[2]*255})`);
    grad.addColorStop(1, `rgb(${color2[0]*255},${color2[1]*255},${color2[2]*255})`);
    
    ctx.fillStyle = grad;
    ctx.lineWidth = Math.max(1.5, c.r * scale * 0.015);
    ctx.strokeStyle = '#0B0B12'; 
    
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x, pts[j].y);
    }
    ctx.fill();
    ctx.stroke();
    
    // Inject Psychedelic Pop Motifs
    if (c.r > 0.04 && c.k > 0) {
        // Draw surreal eyes inside larger circles
        let centerPos = deform(c.x, c.y, t);
        let cx_screen = cx + centerPos[0] * scale;
        let cy_screen = cy + centerPos[1] * scale;
        
        let eyeScale = c.r * scale * 0.35;
        let rot = noise3D(c.x, c.y, t) * Math.PI;
        
        ctx.fillStyle = '#EEE5C8'; // Antique Ivory Sclera
        ctx.beginPath();
        ctx.ellipse(cx_screen, cy_screen, eyeScale, eyeScale * 0.5, rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        let irisColor = palette(tBase + 0.5);
        ctx.fillStyle = `rgb(${irisColor[0]*255},${irisColor[1]*255},${irisColor[2]*255})`;
        ctx.beginPath();
        ctx.arc(cx_screen, cy_screen, eyeScale * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#0B0B12'; // Pupil
        ctx.beginPath();
        ctx.arc(cx_screen, cy_screen, eyeScale * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff'; // Catchlight
        ctx.beginPath();
        ctx.arc(cx_screen + eyeScale * 0.1, cy_screen - eyeScale * 0.1, eyeScale * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
    } else if (c.r > 0.015 && c.k > 0) {
        // Draw retro four-pointed stars in medium circles
        let centerPos = deform(c.x, c.y, t);
        let cx_screen = cx + centerPos[0] * scale;
        let cy_screen = cy + centerPos[1] * scale;
        
        let sSize = c.r * scale * 0.3;
        ctx.fillStyle = '#FFE600'; // Lemon Zap
        ctx.beginPath();
        ctx.moveTo(cx_screen, cy_screen - sSize);
        ctx.quadraticCurveTo(cx_screen, cy_screen, cx_screen + sSize, cy_screen);
        ctx.quadraticCurveTo(cx_screen, cy_screen, cx_screen, cy_screen + sSize);
        ctx.quadraticCurveTo(cx_screen, cy_screen, cx_screen - sSize, cy_screen);
        ctx.quadraticCurveTo(cx_screen, cy_screen, cx_screen, cy_screen - sSize);
        ctx.fill();
        ctx.stroke();
    }
});

// Parallax foreground particles with CMYK chromatic aberration misregistration
let seed = 12345;
function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}

ctx.globalCompositeOperation = 'screen';

for (let i = 0; i < 60; i++) {
    let rx = (rand() * 2 - 1) * 1.5;
    let ry = (rand() * 2 - 1) * 1.5;
    let size = rand() * 3 + 1;
    
    let d = deform(rx, ry, t);
    let sx = cx + d[0] * scale;
    let sy = cy + d[1] * scale;
    
    // Cyan pass
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.arc(sx + 2.0, sy, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Magenta pass
    ctx.fillStyle = '#FF00FF';
    ctx.beginPath();
    ctx.arc(sx - 2.0, sy + 1.5, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Yellow pass
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(sx, sy - 2.0, size, 0, Math.PI * 2);
    ctx.fill();
}

ctx.globalCompositeOperation = 'source-over';

// Analog zine/Xerox scanline texture overlay
ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
for (let y = 0; y < grid.height; y += 4) {
    ctx.fillRect(0, y, grid.width, 2);
}