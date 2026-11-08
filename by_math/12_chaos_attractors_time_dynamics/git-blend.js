// [FERAL DESIGN-BRAIN: ENGAGED]
// [MECHANISM]: Iterative Dither-Collapse. 
// A chaotic 2.5D strange attractor (Clifford variant) is forced into a rigid, 
// bureaucratic isometric voxel grid. The continuous math "infects" the discrete 
// space like fungal growth. As density accumulates, it triggers "Bayer thresholding" 
// (Repo 1) and "escape-time caustic ripples" (Repo 2). 
// The system degrades into Gameboy DMG palette memory-failure when the mouse is pressed.

(function() {
    // Persist state across frames by attaching to the canvas
    if (!canvas.__feral_voxel_attractor) {
        canvas.__feral_voxel_attractor = {
            agents: [],
            grid: new Map(), // Spatial hash for voxel density
            params: { a: 1.5, b: -1.5, c: 1.0, d: 0.5 },
            targetParams: { a: 1.5, b: -1.5, c: 1.0, d: 0.5 },
            bayer: [ // Bayer 4x4 matrix for ditherpunk quantization
                0, 8, 2, 10,
                12, 4, 14, 6,
                3, 11, 1, 9,
                15, 7, 13, 5
            ]
        };

        // Initialize attractor agents (The "Infection")
        for (let i = 0; i < 2000; i++) {
            canvas.__feral_voxel_attractor.agents.push({
                x: (Math.random() - 0.5) * 4,
                y: (Math.random() - 0.5) * 4,
                z: 0
            });
        }
    }

    const state = canvas.__feral_voxel_attractor;
    
    // --- PALETTES (Extracted from pixel_voxel & mutated) ---
    // ENDESGA/Apollo Hybrid (Normal state: Fungal / Complex Dynamics)
    const palNormal = [
        { top: '#a7f070', left: '#38b764', right: '#257179', wire: '#73eff7' }, // High density
        { top: '#ffcd75', left: '#ef7d57', right: '#b13e53', wire: '#ffcd75' }, // Mid density
        { top: '#3b5dc9', left: '#29366f', right: '#1a1c2c', wire: '#41a6f6' }, // Low density
        { top: '#566c86', left: '#333c57', right: '#1a1c2c', wire: '#94b0c2' }  // Void
    ];

    // Gameboy DMG-001 (Pressed state: Hardware constraint / Bureaucratic failure)
    const palDMG = [
        { top: '#9bbc0f', left: '#8bac0f', right: '#306230', wire: '#9bbc0f' },
        { top: '#8bac0f', left: '#306230', right: '#0f380f', wire: '#9bbc0f' },
        { top: '#306230', left: '#0f380f', right: '#050505', wire: '#8bac0f' },
        { top: '#0f380f', left: '#050505', right: '#000000', wire: '#306230' }
    ];

    const activePal = mouse.isPressed ? palDMG : palNormal;

    // --- GEOMETRY & PROJECTION ---
    const VOXEL_W = 16;
    const VOXEL_H = 8;
    const VOXEL_Z = 12;
    const SCALE = 12; // Attractor to grid scale

    // Isometric projection function
    function project(gx, gy, gz) {
        const sx = (gx - gy) * (VOXEL_W / 2) + grid.width / 2;
        const sy = (gx + gy) * (VOXEL_H / 2) - (gz * VOXEL_Z) + grid.height / 2;
        return { x: sx, y: sy, depth: gx + gy + gz };
    }

    function drawCube(ctx, sx, sy, colors, scale = 1, wireframe = false) {
        const w = (VOXEL_W / 2) * scale;
        const h = (VOXEL_H / 2) * scale;
        const z = VOXEL_Z * scale;

        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';

        if (wireframe) {
            ctx.strokeStyle = colors.wire;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + w, sy + h);
            ctx.lineTo(sx, sy + h * 2);
            ctx.lineTo(sx - w, sy + h);
            ctx.closePath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx, sy - z);
            ctx.lineTo(sx + w, sy + h - z);
            ctx.lineTo(sx, sy + h * 2 - z);
            ctx.lineTo(sx - w, sy + h - z);
            ctx.closePath();
            ctx.stroke();
            return;
        }

        // Top face
        ctx.fillStyle = colors.top;
        ctx.beginPath();
        ctx.moveTo(sx, sy - z);
        ctx.lineTo(sx + w, sy + h - z);
        ctx.lineTo(sx, sy + h * 2 - z);
        ctx.lineTo(sx - w, sy + h - z);
        ctx.closePath();
        ctx.fill();

        // Right face
        ctx.fillStyle = colors.right;
        ctx.beginPath();
        ctx.moveTo(sx, sy + h * 2 - z);
        ctx.lineTo(sx + w, sy + h - z);
        ctx.lineTo(sx + w, sy + h);
        ctx.lineTo(sx, sy + h * 2);
        ctx.closePath();
        ctx.fill();

        // Left face
        ctx.fillStyle = colors.left;
        ctx.beginPath();
        ctx.moveTo(sx, sy + h * 2 - z);
        ctx.lineTo(sx - w, sy + h - z);
        ctx.lineTo(sx - w, sy + h);
        ctx.lineTo(sx, sy + h * 2);
        ctx.closePath();
        ctx.fill();
    }

    // --- UPDATE STRANGE ATTRACTOR (The Math Traits) ---
    // Warp parameters based on mouse to explore the "parameter space" and "bifurcations"
    if (mouse.x !== 0 && mouse.y !== 0) {
        state.targetParams.a = (mouse.x / grid.width) * 4 - 2;
        state.targetParams.b = (mouse.y / grid.height) * 4 - 2;
        if (mouse.isPressed) {
            // Induce chaos / structural breakdown
            state.targetParams.c = Math.sin(time * 5) * 2;
            state.targetParams.d = Math.cos(time * 3) * 2;
        }
    }

    // Smoothly interpolate parameters (machine hesitation)
    state.params.a += (state.targetParams.a - state.params.a) * 0.05;
    state.params.b += (state.targetParams.b - state.params.b) * 0.05;
    state.params.c += (state.targetParams.c - state.params.c) * 0.01;
    state.params.d += (state.targetParams.d - state.params.d) * 0.01;

    const { a, b, c, d } = state.params;

    // Decay the voxel grid (Bureaucratic memory loss)
    for (const [key, voxel] of state.grid.entries()) {
        voxel.density *= mouse.isPressed ? 0.8 : 0.92; // Decay faster when pressed
        if (voxel.density < 0.1) {
            state.grid.delete(key);
        }
    }

    // Step agents through the Clifford-variant attractor
    const timeOffset = time * 0.5;
    for (let i = 0; i < state.agents.length; i++) {
        let p = state.agents[i];
        
        // Clifford attractor equations
        let nx = Math.sin(a * p.y) + c * Math.cos(a * p.x);
        let ny = Math.sin(b * p.x) + d * Math.cos(b * p.y);
        
        // Z is a harmonic fold of the 2D plane (creating overlapping manifolds)
        let nz = Math.sin(nx * ny * 2.0 + timeOffset) * 1.5;

        p.x = nx;
        p.y = ny;
        p.z = nz;

        // "Pixelate Grid Lock" (Repo 1) - Quantize continuous math into discrete bins
        let gx = Math.floor(p.x * SCALE);
        let gy = Math.floor(p.y * SCALE);
        let gz = Math.floor(p.z * SCALE * 0.5); // Compress Z slightly

        // Domain warping / glitch
        if (mouse.isPressed && Math.random() > 0.95) {
            gz += Math.floor(Math.random() * 3) - 1; 
        }

        let key = `${gx},${gy},${gz}`;
        if (!state.grid.has(key)) {
            state.grid.set(key, { gx, gy, gz, density: 0, age: time });
        }
        
        let voxel = state.grid.get(key);
        voxel.density = Math.min(voxel.density + 0.5, 4.0); // Cap density
    }

    // --- RENDER PIPELINE ---
    // Clear with a heavy, dark trail (Motion blur / Smear animation)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mouse.isPressed ? 'rgba(15, 56, 15, 0.4)' : 'rgba(5, 5, 5, 0.3)';
    ctx.fillRect(0, 0, grid.width, grid.height);

    // Collect and sort voxels (Painter's Algorithm for Isometric)
    let renderList = Array.from(state.grid.values());
    renderList.forEach(v => {
        let proj = project(v.gx, v.gy, v.gz);
        v.sx = proj.x;
        v.sy = proj.y;
        v.depth = proj.depth;
    });

    // Sort back-to-front
    renderList.sort((A, B) => A.depth - B.depth);

    // Draw voxels
    for (let i = 0; i < renderList.length; i++) {
        let v = renderList[i];
        
        // Bayer Dithering Logic (Repo 1: ordered_dither)
        // Apply spatial thresholding to the continuous density value
        let bx = Math.abs(v.gx) % 4;
        let by = Math.abs(v.gy) % 4;
        let bayerVal = state.bayer[by * 4 + bx] / 16.0;
        
        // Calculate palette index based on density and dither threshold
        let palIndex = 3 - Math.floor(v.density);
        if (v.density % 1 < bayerVal) {
            palIndex = Math.min(3, palIndex + 1);
        }
        palIndex = Math.max(0, Math.min(3, palIndex));

        let colors = activePal[palIndex];

        // Draw solid voxel
        drawCube(ctx, v.sx, v.sy, colors, 1.0);

        // "Fractal Light Effects" (Repo 2) - High density voxels emit caustic wireframes
        if (v.density > 3.0 && !mouse.isPressed) {
            let pulse = (time - v.age) * 2.0;
            let scale = 1.0 + (pulse % 1.5);
            ctx.globalAlpha = Math.max(0, 1.0 - (pulse % 1.5));
            ctx.globalCompositeOperation = 'screen';
            drawCube(ctx, v.sx, v.sy - (Math.sin(time*5 + v.gx)*10), colors, scale, true);
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // --- POST-PROCESS OVERLAY (Scanlines & Noise) ---
    // Simulating the physical medium of the retro aesthetic
    ctx.fillStyle = activePal[0].top;
    ctx.globalAlpha = 0.03;
    for (let y = 0; y < grid.height; y += 4) {
        ctx.fillRect(0, y, grid.width, 2);
    }
    ctx.globalAlpha = 1.0;

    // Feral UI Element: Display current attractor metrics
    ctx.fillStyle = activePal[0].wire;
    ctx.font = '10px monospace';
    ctx.fillText(`SYS.DIM: ${a.toFixed(3)}, ${b.toFixed(3)}`, 20, 30);
    ctx.fillText(`VOX.COUNT: ${renderList.length}`, 20, 45);
    ctx.fillText(`MODE: ${mouse.isPressed ? 'DMG_COLLAPSE' : 'COMPLEX_DYNAMICS'}`, 20, 60);

})();