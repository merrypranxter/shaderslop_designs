// Clear the canvas with a slight fade for phosphor decay and motion blur
ctx.fillStyle = 'rgba(10, 10, 12, 0.8)';
ctx.fillRect(0, 0, grid.width, grid.height);

// V-Sync Logic: The analog roll
let rollSpeed = time * 0.15;
if (Math.sin(time * 0.5) > 0.92) rollSpeed += time * 6; // Sync loss burst
let vSyncOffset = (rollSpeed * grid.height) % grid.height;

// Function to draw the SMPTE color bars and base analog signal
const drawTapeContent = (offsetY) => {
    // Main SMPTE Bars
    const colors = ['#bfbfbf', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    const barW = grid.width / colors.length;
    for(let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * barW, offsetY, barW + 1, grid.height * 0.67);
    }
    
    // Castellation / Bottom patches
    const bottomColors = ['#0000c0', '#0a0a0a', '#c000c0', '#0a0a0a', '#00c0c0', '#0a0a0a', '#bfbfbf'];
    for(let i = 0; i < bottomColors.length; i++) {
        ctx.fillStyle = bottomColors[i];
        ctx.fillRect(i * barW, offsetY + grid.height * 0.67, barW + 1, grid.height * 0.08);
    }
    
    // PLUGE / Black reference
    const plugeColors = ['#000000', '#0a0a0a', '#141414', '#0a0a0a', '#000000', '#000000', '#000000'];
    for(let i = 0; i < plugeColors.length; i++) {
        ctx.fillStyle = plugeColors[i];
        ctx.fillRect(i * barW, offsetY + grid.height * 0.75, barW + 1, grid.height * 0.25);
    }
    
    // Base Luma Noise
    ctx.fillStyle = `rgba(255, 255, 255, 0.04)`;
    for(let i = 0; i < 250; i++) {
        ctx.fillRect(Math.random() * grid.width, offsetY + Math.random() * grid.height, Math.random() * 40 + 10, Math.random() * 3 + 1);
    }
};

// Draw three copies to handle the seamless vertical wrap
drawTapeContent(vSyncOffset - grid.height);
drawTapeContent(vSyncOffset);
drawTapeContent(vSyncOffset + grid.height);

// Tape Crease (Physical media damage)
let creaseX = grid.width * 0.6 + Math.sin(time * 0.3) * 150;
ctx.drawImage(canvas, creaseX, 0, 20, grid.height, creaseX - 8, 0, 36, grid.height);
ctx.fillStyle = `rgba(255, 255, 255, 0.06)`;
ctx.fillRect(creaseX, 0, 4, grid.height);

// Timebase Error & Tracking Noise (Horizontal Slicing)
const sliceH = 4;
const numSlices = Math.floor(grid.height / sliceH);

for(let i = 0; i < numSlices; i++) {
    let y = i * sliceH;
    
    // Timebase error (analog wobble)
    let tbe = Math.sin(y * 0.02 + time * 20) * 1.5;
    
    // Tracking noise phase
    let trackingPhase = y * 0.003 - time * 0.6;
    let trackingIntensity = Math.pow(Math.sin(trackingPhase), 40); // Sharp, dense peaks
    
    // User interaction exacerbates tracking error
    if (mouse.isPressed && mouse.y !== undefined) {
        let dist = Math.abs(mouse.y - y);
        if (dist < 150) trackingIntensity += (150 - dist) / 80;
    }
    
    let shiftX = tbe;
    
    if (trackingIntensity > 0.01 || Math.random() < 0.02) {
        shiftX += (Math.random() - 0.5) * 60 * trackingIntensity;
        if (Math.random() < 0.01) shiftX += (Math.random() - 0.5) * 200; // Sharp tear
    }
    
    // Apply shift by copying the canvas slice over itself
    if (Math.abs(shiftX) > 0.5) {
        ctx.drawImage(canvas, 0, y, grid.width, sliceH, shiftX, y, grid.width, sliceH);
    }
    
    // Tracking static overlay
    if (trackingIntensity > 0.1) {
        ctx.fillStyle = `rgba(180, 200, 255, ${Math.random() * 0.5 * trackingIntensity})`;
        ctx.fillRect(0, y, grid.width, sliceH);
        
        // RF noise dots
        if (Math.random() < trackingIntensity) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8})`;
            ctx.fillRect(Math.random() * grid.width, y, Math.random() * 40, sliceH);
        }
    }
}

// Chroma Delay / Smear
ctx.globalCompositeOperation = 'screen';
ctx.globalAlpha = 0.3;
ctx.drawImage(canvas, 6, 0); // Shift right for red/luma lag
ctx.globalAlpha = 1.0;
ctx.globalCompositeOperation = 'source-over';

// Scanlines
ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
for(let y = 0; y < grid.height; y += 3) {
    ctx.fillRect(0, y, grid.width, 1);
}

// ==========================================
// ASCII OSD & Glitchcore Digital Artifacting
// ==========================================
const chars = [];
for (let y = 0; y < grid.rows; y++) {
    const row = [];
    for (let x = 0; x < grid.cols; x++) {
        row.push({ char: ' ', color: '#ffffff' });
    }
    chars.push(row);
}

const writeText = (x, y, text, color, ghostColor) => {
    x = Math.floor(x);
    y = Math.floor(y);
    for(let i = 0; i < text.length; i++) {
        let cx = x + i;
        if (cx >= 0 && cx < grid.cols && y >= 0 && y < grid.rows) {
            chars[y][cx] = { char: text[i], color: color };
            // Analog ghosting to the right
            if (ghostColor && cx + 1 < grid.cols && chars[y][cx+1].char === ' ') {
                chars[y][cx+1] = { char: text[i], color: ghostColor };
            }
        }
    }
};

let osdColor = '#00ff44';
let osdGhost = 'rgba(0, 255, 68, 0.3)';

// Blinking PLAY indicator
if (Math.floor(time * 1.5) % 2 === 0) {
    writeText(4, 2, "PLAY \u25BA", osdColor, osdGhost);
}
writeText(4, 4, "SP", osdColor, osdGhost);

// Timecode
const h = Math.floor(time / 3600);
const m = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
const s = Math.floor(time % 60).toString().padStart(2, '0');
const frames = Math.floor((time * 30) % 30).toString().padStart(2, '0');
writeText(grid.cols - 18, grid.rows - 4, `${h}:${m}:${s}:${frames}`, osdColor, osdGhost);

// Tracking Bar (Updates at ~10Hz)
let trackingStr = "TRACKING ";
let seed = Math.floor(time * 10);
for(let i = 0; i < 15; i++) {
    let r = Math.sin(seed + i * 12.345) * 0.5 + 0.5;
    trackingStr += r < 0.85 ? "|" : " ";
}
writeText(Math.floor(grid.cols / 2 - 12), grid.rows - 4, trackingStr, osdColor, osdGhost);

// Glitchcore Digital Injection: Codec corruption bleeding into the analog tracking failure
const glitchChars = ['█', '▓', '▒', '░', '§', '¥', 'µ', '¶', '‡', '†', '×', '÷', '¿', '⌐', '¬', '½', '¼', '«', '»', '▲', '▼', '►', '◄'];
const glitchColors = ['#ff0055', '#00aaff', '#00ff00', '#ffff00', '#ffffff'];

for (let y = 0; y < grid.rows; y++) {
    let yPx = (y / grid.rows) * grid.height;
    let trackingPhase = yPx * 0.003 - time * 0.6;
    let trackingIntensity = Math.pow(Math.sin(trackingPhase), 40);
    
    if (mouse.isPressed && mouse.y !== undefined) {
        let dist = Math.abs(mouse.y - yPx);
        if (dist < 150) trackingIntensity += (150 - dist) / 80;
    }
    
    // Inject digital blocks where analog signal fails
    if (trackingIntensity > 0.15 || Math.random() < 0.003) {
        for (let x = 0; x < grid.cols; x++) {
            if (Math.random() < trackingIntensity * 0.35) {
                let char = glitchChars[Math.floor(Math.random() * glitchChars.length)];
                let col = glitchColors[Math.floor(Math.random() * glitchColors.length)];
                if (Math.random() > 0.6) col = '#ffffff'; // Bias towards white noise
                chars[y][x] = { char: char, color: col };
            }
        }
    }
}

return chars;