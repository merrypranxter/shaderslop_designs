if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Canvas 2D for generating Myspace / Early Internet UI fragments
        const texCanvas = document.createElement('canvas');
        texCanvas.width = 1024;
        texCanvas.height = 1024;
        const uiTexture = new THREE.CanvasTexture(texCanvas);
        uiTexture.minFilter = THREE.NearestFilter; // Preserve crusty pixelation
        uiTexture.magFilter = THREE.NearestFilter;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2() },
                u_uiTex: { value: uiTexture }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                in vec2 vUv;
                out vec4 fragColor;

                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_mouse;
                uniform sampler2D u_uiTex;

                // Hash and Noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float blockNoise(vec2 p) {
                    vec2 id = floor(p);
                    return hash(id);
                }

                // Op Art Zeno Tunnel Pattern
                float opPattern(vec2 p, float t, float offset) {
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    
                    // Log-polar transform for infinite descent
                    float logR = log(r + 0.0001);
                    float z = logR * 10.0 - t * 5.0 + offset;
                    float angle = a * 8.0 + sin(logR * 2.0 - t * 1.5);
                    
                    // Checkerboard / Wave interference
                    float val = sin(z) * cos(angle);
                    return step(0.0, val);
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;
                    
                    float t = u_time;

                    // Mouse interaction
                    vec2 mUV = uv - u_mouse * 0.5;

                    // 1. Datamosh & Glitch Displacement
                    float moshStr = step(0.85, blockNoise(vUv * vec2(15.0, 60.0) + t * 2.0));
                    vec2 glitchUV = mUV + moshStr * 0.08 * vec2(sin(t * 12.0), cos(t * 17.0));
                    
                    // Horizontal scanline tear
                    float tear = step(0.98, sin(vUv.y * 120.0 + t * 40.0));
                    glitchUV.x += tear * 0.15 * sin(t * 60.0);

                    // 2. Op Art Background with RGB Split (Chromatic Aberration)
                    float opR = opPattern(glitchUV, t, 0.0);
                    float opG = opPattern(glitchUV * 1.02, t, 0.1);
                    float opB = opPattern(glitchUV * 1.05, t, 0.2);
                    vec3 bgCol = vec3(opR, opG, opB);

                    // Moiré Phase Interference
                    float moire = opPattern(glitchUV * 0.85, -t * 0.6, 0.0);
                    bgCol = mix(bgCol, vec3(1.0 - bgCol), moire * 0.5);

                    // 3. UI Texture Overlay (Myspace / Web 1.0 elements)
                    vec2 uiUV = vUv;
                    uiUV.x += tear * 0.05; // UI gets affected by the tear
                    
                    // RGB split for UI to simulate bad connection/CRT bleed
                    vec4 uiR = texture(u_uiTex, uiUV + vec2(0.005, 0.0));
                    vec4 uiG = texture(u_uiTex, uiUV);
                    vec4 uiB = texture(u_uiTex, uiUV - vec2(0.005, 0.0));
                    vec4 uiCol = vec4(uiR.r, uiG.g, uiB.b, uiG.a); 

                    // 4. Acid / Toxic Colorization (Hot Pink, Cyan, Lime)
                    vec3 acidPink = vec3(1.0, 0.0, 0.8);
                    vec3 acidCyan = vec3(0.0, 1.0, 1.0);
                    vec3 acidLime = vec3(0.2, 1.0, 0.0);
                    
                    float tintMix = sin(log(length(glitchUV) + 0.001) * 2.0 - t * 2.0) * 0.5 + 0.5;
                    vec3 tintCol = mix(mix(acidPink, acidCyan, tintMix), acidLime, moire);
                    
                    // Apply toxic colors to the bright parts of the Op Art
                    float bgLuma = dot(bgCol, vec3(0.299, 0.587, 0.114));
                    bgCol = mix(bgCol, bgCol * tintCol * 2.5, smoothstep(0.3, 0.8, bgLuma));

                    // 5. Glitter / Noise
                    float noise = hash(vUv * 600.0 + t);
                    float glitterMask = step(0.92, noise) * step(0.4, bgLuma);
                    bgCol = mix(bgCol, vec3(1.0), glitterMask); // White/Silver sparkles

                    // 6. Combine Background and UI
                    vec3 finalCol = mix(bgCol, uiCol.rgb, uiCol.a * 0.95);

                    // 7. Extreme Glitch Inversion
                    float invertMask = step(0.96, blockNoise(vUv * vec2(4.0, 12.0) - t * 3.0));
                    finalCol = mix(finalCol, 1.0 - finalCol, invertMask);

                    // 8. CRT Scanlines & Vignette
                    float scanline = sin(vUv.y * u_resolution.y * 3.14159) * 0.06;
                    finalCol -= scanline;
                    
                    float vig = length(vUv - 0.5) * 2.0;
                    finalCol *= 1.0 - smoothstep(0.8, 1.6, vig);

                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material, texCanvas, uiTexture, lastUpdateTick: -1 };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const state = canvas.__three;
const { renderer, scene, camera, material, texCanvas, uiTexture } = state;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth mouse interpolation
    const mx = mouse.x / grid.width - 0.5;
    const my = -(mouse.y / grid.height - 0.5);
    material.uniforms.u_mouse.value.lerp(new THREE.Vector2(mx, my), 0.1);
}

// Generate the "Myspace / Early Internet" UI Texture dynamically
// Update at ~6 FPS to simulate laggy browser/gif behavior
const updateTick = Math.floor(time * 6);
if (state.lastUpdateTick !== updateTick) {
    state.lastUpdateTick = updateTick;
    const tctx = texCanvas.getContext('2d');
    
    // Clear canvas often to reset clutter, but sometimes let it build up
    if (Math.random() > 0.2) {
        tctx.clearRect(0, 0, 1024, 1024);
    }
    
    // Draw Windows 98 style Error Popups
    if (Math.random() > 0.4) {
        const numPopups = Math.floor(Math.random() * 4);
        for (let i = 0; i < numPopups; i++) {
            let x = Math.random() * 800;
            let y = Math.random() * 800;
            
            // Window body
            tctx.fillStyle = '#c0c0c0';
            tctx.fillRect(x, y, 240, 110);
            
            // Title bar
            tctx.fillStyle = '#0000aa';
            tctx.fillRect(x + 2, y + 2, 236, 22);
            
            // Title text
            tctx.fillStyle = '#ffffff';
            tctx.font = 'bold 14px monospace';
            tctx.fillText("System Error", x + 6, y + 17);
            
            // Message text
            tctx.fillStyle = '#000000';
            const msgs = ["rawr xD", "A FATAL EXCEPTION 0E", "~*~sPaRkLeS~*~", "top 8", "<3 <3 <3", "404 SOUL NOT FOUND", "xX_dArK_aNgEl_Xx"];
            tctx.fillText(msgs[Math.floor(Math.random() * msgs.length)], x + 15, y + 55);
            
            // OK Button
            tctx.fillStyle = '#dfdfdf';
            tctx.fillRect(x + 90, y + 75, 60, 22);
            tctx.strokeStyle = '#000000';
            tctx.lineWidth = 1.5;
            tctx.strokeRect(x + 90, y + 75, 60, 22);
            tctx.fillStyle = '#000000';
            tctx.fillText("OK", x + 110, y + 90);
        }
    }
    
    // Floating toxic/acid symbols
    tctx.font = '36px serif';
    for (let i = 0; i < 25; i++) {
        tctx.fillStyle = Math.random() > 0.5 ? '#ff00ff' : '#00ffff';
        tctx.fillText(Math.random() > 0.5 ? "★" : "♥", Math.random() * 1024, Math.random() * 1024);
    }
    
    // Fake lagging cursor trail
    tctx.fillStyle = '#ffffff';
    tctx.strokeStyle = '#000000';
    tctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const cx = (Math.sin(time - i * 0.15) * 0.4 + 0.5) * 1024;
        const cy = (Math.cos((time - i * 0.15) * 1.3) * 0.4 + 0.5) * 1024;
        tctx.beginPath();
        tctx.moveTo(cx, cy);
        tctx.lineTo(cx + 24, cy + 24);
        tctx.lineTo(cx + 9, cy + 24);
        tctx.lineTo(cx, cy + 38);
        tctx.closePath();
        tctx.fill();
        tctx.stroke();
    }
    
    uiTexture.needsUpdate = true;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);