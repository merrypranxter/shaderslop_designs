// THE WEIRD CODE GUY - FERAL DESIGN BRAIN
// INITIATING: "Scale-Free Birefringence Murmuration"
// REJECTING: Standard 2D triangle boids with flat colors.
// MECHANISM: Flocking agents as nodes in a structural color matrix.
//            Oklch color space mapped to Golden Angle sequence and velocity phase.
//            Scale-free correlations trigger VHS schismogenesis (tracking errors).
//            Predator acts as an anti-matter topological defect (difference blending).

if (!canvas.__murmuration_state) {
    const N = 3500; // High density swarm
    
    // Typed arrays for data-oriented performance (Warp-level execution mindset)
    canvas.__murmuration_state = {
        N: N,
        pos: new Float32Array(N * 2),
        vel: new Float32Array(N * 2),
        acc: new Float32Array(N * 2),
        phase: new Float32Array(N), // Golden angle hue distribution
        
        // Spatial hash grid
        cellSize: 45,
        cols: 0,
        rows: 0,
        head: new Int32Array(0),
        next: new Int32Array(N),
        
        // Physics parameters
        maxSpeed: 3.5,
        maxForce: 0.15,
        sepRadius: 18,
        aliRadius: 45,
        cohRadius: 50,
        
        // Analytics
        orderParameter: 0,
        
        init: function(w, h) {
            this.cols = Math.ceil(w / this.cellSize);
            this.rows = Math.ceil(h / this.cellSize);
            this.head = new Int32Array(this.cols * this.rows);
            
            const GOLDEN_ANGLE = 137.50776405; // From color_systems / THE-LISTS
            
            for (let i = 0; i < this.N; i++) {
                this.pos[i * 2] = Math.random() * w;
                this.pos[i * 2 + 1] = Math.random() * h;
                let angle = Math.random() * Math.PI * 2;
                this.vel[i * 2] = Math.cos(angle) * this.maxSpeed;
                this.vel[i * 2 + 1] = Math.sin(angle) * this.maxSpeed;
                this.phase[i] = (i * GOLDEN_ANGLE) % 360; // Spectral dispersion
            }
        }
    };
    canvas.__murmuration_state.init(grid.width, grid.height);
}

const state = canvas.__murmuration_state;

// Handle resize
const reqCols = Math.ceil(grid.width / state.cellSize);
const reqRows = Math.ceil(grid.height / state.cellSize);
if (reqCols !== state.cols || reqRows !== state.rows) {
    state.cols = reqCols;
    state.rows = reqRows;
    state.head = new Int32Array(state.cols * state.rows);
}

// Oklch to RGB (Perceptually uniform math rainbow from color_fields)
function oklchToRgb(L, C, h) {
    const hr = h * Math.PI / 180;
    const a = C * Math.cos(hr);
    const b = C * Math.sin(hr);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    r = r <= 0.0031308 ? r * 12.92 : 1.055 * Math.pow(Math.max(0, r), 1/2.4) - 0.055;
    g = g <= 0.0031308 ? g * 12.92 : 1.055 * Math.pow(Math.max(0, g), 1/2.4) - 0.055;
    bl = bl <= 0.0031308 ? bl * 12.92 : 1.055 * Math.pow(Math.max(0, bl), 1/2.4) - 0.055;

    return `rgb(${Math.max(0, Math.min(255, r * 255)) | 0},${Math.max(0, Math.min(255, g * 255)) | 0},${Math.max(0, Math.min(255, bl * 255)) | 0})`;
}

// 1. Build Spatial Hash (O(1) neighbor lookup)
state.head.fill(-1);
for (let i = 0; i < state.N; i++) {
    let cx = Math.floor(state.pos[i * 2] / state.cellSize);
    let cy = Math.floor(state.pos[i * 2 + 1] / state.cellSize);
    if (cx >= 0 && cx < state.cols && cy >= 0 && cy < state.rows) {
        let cell = cx + cy * state.cols;
        state.next[i] = state.head[cell];
        state.head[cell] = i;
    }
}

// 2. Predator / Disruption Mechanism (Chaotic Attractor)
// Moves in a Lissajous/Lorenz-like path
const predX = grid.width / 2 + Math.sin(time * 0.8) * Math.cos(time * 0.3) * grid.width * 0.4;
const predY = grid.height / 2 + Math.sin(time * 0.5) * Math.cos(time * 0.7) * grid.height * 0.4;

let globalVx = 0;
let globalVy = 0;

// 3. Physics / Flocking Update
for (let i = 0; i < state.N; i++) {
    let x = state.pos[i * 2];
    let y = state.pos[i * 2 + 1];
    let vx = state.vel[i * 2];
    let vy = state.vel[i * 2 + 1];

    let cx = Math.floor(x / state.cellSize);
    let cy = Math.floor(y / state.cellSize);
    
    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohCount = 0;

    // Nearest neighbor search in 3x3 grid
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            let nx = cx + dx;
            let ny = cy + dy;
            if (nx >= 0 && nx < state.cols && ny >= 0 && ny < state.rows) {
                let cell = nx + ny * state.cols;
                let j = state.head[cell];
                
                while (j !== -1) {
                    if (i !== j) {
                        let dxPos = state.pos[j * 2] - x;
                        let dyPos = state.pos[j * 2 + 1] - y;
                        let distSq = dxPos * dxPos + dyPos * dyPos;
                        
                        if (distSq > 0.0001 && distSq < state.cohRadius * state.cohRadius) {
                            let dist = Math.sqrt(distSq);
                            
                            // Separation
                            if (dist < state.sepRadius) {
                                let force = (state.sepRadius - dist) / dist;
                                sepX -= dxPos * force;
                                sepY -= dyPos * force;
                                sepCount++;
                            }
                            
                            // Alignment
                            if (dist < state.aliRadius) {
                                aliX += state.vel[j * 2];
                                aliY += state.vel[j * 2 + 1];
                                aliCount++;
                            }
                            
                            // Cohesion
                            cohX += state.pos[j * 2];
                            cohY += state.pos[j * 2 + 1];
                            cohCount++;
                        }
                    }
                    j = state.next[j];
                }
            }
        }
    }

    let ax = 0, ay = 0;

    if (sepCount > 0) {
        ax += sepX * 2.5;
        ay += sepY * 2.5;
    }
    if (aliCount > 0) {
        aliX /= aliCount;
        aliY /= aliCount;
        let aliDist = Math.sqrt(aliX*aliX + aliY*aliY);
        if (aliDist > 0) {
            ax += (aliX / aliDist * state.maxSpeed - vx) * 1.0;
            ay += (aliY / aliDist * state.maxSpeed - vy) * 1.0;
        }
    }
    if (cohCount > 0) {
        cohX = (cohX / cohCount) - x;
        cohY = (cohY / cohCount) - y;
        let cohDist = Math.sqrt(cohX*cohX + cohY*cohY);
        if (cohDist > 0) {
            ax += (cohX / cohDist * state.maxSpeed - vx) * 0.8;
            ay += (cohY / cohDist * state.maxSpeed - vy) * 0.8;
        }
    }

    // Predator Avoidance (Hawk Strike / Chaotic Attractor)
    let pdx = x - predX;
    let pdy = y - predY;
    let pDistSq = pdx * pdx + pdy * pdy;
    if (pDistSq < 40000) { // 200px radius
        let pDist = Math.sqrt(pDistSq);
        ax += (pdx / pDist) * (200 - pDist) * 0.05;
        ay += (pdy / pDist) * (200 - pDist) * 0.05;
    }

    // Soft Boundary Repulsion
    const margin = 100;
    const turnFactor = 0.5;
    if (x < margin) ax += turnFactor;
    if (x > grid.width - margin) ax -= turnFactor;
    if (y < margin) ay += turnFactor;
    if (y > grid.height - margin) ay -= turnFactor;

    // Clamp Acceleration (Reynolds truncation)
    let aMag = Math.sqrt(ax * ax + ay * ay);
    if (aMag > state.maxForce) {
        ax = (ax / aMag) * state.maxForce;
        ay = (ay / aMag) * state.maxForce;
    }

    state.acc[i * 2] = ax;
    state.acc[i * 2 + 1] = ay;
    
    globalVx += vx;
    globalVy += vy;
}

// Global Order Parameter (Vicsek phase transition)
let avgSpeed = Math.sqrt(globalVx*globalVx + globalVy*globalVy) / state.N;
state.orderParameter = avgSpeed / state.maxSpeed;

// 4. Render & Integration
// Volumetric accumulation mist (from fractal optics)
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = `rgba(5, 5, 8, ${state.orderParameter > 0.4 ? 0.08 : 0.15})`; // Trail length depends on order
ctx.fillRect(0, 0, grid.width, grid.height);

ctx.globalCompositeOperation = 'lighter'; // Constructive interference blending
ctx.lineWidth = 1.5;

for (let i = 0; i < state.N; i++) {
    let vx = state.vel[i * 2] + state.acc[i * 2];
    let vy = state.vel[i * 2 + 1] + state.acc[i * 2 + 1];
    
    // Clamp velocity
    let speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > state.maxSpeed) {
        vx = (vx / speed) * state.maxSpeed;
        vy = (vy / speed) * state.maxSpeed;
    } else if (speed < 0.5) {
        vx = (vx / speed) * 0.5;
        vy = (vy / speed) * 0.5;
    }
    
    state.vel[i * 2] = vx;
    state.vel[i * 2 + 1] = vy;
    
    let x = state.pos[i * 2] + vx;
    let y = state.pos[i * 2 + 1] + vy;
    
    // Toroidal wrap for physics, but render smoothly
    if (x < 0) x += grid.width;
    if (x > grid.width) x -= grid.width;
    if (y < 0) y += grid.height;
    if (y > grid.height) y -= grid.height;
    
    state.pos[i * 2] = x;
    state.pos[i * 2 + 1] = y;

    // Rainbow Math: Structural Color & Thin-Film Interference
    // Hue driven by Golden Angle (identity) + Velocity Phase + Time
    let angle = Math.atan2(vy, vx);
    let hue = (state.phase[i] + angle * (180 / Math.PI) + time * 30) % 360;
    
    // Chroma and Lightness driven by speed (kinetic energy -> optical intensity)
    let L = 0.5 + (speed / state.maxSpeed) * 0.25;
    let C = 0.1 + (speed / state.maxSpeed) * 0.15;
    
    ctx.strokeStyle = oklchToRgb(L, C, hue);
    
    ctx.beginPath();
    // Render as motion blur trail (head to tail)
    let tailLen = 3.0 + speed;
    ctx.moveTo(x, y);
    ctx.lineTo(x - vx * tailLen, y - vy * tailLen);
    ctx.stroke();

    // Information Cascade (High acceleration triggers localized diffraction rings)
    let aMag = Math.sqrt(state.acc[i*2]*state.acc[i*2] + state.acc[i*2+1]*state.acc[i*2+1]);
    if (aMag > state.maxForce * 0.9) {
        ctx.fillStyle = oklchToRgb(L + 0.2, C, hue);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 5. The Strange Mechanism: Anti-Matter SDF Subtraction (Predator)
ctx.globalCompositeOperation = 'difference';
ctx.fillStyle = '#FFFFFF';
ctx.beginPath();
ctx.arc(Math.max(0, predX), Math.max(0, predY), 40 + Math.sin(time*5)*10, 0, Math.PI * 2);
ctx.fill();
ctx.globalCompositeOperation = 'source-over';

// 6. Analog Artifacts / Schismogenesis
// If the flock achieves critical alignment, the simulation hardware "glitches"
if (state.orderParameter > 0.45 && Math.random() < 0.15) {
    let gY = Math.random() * grid.height;
    let gH = Math.random() * 80 + 10;
    let shift = (Math.random() - 0.5) * 60;
    
    // Tracking error slice
    ctx.drawImage(canvas, 0, gY, grid.width, gH, shift, gY, grid.width, gH);
    
    // RGB Phase Bleed
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = oklchToRgb(0.6, 0.2, (time * 100) % 360);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(shift, gY, grid.width, gH);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
}