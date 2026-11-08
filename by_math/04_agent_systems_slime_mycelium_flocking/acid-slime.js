const cellSize = 5;
const cols = Math.ceil(grid.width / cellSize);
const rows = Math.ceil(grid.height / cellSize);

if (!canvas.__smState || canvas.__smState.cols !== cols || canvas.__smState.rows !== rows) {
    canvas.__smState = {
        cols, rows,
        trailMap: new Float32Array(cols * rows),
        agents: [],
        lastTime: time,
        phase: 'INIT',
        tickAcc: 0
    };
}

const state = canvas.__smState;
const dt = Math.min(time - state.lastTime, 0.1); // Cap dt to prevent death spirals
state.lastTime = time;

// Lifecycle: 20-second cycle
const cycleDuration = 20;
const tInCycle = time % cycleDuration;
let currentPhase = 'GROW';
if (tInCycle > 12 && tInCycle <= 16) currentPhase = 'PLATEAU';
if (tInCycle > 16) currentPhase = 'FADE';

if (currentPhase === 'GROW' && state.phase !== 'GROW') {
    state.agents = [];
    for (let i = 0; i < 40; i++) {
        state.agents.push({
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows),
            dx: 0,
            dy: Math.random() < 0.5 ? 1 : -1,
            timer: 0,
            id: Math.random()
        });
    }
}

if (currentPhase === 'FADE' && state.phase !== 'FADE') {
    state.agents = []; // Kill all tips instantly
}

state.phase = currentPhase;

// Agent Update (Orthogonal Slime Mold routing)
if (currentPhase === 'GROW') {
    const tickRate = 0.05;
    state.tickAcc += dt;
    while (state.tickAcc > tickRate) {
        state.tickAcc -= tickRate;
        
        let newAgents = [];
        // Bio-feedback: branch more if population is low
        let branchProb = 0.02;
        if (state.agents.length < 50) branchProb = 0.08;
        else if (state.agents.length > 400) branchProb = 0.002;
        
        state.agents.forEach(a => {
            state.trailMap[a.y * cols + a.x] = 1.0;
            
            a.timer--;
            if (a.timer <= 0) {
                if (a.dx !== 0) {
                    // Was moving horizontally, switch to vertical
                    a.dx = 0;
                    a.dy = Math.random() < 0.5 ? -1 : 1;
                    a.timer = Math.floor(Math.random() * 20 + 5);
                } else {
                    // Was moving vertically
                    if (Math.random() < 0.3) {
                        a.dx = Math.random() < 0.5 ? -1 : 1;
                        a.dy = 0;
                        a.timer = Math.floor(Math.random() * 8 + 2);
                    } else {
                        if (Math.random() < 0.1) a.dy *= -1; // reverse
                        a.timer = Math.floor(Math.random() * 20 + 5);
                    }
                }
            }
            
            // Branching
            if (Math.random() < branchProb) {
                newAgents.push({
                    x: a.x,
                    y: a.y,
                    dx: a.dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0,
                    dy: a.dy === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0,
                    timer: Math.floor(Math.random() * 10 + 5),
                    id: Math.random()
                });
            }
            
            a.x = (a.x + a.dx + cols) % cols;
            a.y = (a.y + a.dy + rows) % rows;
            
            // Crowd control: prune if moving over heavily traversed areas
            if (state.trailMap[a.y * cols + a.x] > 0.8) {
                if (Math.random() < 0.05) a.dead = true;
            }
        });
        
        state.agents.push(...newAgents);
        state.agents = state.agents.filter(a => !a.dead);
    }
}

// Fade trails
for (let i = 0; i < state.trailMap.length; i++) {
    if (state.trailMap[i] > 0) {
        // Slow decay during grow/plateau, fast decay during fade
        state.trailMap[i] -= (currentPhase === 'FADE') ? 0.005 : 0.0005;
        if (state.trailMap[i] < 0) state.trailMap[i] = 0;
    }
}

// Render LED Matrix Base
ctx.fillStyle = '#111111';
ctx.fillRect(0, 0, grid.width, grid.height);

ctx.beginPath();
for(let x = 0; x <= grid.width; x += cellSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, grid.height);
}
for(let y = 0; y <= grid.height; y += cellSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(grid.width, y);
}
ctx.strokeStyle = '#050505';
ctx.lineWidth = 2;
ctx.stroke();

// Scan band logic
let band1 = (time * 30) % rows;
let band2 = (time * 18 + rows / 2) % rows;
const glitchWidth = 2;

// Batch render trails by alpha for performance
const groups = Array.from({length: 10}, () => []);

for (let y = 0; y < rows; y++) {
    let tear = 0;
    let dist1 = Math.min(Math.abs(y - band1), Math.abs(y - (band1 - rows)), Math.abs(y - (band1 + rows)));
    if (dist1 < glitchWidth) {
        tear = Math.sin(y * 10 + time * 20) * 4;
    } else {
        let dist2 = Math.min(Math.abs(y - band2), Math.abs(y - (band2 - rows)), Math.abs(y - (band2 + rows)));
        if (dist2 < glitchWidth) {
            tear = Math.cos(y * 15 - time * 15) * 3;
        }
    }
    
    for (let x = 0; x < cols; x++) {
        let val = state.trailMap[y * cols + x];
        if (val > 0.02) {
            let drawX = (x + Math.round(tear) + cols) % cols;
            let alphaIdx = Math.min(9, Math.floor(val * 10));
            groups[alphaIdx].push({x: drawX, y: y});
        }
    }
}

for (let i = 0; i < 10; i++) {
    if (groups[i].length === 0) continue;
    ctx.fillStyle = `rgba(255, 255, 255, ${(i+1)/10})`;
    ctx.beginPath();
    for (let j = 0; j < groups[i].length; j++) {
        let cell = groups[i][j];
        ctx.rect(cell.x * cellSize + 1, cell.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    ctx.fill();
}

// Render Agent Tips (Acid Yellow)
if (currentPhase === 'GROW' || currentPhase === 'PLATEAU') {
    state.agents.forEach(a => {
        let tear = 0;
        let dist1 = Math.min(Math.abs(a.y - band1), Math.abs(a.y - (band1 - rows)), Math.abs(a.y - (band1 + rows)));
        if (dist1 < glitchWidth) {
            tear = Math.sin(a.y * 10 + time * 20) * 4;
        } else {
            let dist2 = Math.min(Math.abs(a.y - band2), Math.abs(a.y - (band2 - rows)), Math.abs(a.y - (band2 + rows)));
            if (dist2 < glitchWidth) {
                tear = Math.cos(a.y * 15 - time * 15) * 3;
            }
        }
        
        let drawX = (a.x + Math.round(tear) + cols) % cols;
        let pulse = 0.6 + 0.4 * Math.sin(time * 10 + a.id * 100);
        
        // Core pixel
        ctx.fillStyle = `rgba(255, 229, 0, ${pulse})`;
        ctx.fillRect(drawX * cellSize + 1, a.y * cellSize + 1, cellSize - 2, cellSize - 2);
        
        // Diode bloom (plus shape)
        ctx.fillStyle = `rgba(255, 229, 0, ${pulse * 0.3})`;
        ctx.fillRect((drawX - 1) * cellSize + 1, a.y * cellSize + 1, cellSize * 3 - 2, cellSize - 2);
        ctx.fillRect(drawX * cellSize + 1, (a.y - 1) * cellSize + 1, cellSize - 2, cellSize * 3 - 2);
    });
}

// Sensor damage / hot pixels
if (Math.random() < 0.2) {
    ctx.fillStyle = Math.random() < 0.3 ? '#FFE500' : '#FFFFFF';
    let hx = Math.floor(Math.random() * cols);
    let hy = Math.floor(Math.random() * rows);
    ctx.fillRect(hx * cellSize + 1, hy * cellSize + 1, cellSize - 2, cellSize - 2);
}