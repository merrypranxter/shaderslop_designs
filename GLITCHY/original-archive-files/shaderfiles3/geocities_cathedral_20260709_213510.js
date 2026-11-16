try {
    if (!ctx) throw new Error("Context not provided");

    if (!canvas.__three_cathedral) {
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        const targetOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        const targetA = new THREE.WebGLRenderTarget(grid.width, grid.height, targetOptions);
        const targetB = new THREE.WebGLRenderTarget(grid.width, grid.height, targetOptions);

        const simVertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const simFragmentShader = `
            precision highp float;
            uniform sampler2D u_state;
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform vec2 u_mouse;
            uniform float u_seed;
            
            in vec2 vUv;
            out vec4 fragColor;

            // Feral math utilities
            float hash12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed) * 43758.5453); }
            float hash11(float n) { return fract(sin(n) * 43758.5453); }

            // Procedural UI / Web 1.0 Ghost Generator
            float webGhost(vec2 p) {
                vec2 g = fract(p * 5.0 + u_time * 0.2);
                vec2 id = floor(p * 5.0 + u_time * 0.2);
                float active = step(0.8, hash12(id + floor(u_time * 0.5)));
                
                // Beveled window illusion
                float bevel = step(0.9, g.x) + step(0.9, g.y) + step(g.x, 0.1) + step(g.y, 0.1);
                // Scrolling text blocks
                float text = step(0.7, sin(g.y * 40.0)) * step(0.2, g.x) * step(g.x, 0.8) * step(0.3, g.y);
                
                return clamp(bevel + text, 0.0, 1.0) * active;
            }

            void main() {
                vec2 texel = 1.0 / u_resolution;
                vec4 state = texture(u_state, vUv);

                // --- LAYER B: LIVING MATH ENGINE ---
                // 1. Lenia-like Soft Life (R Channel)
                float u = 0.0;
                float wSum = 0.0;
                float radius = 4.0;
                for(float r = 1.0; r <= 3.0; r += 1.0) {
                    for(float a = 0.0; a < 6.28318; a += 0.78539) {
                        vec2 offset = vec2(cos(a), sin(a)) * texel * r * radius;
                        u += texture(u_state, vUv + offset).r;
                        wSum += 1.0;
                    }
                }
                u /= wSum;
                
                // Growth function (bump)
                float mu = 0.22;
                float sigma = 0.02;
                float growth = 2.0 * exp(-pow(u - mu, 2.0) / (2.0 * sigma * sigma)) - 1.0;
                float nextR = clamp(state.r + 0.1 * growth, 0.0, 1.0);

                // 2. Abelian Sandpile (G Channel)
                float nG = texture(u_state, vUv + vec2(0.0, texel.y)).g;
                float sG = texture(u_state, vUv - vec2(0.0, texel.y)).g;
                float eG = texture(u_state, vUv + vec2(texel.x, 0.0)).g;
                float wG = texture(u_state, vUv - vec2(texel.x, 0.0)).g;
                
                float topples = step(0.8, state.g);
                float inflows = step(0.8, nG) + step(0.8, sG) + step(0.8, eG) + step(0.8, wG);
                
                float nextG = state.g - topples * 0.8 + inflows * 0.2;
                nextG += 0.005; // Constant rain

                // 3. Afterimage Persistence / Shoegaze Trails (B Channel)
                // Decays slowly, gets excited by R and G
                float nextB = max(state.b * 0.94, max(state.r, topples));

                // 4. Web 1.0 UI Ghosts (A Channel)
                float ghost = webGhost(vUv);
                float nextA = clamp(state.a * 0.85 + ghost * 0.2, 0.0, 1.0);

                // --- INTERACTION: The Magnetic Lens ---
                float dist = length(vUv - u_mouse);
                if (u_mouse.x > 0.0 && u_mouse.y > 0.0 && dist < 0.08) {
                    float magnet = exp(-dist * 40.0);
                    nextR = min(nextR + magnet * 0.5, 1.0);
                    nextG = min(nextG + magnet * 0.8, 1.0);
                    nextB = 1.0; // Instant burn-in
                }

                // Entropy corruption injection
                if (hash12(vUv + u_time) > 0.999) {
                    nextR = hash12(vUv);
                    nextG = hash12(vUv + 1.0);
                }

                fragColor = vec4(nextR, clamp(nextG, 0.0, 1.0), nextB, nextA);
            }
        `;

        const renderFragmentShader = `
            precision highp float;
            uniform sampler2D u_state;
            uniform vec2 u_resolution;
            uniform float u_time;
            
            in vec2 vUv;
            out vec4 fragColor;

            float hash(float n) { return fract(sin(n) * 43758.5453); }
            float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

            // Layer A: Moiré Interference & Rainbow Optics
            vec3 cathedralBackground(vec2 p) {
                vec2 center = p * 2.0 - 1.0;
                center.x *= u_resolution.x / u_resolution.y;
                
                float r = length(center);
                float theta = atan(center.y, center.x);
                
                // Moiré lattices
                float g1 = sin(r * 80.0 - u_time * 3.0);
                float g2 = sin(r * 78.0 + theta * 6.0 + u_time * 2.0);
                float interference = g1 * g2;
                
                // Rainbow Optics
                vec3 phase = vec3(0.0, 2.09, 4.18); // RGB phase shifts
                vec3 rainbow = 0.5 + 0.5 * cos(u_time * 0.5 + r * 5.0 + theta * 2.0 + phase + interference);
                
                // Deepen the background (Phosphor Noir / Shoegaze depth)
                return rainbow * 0.25 * smoothstep(0.0, 1.5, r + 0.5);
            }

            void main() {
                vec2 uv = vUv;

                // --- LAYER D: VHS / GLITCHCORE ENVELOPE ---
                // Tracking tear
                float tear = step(0.98, hash(floor(uv.y * 24.0) + floor(u_time * 8.0)));
                uv.x += tear * (hash2(uv) - 0.5) * 0.08;
                
                // Barrel Distortion
                vec2 crtUv = uv * 2.0 - 1.0;
                crtUv *= 1.0 + dot(crtUv, crtUv) * 0.12;
                crtUv = crtUv * 0.5 + 0.5;

                if (crtUv.x < 0.0 || crtUv.x > 1.0 || crtUv.y < 0.0 || crtUv.y > 1.0) {
                    fragColor = vec4(0.02, 0.01, 0.03, 1.0); // off-screen glass
                    return;
                }

                // Chromatic Aberration (Anaglyph Stereo)
                float ca = 0.004 + tear * 0.015;
                vec4 sR = texture(u_state, crtUv + vec2(ca, 0.0));
                vec4 sC = texture(u_state, crtUv);
                vec4 sB = texture(u_state, crtUv - vec2(ca, 0.0));

                vec4 state = vec4(sR.r, sC.g, sB.b, sC.a);

                // --- LAYER A: SIGNAL CATHEDRAL ---
                vec3 bg = cathedralBackground(crtUv);

                // --- LAYER B: LIVING MATH ENGINE ---
                // R: Lenia (Hot Pink / Magenta)
                vec3 lenia = mix(vec3(0.0), vec3(1.0, 0.1, 0.6), state.r);
                
                // G: Sandpile (Acid Green / Cyan threshold flashes)
                vec3 sandpile = mix(vec3(0.0), vec3(0.1, 1.0, 0.5), step(0.7, state.g));
                
                // B: Afterimage / Ghost Trails (Ultraviolet / Electric Blue)
                vec3 ghost = vec3(0.3, 0.0, 1.0) * state.b;

                // --- LAYER C: INTERFACE GHOSTS ---
                // A: UI Fragments (Iridescent / White Bloom)
                vec3 ui = vec3(0.9, 0.9, 1.0) * state.a;
                // Add some "data rot" color shifting to UI
                ui += vec3(state.a * sin(u_time * 5.0), state.a * cos(u_time * 4.0), 0.0) * 0.5;

                // Composite
                vec3 col = bg + lenia + sandpile + ghost + ui;

                // --- LAYER D: POST-PROCESSING (Shoegaze + CRT) ---
                // Bloom / Halation
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                col += col * smoothstep(0.5, 1.0, luma) * 0.6; // Soft glow

                // Phosphor triad subpixels
                float phosX = mod(gl_FragCoord.x, 3.0);
                vec3 triad = vec3(
                    step(phosX, 1.0),
                    step(1.0, phosX) * step(phosX, 2.0),
                    step(2.0, phosX)
                );
                col *= mix(vec3(1.0), triad * 2.5, 0.25); // Subtle RGB screen mask

                // Scanlines
                float scanline = 0.9 + 0.1 * sin(crtUv.y * u_resolution.y * 3.1415);
                col *= scanline;

                // Vignette
                float vig = length(crtUv - 0.5);
                col *= 1.0 - vig * vig * 0.8;

                // Contrast push
                col = pow(max(col, 0.0), vec3(1.1));

                fragColor = vec4(col, 1.0);
            }
        `;

        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(-1, -1) },
                u_seed: { value: Math.random() * 100.0 }
            },
            vertexShader: simVertexShader,
            fragmentShader: simFragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const renderMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 }
            },
            vertexShader: simVertexShader,
            fragmentShader: renderFragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const simScene = new THREE.Scene();
        simScene.add(new THREE.Mesh(geometry, simMaterial));

        const renderScene = new THREE.Scene();
        renderScene.add(new THREE.Mesh(geometry, renderMaterial));

        canvas.__three_cathedral = {
            renderer,
            camera,
            simScene,
            renderScene,
            simMaterial,
            renderMaterial,
            targetA,
            targetB,
            pingPong: 0,
            width: grid.width,
            height: grid.height
        };
    }

    const state = canvas.__three_cathedral;

    // Handle resize
    if (state.width !== grid.width || state.height !== grid.height) {
        state.width = grid.width;
        state.height = grid.height;
        state.targetA.setSize(grid.width, grid.height);
        state.targetB.setSize(grid.width, grid.height);
        state.simMaterial.uniforms.u_resolution.value.set(grid.width, grid.height);
        state.renderMaterial.uniforms.u_resolution.value.set(grid.width, grid.height);
        state.renderer.setSize(grid.width, grid.height, false);
    }

    // Update Uniforms
    state.simMaterial.uniforms.u_time.value = time;
    state.renderMaterial.uniforms.u_time.value = time;
    
    // Seed variation from input string to inject "Genome Splicing"
    let inputSeed = 0;
    for(let i=0; i<input.length; i++) inputSeed += input.charCodeAt(i);
    state.simMaterial.uniforms.u_seed.value = (inputSeed % 1000) * 0.1 + Math.sin(time*0.01);

    if (mouse.isPressed) {
        state.simMaterial.uniforms.u_mouse.value.set(
            mouse.x / grid.width,
            1.0 - (mouse.y / grid.height)
        );
    } else {
        state.simMaterial.uniforms.u_mouse.value.set(-1.0, -1.0);
    }

    // Ping-Pong Simulation Loop
    const readTarget = state.pingPong === 0 ? state.targetA : state.targetB;
    const writeTarget = state.pingPong === 0 ? state.targetB : state.targetA;

    // 1. Run Simulation
    state.simMaterial.uniforms.u_state.value = readTarget.texture;
    state.renderer.setRenderTarget(writeTarget);
    state.renderer.render(state.simScene, state.camera);

    // 2. Render to Screen
    state.renderMaterial.uniforms.u_state.value = writeTarget.texture;
    state.renderer.setRenderTarget(null);
    state.renderer.render(state.renderScene, state.camera);

    // Swap buffers
    state.pingPong = 1 - state.pingPong;

} catch (e) {
    console.error("GeoCities Cathedral of Noise failed to initialize:", e);
    throw e;
}