const cx = canvas.width / 2;
const cy = canvas.height / 2;

ctx.globalCompositeOperation = 'source-over';

ctx.save();
ctx.translate(cx, cy);
ctx.scale(0.985, 0.985); 
ctx.rotate(Math.sin(time * 0.5) * 0.015);
ctx.translate(-cx, -cy);
ctx.globalAlpha = 0.94; 
ctx.drawImage(canvas, 0, 0);
ctx.restore();

ctx.globalAlpha = 0.08;
ctx.fillStyle = '#02000a'; 
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.globalAlpha = 1.0;

if (Math.random() < 0.25) {
    let gh = Math.random() * 40 + 5;
    let gy = Math.random() * canvas.height;
    let gShift = (Math.random() - 0.5) * 50;
    ctx.drawImage(canvas, 0, gy, canvas.width, gh, gShift, gy, canvas.width, gh);
    
    if (Math.random() < 0.3) {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(gShift, gy, canvas.width, gh);
        ctx.globalCompositeOperation = 'source-over';
    }
}

let tilt = 0.5 + (mouse.y / canvas.height - 0.5) * 1.2;
let rot = time * 0.7 + (mouse.x / canvas.width - 0.5) * 2.5;

const majorColors = ['#00ffff', '#ff00ff', '#ffff00'];
const minorColors = ['#00ff00', '#ff0000', '#0000ff', '#ff8800', '#8800ff', '#00ff88', '#ff0088'];

let paths = [];
for (let i = 0; i <= 10; i++) {
    let isCore = (i === 10);
    let isMajor = i < 3 && !isCore;
    let numPoints = isCore ? 100 : (isMajor ? 150 : 80);
    let pts = [];
    
    for (let j = 0; j <= numPoints; j++) {
        let t = j / numPoints;
        let phi = t * Math.PI;
        
        let R, theta, y;
        if (isCore) {
            R = Math.sin(phi) * 0.12; 
            y = -Math.cos(phi) * 1.5;
            theta = t * Math.PI * 2 * 15 - time * 6; 
        } else {
            R = Math.sin(phi) * (1.6 + 0.9 * Math.cos(phi));
            y = -Math.cos(phi) * 1.5 + Math.exp(-phi * 4) * 0.5; 
            let angleOffset = (i / 10) * Math.PI * 2;
            let twists = 5;
            theta = angleOffset + t * Math.PI * 2 * twists + (isMajor ? time * 1.2 : -time * 0.8);
        }
        
        let x = R * Math.cos(theta);
        let z = R * Math.sin(theta);
        
        let jit = mouse.isPressed ? 0.15 : 0.01;
        x += (Math.random() - 0.5) * jit;
        y += (Math.random() - 0.5) * jit;
        z += (Math.random() - 0.5) * jit;
        
        let rx = x;
        let ry = y * Math.cos(tilt) - z * Math.sin(tilt);
        let rz = y * Math.sin(tilt) + z * Math.cos(tilt);
        
        let fx = rx * Math.cos(rot) - rz * Math.sin(rot);
        let fy = ry;
        let fz = rx * Math.sin(rot) + rz * Math.cos(rot);
        
        let scale = Math.min(canvas.width, canvas.height) * 0.28;
        let projZ = 1 / (fz * 0.3 + 2.5);
        let px = cx + fx * scale * projZ;
        let py = cy + fy * scale * projZ;
        
        pts.push({px, py, projZ, isMajor, isCore, t});
    }
    paths.push(pts);
}

ctx.globalCompositeOperation = 'lighter';
paths.forEach((pts, i) => {
    let isCore = pts[0].isCore;
    let isMajor = pts[0].isMajor;
    let color = isCore ? '#ffffff' : (isMajor ? majorColors[i] : minorColors[i - 3]);
    
    ctx.beginPath();
    pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
    });
    
    ctx.lineWidth = isMajor ? 2.5 : 1;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    
    ctx.lineWidth = isMajor ? 8 : 3;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    
    let packetSpeed = isCore ? 1.5 : (isMajor ? 0.8 : -0.6);
    let packetT = (time * packetSpeed + i * 0.13);
    packetT = packetT - Math.floor(packetT); 
    
    let pIdx = Math.floor(packetT * pts.length);
    if (pIdx >= 0 && pIdx < pts.length) {
        let p = pts[pIdx];
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.px, p.py, isMajor || isCore ? 4 : 2, 0, Math.PI*2);
        ctx.fill();
        
        for(let k=0; k<4; k++) {
            let dx = (Math.random() - 0.5) * 50;
            let dy = (Math.random() - 0.5) * 50;
            ctx.fillStyle = color;
            ctx.fillRect(p.px + dx, p.py + dy, 2, 2);
        }
    }
});

ctx.globalCompositeOperation = 'source-over';

ctx.strokeStyle = '#dfdfdf';
ctx.lineWidth = 4;
ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 2;
ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
ctx.strokeStyle = '#808080';
ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

ctx.fillStyle = '#000080';
ctx.fillRect(14, 14, canvas.width - 28, 24);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 13px "MS Sans Serif", Arial, sans-serif';
ctx.fillText("ASTRAL_OS.exe - ANU_KERNEL [OVERCLOCK]", 20, 31);

ctx.fillStyle = '#c0c0c0';
ctx.fillRect(canvas.width - 34, 17, 18, 18);
ctx.strokeStyle = '#ffffff';
ctx.beginPath(); ctx.moveTo(canvas.width - 34, 35); ctx.lineTo(canvas.width - 34, 17); ctx.lineTo(canvas.width - 16, 17); ctx.stroke();
ctx.strokeStyle = '#000000';
ctx.beginPath(); ctx.moveTo(canvas.width - 16, 17); ctx.lineTo(canvas.width - 16, 35); ctx.lineTo(canvas.width - 34, 35); ctx.stroke();
ctx.fillStyle = '#000000';
ctx.font = 'bold 12px Arial';
ctx.fillText("X", canvas.width - 29, 30);

ctx.fillStyle = '#dfdfdf';
ctx.fillRect(canvas.width - 32, 38, 18, canvas.height - 76);
ctx.fillStyle = '#c0c0c0';
ctx.fillRect(canvas.width - 32, 38, 18, 18);
ctx.fillRect(canvas.width - 32, canvas.height - 56, 18, 18);
let handleY = 56 + ((Math.sin(time*0.5)+1)/2) * (canvas.height - 150);
ctx.fillRect(canvas.width - 32, handleY, 18, 40);
ctx.strokeStyle = '#ffffff';
ctx.beginPath(); ctx.moveTo(canvas.width-32, handleY+40); ctx.lineTo(canvas.width-32, handleY); ctx.lineTo(canvas.width-14, handleY); ctx.stroke();
ctx.strokeStyle = '#808080';
ctx.beginPath(); ctx.moveTo(canvas.width-14, handleY); ctx.lineTo(canvas.width-14, handleY+40); ctx.lineTo(canvas.width-32, handleY+40); ctx.stroke();

ctx.fillStyle = '#00ff00';
ctx.font = '12px "Courier New", monospace';
let diagnostics = [
    `ASTRAL_OS.exe v0.9.4`,
    `TIME_CYCLE: ${time.toFixed(4)}`,
    `SIGNAL_DENSITY: ${(Math.random()*100).toFixed(1)}%`,
    `WHORL_SYNC: ${mouse.isPressed ? 'FAILED' : 'STABLE'}`,
    `CHROMA_DRIFT: ACTIVE`,
    `POS: [X:${mouse.x}, Y:${mouse.y}]`,
    `STATUS: ${Math.random() > 0.95 ? 'CURSED_SHITPOST :-)' : 'ONLINE'}`
];
diagnostics.forEach((text, idx) => {
    if (Math.random() < 0.05) text = text.replace(/[A-Z]/g, () => String.fromCharCode(65 + Math.random()*26));
    ctx.fillText(text, 25, 60 + idx * 16);
});

ctx.beginPath();
for(let w=0; w<120; w++) {
    let wy = 180 + (Math.random() * 20 - 10) * (mouse.isPressed ? 3 : 1);
    if(w===0) ctx.moveTo(25, wy);
    else ctx.lineTo(25 + w, wy);
}
ctx.strokeStyle = '#00ff00';
ctx.lineWidth = 1;
ctx.stroke();

ctx.fillStyle = '#c0c0c0';
ctx.fillRect(14, canvas.height - 38, canvas.width - 46, 24);
ctx.fillStyle = '#000000';
ctx.font = '14px "Courier New", monospace';
let customText = input ? `*** ${input.toUpperCase()} *** ` : '';
let marqueeText = customText + "*** WELCOME TO ASTRAL_OS *** DOWNLOADING SHADOW_STRAND_ARCHITECTURE.JSON *** BEWARE OF CHROMA LUMA FAILURES *** MYSPACE.COM/ASTRAL_OS *** ";
let tWidth = marqueeText.length * 8.4; 
let scrollPos = (time * 120) % tWidth;
ctx.save();
ctx.beginPath();
ctx.rect(14, canvas.height - 38, canvas.width - 46, 24);
ctx.clip();
ctx.fillText(marqueeText + marqueeText, 18 - scrollPos, canvas.height - 22);
ctx.restore();

if (mouse.isPressed) {
    let mx = Math.min(mouse.x, canvas.width - 260);
    let my = Math.min(mouse.y, canvas.height - 130);
    
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(mx, my, 250, 120);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(mx, my+120); ctx.lineTo(mx, my); ctx.lineTo(mx+250, my); ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(mx+250, my); ctx.lineTo(mx+250, my+120); ctx.lineTo(mx, my+120); ctx.stroke();
    
    ctx.fillStyle = '#000080';
    ctx.fillRect(mx+3, my+3, 244, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "MS Sans Serif"';
    ctx.fillText('Fatal Exception 0xANU', mx + 8, my + 17);
    
    ctx.fillStyle = '#000000';
    ctx.font = '12px "MS Sans Serif"';
    ctx.fillText('Chroma Luma Failure.', mx + 20, my + 50);
    ctx.fillText('Astral plane unreachable.', mx + 20, my + 65);
    ctx.fillText('Kernel panic in shadow_strand.', mx + 20, my + 80);
    
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(mx + 95, my + 90, 60, 22);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(mx+95, my+112); ctx.lineTo(mx+95, my+90); ctx.lineTo(mx+155, my+90); ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.beginPath(); ctx.moveTo(mx+155, my+90); ctx.lineTo(mx+155, my+112); ctx.lineTo(mx+95, my+112); ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.fillText('OK', mx + 115, my + 105);
}

ctx.fillStyle = '#ffffff';
ctx.strokeStyle = '#000000';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(mouse.x, mouse.y);
ctx.lineTo(mouse.x + 15, mouse.y + 15);
ctx.lineTo(mouse.x + 9, mouse.y + 15);
ctx.lineTo(mouse.x + 13, mouse.y + 23);
ctx.lineTo(mouse.x + 9, mouse.y + 24);
ctx.lineTo(mouse.x + 5, mouse.y + 16);
ctx.lineTo(mouse.x, mouse.y + 21);
ctx.closePath();
ctx.fill();
ctx.stroke();