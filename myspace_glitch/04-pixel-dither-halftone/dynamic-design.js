const { width, height } = grid;

// Initialize the feral system on the canvas object to persist across frames
if (!canvas.__feralSystem) {
    const numParticles = 12000;
    // Flat array for data locality & performance: [x, y, vx, vy, life, maxLife, ... ]
    const particles = new Float32Array(numParticles * 6); 
    
    for (let i = 0; i < numParticles; i++) {
        let idx = i * 6;
        particles[idx]     = Math.random() * width;
        particles[idx + 1] = Math.random() * height;
        particles[idx + 2] = (Math.random() - 0.5) * 2.0;
        particles[idx + 3] = (Math.random() - 0.5) * 2.0;
        particles[idx + 4] = Math.random() * 100; // current life
        particles[idx + 5] = 50 + Math.random() * 150; // max life
    }

    // [REPO GENOME: pixel_voxel]
    // Generate an offline Bayer 4x4 dither pattern for the "Ditherpunk" overlay
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 8; 
    bCanvas.height = 8;
    const bCtx = bCanvas.getContext('2d');
    
    const bayer4x4 = [
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5
    ];
    
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            // Map bayer values to dramatic luminance shifts for 'overlay' blending
            let v = (bayer4x4[y * 4 + x] / 15.0) * 255;
            bCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.25)`;
            bCtx.fillRect(x * 2, y * 2, 2, 2);
        }
    }

    canvas.__feralSystem = {
        particles,
        numParticles,
        ditherPattern: ctx.createPattern(bCanvas, 'repeat')
    };
}

const sys = canvas.__feralSystem;
const p = sys.particles;

// 1. Viscous background fade (Reaction-Diffusion / fluid accumulation vibe)
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(6, 4, 10, 0.12)';
ctx.fillRect(0, 0, width, height);

// Additive blending for the glowing "healing seams" and structural color
ctx.globalCompositeOperation = 'lighter';

// [REPO GENOME: fractals] 
// Evolving Clifford Attractor parameters driving the base vector field
const a_cliff = 1.5 + Math.sin(time * 0.11) * 0.5;
const b_cliff = -1.2 + Math.cos(time * 0.13) * 0.5;
const c_cliff = 1.0 + Math.sin(time * 0.17) * 0.5;
const d_cliff = 0.9 + Math.cos(time * 0.19) * 0.5;

const mx = mouse.x;
const my = mouse.y;
const isDown = mouse.isPressed;

// [REPO GENOME: structural_color]
// Biological refractive index (Chitin, typical in Jewel Beetles)
const n_chitin = 1.56; 

for (let i = 0; i < sys.numParticles; i++) {
    let idx = i * 6;
    let x  = p[idx];
    let y  = p[idx + 1];
    let vx = p[idx + 2];
    let vy = p[idx + 3];
    let life = p[idx + 4];
    let maxLife = p[idx + 5];

    // Normalize coordinates to [-2, 2] for the strange attractor math
    let nx = (x / width - 0.5) * 4.0;
    let ny = (y / height - 0.5) * 4.0;

    // [REPO GENOME: noise]
    // Iterative Domain Warp (Psychedelic Warp recipe)
    let warpX = Math.sin(ny * 2.0 - time * 0.5) * 0.5;
    let warpY = Math.cos(nx * 2.0 + time * 0.5) * 0.5;

    // [REPO GENOME: g2]
    // Phi Field: The hidden structural orientation (Clifford Attractor + Domain Warp)
    let phiX = Math.sin(a_cliff * (ny + warpY)) + c_cliff * Math.cos(a_cliff * (nx + warpX));
    let phiY = Math.sin(b_cliff * (nx + warpX)) + d_cliff * Math.cos(b_cliff * (ny + warpY));

    // Dual Field: Shadow response / counterflow
    // Introduces rotational curl and high-frequency noise
    let dualX = -phiY + Math.sin(nx * 4.0 + time);
    let dualY = phiX + Math.cos(ny * 4.0 - time);

    // Torsion: Misalignment between Phi and Dual fields representing structural strain
    let torsion = Math.abs(phiX * dualX + phiY * dualY);

    // Mouse Interaction: Acts as a localized "Singularity"
    let dx = mx - x;
    let dy = my - y;
    let dist = Math.hypot(dx, dy) + 0.1;
    let singularityForce = isDown ? 200.0 / dist : 0.0;

    // Update Velocity (Steering behavior)
    vx += (phiX * 0.7 + dualX * 0.3) * 0.15;
    vy += (phiY * 0.7 + dualY * 0.3) * 0.15;
    
    // Singularity repeller/attractor
    vx += (dx / dist) * singularityForce * 0.02;
    vy += (dy / dist) * singularityForce * 0.02;

    // Friction / Viscous drag
    vx *= 0.92;
    vy *= 0.92;

    x += vx;
    y += vy;
    life += 1.0;

    // Respawn logic (Cellular / Fungal lifecycle)
    if (life > maxLife || x < 0 || x > width || y < 0 || y > height) {
        x = Math.random() * width;
        y = Math.random() * height;
        vx = 0;
        vy = 0;
        life = 0;
    }

    // Write back
    p[idx] = x;
    p[idx + 1] = y;
    p[idx + 2] = vx;
    p[idx + 3] = vy;
    p[idx + 4] = life;

    // [REPO GENOME: structural_color & color_fields]
    // Thin-film interference calculation: 2 * n * d * cos(theta) = m * lambda
    let speed = Math.hypot(vx, vy);
    
    // Film thickness dynamically driven by physical strain (torsion) and velocity
    let d_thickness = 100.0 + torsion * 400.0 + speed * 80.0; 
    let cosTheta = Math.abs(vx) / (speed + 0.001); // Approximation of viewing angle
    let pathDiff = 2.0 * n_chitin * d_thickness * cosTheta;

    // Map optical path difference to IQ Cosine Palette (Neon Acid / Toxic Growth variant)
    let tc = pathDiff / 1000.0;
    
    // Neon Acid parameters: a=0.5, b=0.5, c=[2.0, 1.0, 1.0], d=[0.5, 0.2, 0.25]
    let r = Math.floor(255 * (0.5 + 0.5 * Math.cos(6.28318 * (2.0 * tc + 0.5))));
    let g = Math.floor(255 * (0.5 + 0.5 * Math.cos(6.28318 * (1.0 * tc + 0.2))));
    let b = Math.floor(255 * (0.5 + 0.5 * Math.cos(6.28318 * (1.0 * tc + 0.25))));

    // [REPO GENOME: g2]
    // Resolution Glow: High-stress areas heal with luminous scar tissue
    let fractureMask = (torsion > 1.5 || speed > 3.0) ? 1.0 : 0.0;
    if (fractureMask > 0.0) {
        r = Math.min(255, r + 100);
        g = Math.min(255, g + 50);
        b = Math.min(255, b + 20);
    }

    // Fade in/out based on lifecycle
    let alpha = Math.sin((life / maxLife) * Math.PI) * 0.8;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    
    // Draw particle (slightly elongated along velocity vector to simulate motion blur / hyphae growth)
    let size = 1.0 + fractureMask * 1.5;
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(vy, vx));
    ctx.fillRect(-size, -size * 0.5, size * 2.0 + speed * 0.5, size);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
}

// [REPO GENOME: pixel_voxel]
// Ditherpunk Overlay: Applies the Bayer 4x4 threshold matrix to crunch the fluid dynamics
// into a tactile, retro-digital aesthetic via the 'overlay' blend mode.
ctx.globalCompositeOperation = 'overlay';
ctx.fillStyle = sys.ditherPattern;
ctx.fillRect(0, 0, width, height);
ctx.globalCompositeOperation = 'source-over';