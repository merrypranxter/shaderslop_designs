if (!window._feralMyspace) {
    window._feralMyspace = {
        particles: [],
        gridData: new Float32Array(grid.cols * grid.rows),
        colors: ['#FF0099', '#00FFFF', '#CCFF00', '#FF1493', '#7D26CD', '#FFFFFF'],
        glitchChars: ["☆", "♡", "☠", "♪", "*", "+", "x", "X", "_", "~", "<", ">", "/", "b", "r", "l", "i", "n", "k"],
        frame: 0,
        lastMouse: { x: -1000, y: -1000 }
    };
    for(let i=0; i<window._feralMyspace.gridData.length; i++) {
        window._feralMyspace.gridData[i] = Math.random() * 0.05;
    }
}

const S = window._feralMyspace;
S.frame++;

ctx.fillStyle = 'rgba(10, 5, 15, 0.15)';
ctx.fillRect(0, 0, grid.width, grid.height);

if (S.frame % 10 === 0) {
    ctx.fillStyle = 'rgba(255, 0, 153, 0.03)';
    ctx.fillRect(0, Math.random() * grid.height, grid.width, Math.random() * 50);
}

let mouseSpeed = Math.hypot(mouse.x - S.lastMouse.x, mouse.y - S.lastMouse.y);
let isMoving = mouseSpeed > 1 && mouse.x > 0 && mouse.y > 0;

if (isMoving || mouse.isPressed) {
    let gx = Math.floor((mouse.x / grid.width) * grid.cols);
    let gy = Math.floor((mouse.y / grid.height) * grid.rows);
    
    let numParticles = mouse.isPressed ? 12 : 3;
    for (let i = 0; i < numParticles; i++) {
        S.particles.push({
            x: mouse.x + (Math.random() - 0.5) * 40,
            y: mouse.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 4 + (mouse.isPressed ? 4 : -2), 
            life: 1.0,
            color: S.colors[Math.floor(Math.random() * S.colors.length)],
            size: Math.random() * 12 + 2,
            wobblePhase: Math.random() * Math.PI * 2,
            isStar: Math.random() > 0.8
        });
    }

    if (gx >= 0 && gx < grid.cols && gy >= 0 && gy < grid.rows) {
        let brushSize = mouse.isPressed ? 3 : 1;
        for (let dy = -brushSize; dy <= brushSize; dy++) {
            for (let dx = -brushSize; dx <= brushSize; dx++) {
                let nx = gx + dx;
                let ny = gy + dy;
                if (nx >= 0 && nx < grid.cols && ny >= 0 && ny < grid.rows) {
                    let idx = ny * grid.cols + nx;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    let intensity = Math.max(0, (brushSize - dist) / brushSize);
                    S.gridData[idx] += intensity * (mouse.isPressed ? 3.0 : 1.0);
                }
            }
        }
    }
}
S.lastMouse = { x: mouse.x, y: mouse.y };

ctx.globalCompositeOperation = 'screen';
for (let i = S.particles.length - 1; i >= 0; i--) {
    let p = S.particles[i];
    
    p.x += p.vx + Math.sin(p.wobblePhase + S.frame * 0.15) * 3;
    p.y += p.vy;
    p.vy += 0.15; 
    p.vx *= 0.95; 
    p.life -= 0.015;

    if (p.life <= 0) {
        S.particles.splice(i, 1);
        continue;
    }

    let isSparkleFrame = Math.sin(p.wobblePhase + S.frame * 0.5) > 0.8;
    ctx.fillStyle = (isSparkleFrame && p.life > 0.3) ? '#FFFFFF' : p.color;
    let r = p.size * Math.pow(p.life, 0.5);
    
    ctx.beginPath();
    if (p.isStar && isSparkleFrame) {
        ctx.moveTo(p.x, p.y - r*2.5);
        ctx.lineTo(p.x + r*0.4, p.y - r*0.4);
        ctx.lineTo(p.x + r*2.5, p.y);
        ctx.lineTo(p.x + r*0.4, p.y + r*0.4);
        ctx.lineTo(p.x, p.y + r*2.5);
        ctx.lineTo(p.x - r*0.4, p.y + r*0.4);
        ctx.lineTo(p.x - r*2.5, p.y);
        ctx.lineTo(p.x - r*0.4, p.y - r*0.4);
    } else {
        ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    }
    ctx.fill();
}
ctx.globalCompositeOperation = 'source-over';

let out = [];
let newGridData = new Float32Array(grid.cols * grid.rows);
let rawrStr = "rAwR_xD_";

for (let y = 0; y < grid.rows; y++) {
    let row = [];
    for (let x = 0; x < grid.cols; x++) {
        let idx = y * grid.cols + x;
        let val = S.gridData[idx];

        let sum = val;
        let count = 1;
        if (x > 0) { sum += S.gridData[idx - 1]; count++; }
        if (x < grid.cols - 1) { sum += S.gridData[idx + 1]; count++; }
        if (y > 0) { sum += S.gridData[idx - grid.cols]; count++; }
        if (y < grid.rows - 1) { sum += S.gridData[idx + grid.cols]; count++; }
        
        let dripVal = val;
        if (y > 0) {
            let upIdx = (y - 1) * grid.cols + x;
            if (S.gridData[upIdx] > 0.5) {
                dripVal += S.gridData[upIdx] * 0.4; 
            }
        }

        let nextVal = (sum / count) * 0.85 + dripVal * 0.12; 
        if (nextVal < 0.005) nextVal = 0;
        newGridData[idx] = nextVal;

        let char = ' ';
        let col = '#222';
        let size = 14;

        if (nextVal > 2.0) {
            char = S.glitchChars[Math.floor(Math.random() * S.glitchChars.length)];
            col = S.colors[Math.floor(Math.random() * S.colors.length)];
            if (Math.random() > 0.6) col = '#FFFFFF';
            size = 18 + Math.random() * 6;
        } else if (nextVal > 0.6) {
            let edgeChars = "xX_~+<>";
            char = edgeChars[Math.floor(Math.random() * edgeChars.length)];
            col = S.colors[Math.floor((nextVal * 12) % S.colors.length)];
            size = 14;
        } else if (nextVal > 0.1) {
            char = (x + y + Math.floor(time * 10)) % 4 === 0 ? '.' : ' ';
            col = '#FF0099';
        } else {
            let noise = Math.sin(x * 0.15 + time * 2) * Math.cos(y * 0.15 - time);
            if (noise > 0.85) {
                char = rawrStr[(x + y) % rawrStr.length];
                col = `rgba(255, 0, 153, ${Math.random() * 0.4})`;
                size = 10;
            }
        }

        if (Math.random() < 0.0002) {
            char = '✖'; 
            col = '#00FFFF';
            size = 20;
        }

        row.push({ char: char, color: col, size: size });
    }
    out.push(row);
}

S.gridData = newGridData;

return out;