const W = Math.min(300, Math.floor(grid.width / 2));
const H = Math.min(300, Math.floor(grid.height / 2));

// Initialize the feral quasicrystalline slime reactor
if (!canvas.__feral_rd) {
    const u = new Float32Array(W * H).fill(1.0);
    const v = new Float32Array(W * H).fill(0.0);
    const q_norm = new Float32Array(W * H);
    
    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx.createImageData(W, H);
    
    // Set alpha channel once for performance
    for(let i = 3; i < W * H * 4; i += 4) {
        imgData.data[i] = 255;
    }
    
    const aspect = grid.width / grid.height;
    
    // Seed initial state based on an 8-fold Ammann-Beenker quasicrystal lattice
    for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
            let qx = (x / W - 0.5) * aspect * 30.0;
            let qy = (y / H - 0.5) * 30.0;
            let q_sum = 0;
            for(let a = 0; a < 4; a++){
                let theta = a * Math.PI / 4;
                q_sum += Math.cos(qx * Math.cos(theta) + qy * Math.sin(theta));
            }
            let q = (q_sum / 4.0) * 0.5 + 0.5;
            // Inject organic matter along the mathematical ridges
            if (q > 0.85 || Math.random() < 0.02) {
                u[y*W+x] = 0.5 + Math.random() * 0.1;
                v[y*W+x] = 0.25 + Math.random() * 0.1;
            }
        }
    }
    
    canvas.__feral_rd = {
        u, v,
        next_u: new Float32Array(W * H),
        next_v: new Float32Array(W * H),
        q_norm,
        offscreen, offCtx, imgData
    };
}

const state = canvas.__feral_rd;
let { u, v, next_u, next_v, q_norm, offscreen, offCtx, imgData } = state;
const aspect = grid.width / grid.height;

// 1. Quasicrystal Stress Field Update (Domain Warped)
const time_slow = time * 0.5;
for (let y = 1; y < H - 1; y++) {
    let row = y * W;
    for (let x = 1; x < W - 1; x++) {
        let dx_m = (x / W) * grid.width - mouse.x;
        let dy_m = (y / H) * grid.height - mouse.y;
        let dist_m = Math.sqrt(dx_m*dx_m + dy_m*dy_m);
        
        let mouse_warp = 0;
        if (dist_m < 150) {
            mouse_warp = Math.cos(dist_m * 0.1 - time * 10.0) * (150 - dist_m) * 0.02;
        }
        
        // Fungal domain warping of the pristine math
        let warpX = Math.sin(y * 0.03 + time) * 1.5 + mouse_warp;
        let warpY = Math.cos(x * 0.03 - time) * 1.5 + mouse_warp;
        
        let qx = ((x + warpX) / W - 0.5) * aspect * 30.0;
        let qy = ((y + warpY) / H - 0.5) * 30.0;
        
        let q_sum = 0;
        for(let a = 0; a < 4; a++){
            let theta = a * Math.PI / 4;
            q_sum += Math.cos(qx * Math.cos(theta) + qy * Math.sin(theta) + time_slow);
        }
        let q = (q_sum / 4.0) * 0.5 + 0.5;
        q_norm[row + x] = Math.max(0, Math.min(1, q));
    }
}

// 2. Interaction & Mutation
if (mouse.isPressed) {
    let mx = Math.floor((mouse.x / grid.width) * W);
    let my = Math.floor((mouse.y / grid.height) * H);
    for(let dy = -6; dy <= 6; dy++){
        for(let dx = -6; dx <= 6; dx++){
            let px = mx + dx, py = my + dy;
            if(px > 0 && px < W-1 && py > 0 && py < H-1 && (dx*dx + dy*dy < 36)){
                v[py*W+px] = 0.8;
                u[py*W+px] = 0.2;
            }
        }
    }
}

// Feral parasitic injections
if (Math.random() < 0.1) {
    let rx = Math.floor(Math.random() * (W - 20)) + 10;
    let ry = Math.floor(Math.random() * (H - 20)) + 10;
    for(let dy = -2; dy <= 2; dy++) {
        for(let dx = -2; dx <= 2; dx++) {
            if (dx*dx + dy*dy <= 4) {
                v[(ry+dy)*W + (rx+dx)] = 0.9;
                u[(ry+dy)*W + (rx+dx)] = 0.1;
            }
        }
    }
}

// 3. Gray-Scott Cellular Automata (Karl Sims 9-point isotropic kernel)
const steps = 8;
const Du = 1.0;
const Dv = 0.5;
const dt = 1.0;

for (let step = 0; step < steps; step++) {
    for (let y = 1; y < H - 1; y++) {
        let row = y * W;
        let rowUp = (y - 1) * W;
        let rowDown = (y + 1) * W;
        
        for (let x = 1; x < W - 1; x++) {
            let i = row + x;
            
            // Map quasicrystal field to Pearson parameter space
            // Sweeps from Wavelet Chaos -> Turing Spots -> U-Skate World
            let q = q_norm[i];
            let F = 0.020 + q * 0.040; 
            let K = 0.050 + q * 0.012; 
            
            let u_c = u[i], v_c = v[i];
            
            let lapU = 0.05 * (u[rowUp + x - 1] + u[rowUp + x + 1] + u[rowDown + x - 1] + u[rowDown + x + 1]) +
                       0.20 * (u[rowUp + x] + u[rowDown + x] + u[row + x - 1] + u[row + x + 1]) -
                       1.00 * u_c;
                       
            let lapV = 0.05 * (v[rowUp + x - 1] + v[rowUp + x + 1] + v[rowDown + x - 1] + v[rowDown + x + 1]) +
                       0.20 * (v[rowUp + x] + v[rowDown + x] + v[row + x - 1] + v[row + x + 1]) -
                       1.00 * v_c;
                       
            let uvv = u_c * v_c * v_c;
            
            next_u[i] = Math.max(0, Math.min(1, u_c + dt * (Du * lapU - uvv + F * (1.0 - u_c))));
            next_v[i] = Math.max(0, Math.min(1, v_c + dt * (Dv * lapV + uvv - (F + K) * v_c)));
        }
    }
    // Swap pointers to avoid array copies
    let t_u = u, t_v = v;
    u = next_u; v = next_v;
    next_u = t_u; next_v = t_v;
}

// Persist state
state.u = u;
state.v = v;
state.next_u = next_u;
state.next_v = next_v;

// 4. Structural Color & Iridescence Rendering
const data = imgData.data;
for (let y = 1; y < H - 1; y++) {
    let row = y * W;
    for (let x = 1; x < W - 1; x++) {
        let i = row + x;
        let valV = v[i];
        
        // Calculate pseudo-normals from the chemical concentration
        let nx = v[i+1] - v[i-1];
        let ny = v[i+W] - v[i-W];
        let nz = 0.05;
        let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        nx /= len; ny /= len; nz /= len;
        
        let lx = 0.5, ly = 0.5, lz = 0.707;
        let diffuse = Math.max(0, nx*lx + ny*ly + nz*lz);
        let specular = Math.pow(diffuse, 8.0);
        
        let q = q_norm[i];
        
        // Michel-Lévy interference chart mapping (birefringence optics)
        let thickness = valV * 2.5;
        let retardation = thickness * 2.0 + q * 1.5 + time * 0.3;
        
        // Toxic/overclocked phase-shifted color bands
        let r_c = Math.sin(retardation * 3.0 + 0.0) * 0.5 + 0.5;
        let g_c = Math.sin(retardation * 4.0 + 1.0) * 0.5 + 0.5;
        let b_c = Math.sin(retardation * 5.0 + 2.0) * 0.5 + 0.5;
        
        let light = 0.3 + 0.7 * diffuse;
        let r = Math.pow(r_c * light + specular, 1.2) * 255;
        let g = Math.pow(g_c * light + specular, 1.2) * 255;
        let b = Math.pow(b_c * light + specular, 1.2) * 255;
        
        // Smoothstep transition into the void
        let mask = valV * 4.0;
        let pattern_mask = Math.max(0, Math.min(1, mask * mask * (3.0 - 2.0 * mask)));
        
        // Crystalline dark background
        let bg_q = Math.abs(Math.sin(q * 20.0 - time * 2.0));
        let bgR = 5 + bg_q * 10;
        let bgG = 10 + bg_q * 20;
        let bgB = 25 + bg_q * 40;
        
        // Add organic depth shadows
        let shadow = Math.max(0, -nx*0.5 - ny*0.5);
        r -= shadow * 60;
        g -= shadow * 60;
        b -= shadow * 60;
        
        let idx = i * 4;
        data[idx]   = r * pattern_mask + bgR * (1 - pattern_mask);
        data[idx+1] = g * pattern_mask + bgG * (1 - pattern_mask);
        data[idx+2] = b * pattern_mask + bgB * (1 - pattern_mask);
    }
}

// 5. Draw and Post-Process
offCtx.putImageData(imgData, 0, 0);

ctx.save();
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
ctx.drawImage(offscreen, 0, 0, grid.width, grid.height);

// VHS scanlines
ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
for(let i = 0; i < grid.height; i += 4) {
    ctx.fillRect(0, i, grid.width, 1);
}

// Heavy optical vignette
let grad = ctx.createRadialGradient(grid.width/2, grid.height/2, grid.height/3, grid.width/2, grid.height/2, grid.height);
grad.addColorStop(0, "rgba(0,0,0,0)");
grad.addColorStop(1, "rgba(5,0,15,0.85)");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, grid.width, grid.height);
ctx.restore();