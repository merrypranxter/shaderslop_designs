const output = [];
const motifs = ['☁', '☀', '☾', '★', '✧', '0', '1', '{', '}', '?', '!', '%', '#', '@', '&', '∞', '∆'];
const azathothChars = ['A', 'Z', 'A', 'T', 'H', 'O', 'T', 'H', '.', 'S', 'Y', 'S'];
const tentacleChars = ['~', '(', ')', 'S', '8', '§', '¶', '≈'];
const glitchChars = ['█', '▓', '▒', '░', '0', '1', 'E', 'R', 'R'];

const mx = mouse.x ?? (grid.cols * 6);
const my = mouse.y ?? (grid.rows * 6);

for (let y = 0; y < grid.rows; y++) {
    const row = [];
    for (let x = 0; x < grid.cols; x++) {
        const px = x * 12;
        const py = y * 12;
        
        const dx = px - mx;
        const dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        const nx = x / grid.cols;
        const ny = y / grid.rows;
        
        const wave1 = Math.sin(nx * 8 + time * 2) * Math.cos(ny * 6 - time * 1.5);
        const wave2 = Math.sin(ny * 10 - nx * 4 + time * 3);
        const wave = (wave1 + wave2) / 2;
        
        const warpRadius = 200;
        const warp = Math.max(0, warpRadius - dist) / warpRadius; 
        const warpRipple = Math.sin(dist * 0.15 - time * 8) * warp;
        
        let char = ' ';
        let hue, sat, lit;
        let size = 12 + wave * 4 + warp * 18 + warpRipple * 10;

        if (mouse.isPressed) {
            hue = (x * 34 + y * 21 + time * 2000) % 360;
            sat = 100;
            lit = Math.random() > 0.5 ? 60 : 20;
            char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
            size += Math.random() * 16 - 8;
        } else {
            if (dist < 40) {
                const spin = angle * 4 + time * 10;
                char = azathothChars[Math.floor(Math.abs(spin)) % azathothChars.length];
            } else if (dist < 100) {
                const tIdx = Math.floor(Math.abs(warpRipple * 10 + angle * 3 - time * 5)) % tentacleChars.length;
                char = tentacleChars[tIdx];
            } else {
                const charIdx = Math.floor(Math.abs(wave * motifs.length * 0.5 + warpRipple * 5 + time * 2)) % motifs.length;
                char = motifs[charIdx];
            }
            
            const baseHue = (wave * 60 + time * 40 + 300) % 360;
            hue = baseHue - (warp * 180); 
            if (hue < 0) hue += 360;
            
            sat = 70 + warp * 30; 
            lit = 50 + wave * 15 + warpRipple * 20; 
            
            if ((char === '0' || char === '1' || char === '{' || char === '}') && Math.random() > 0.98) {
                sat = 100;
                lit = 90;
                hue = 60; 
            }
        }
        
        size = Math.max(6, Math.min(size, 45));
        
        row.push({ char, color: `hsl(${hue}, ${sat}%, ${lit}%)`, size });
    }
    output.push(row);
}
return output;