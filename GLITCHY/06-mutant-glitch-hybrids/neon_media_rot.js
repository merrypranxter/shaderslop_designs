try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        // Use FloatType for the Lenia simulation to maintain continuous state precision
        const rtOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const plane = new THREE.PlaneGeometry(2, 2);

        // --- PASS 1: LENIA INFECTION ENGINE ---
        // A continuous cellular automaton acting as the biological foundation of the glitch.
        const leniaMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 }
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
                uniform sampler2D u_state;
                uniform vec2 u_res;
                uniform float u_time;
                in vec2 vUv;
                out vec4 fragColor;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec2 uv = vUv;
                    float state = texture(u_state, uv).r;

                    // Multi-kernel sampling ring (simplified for performance)
                    float sum = 0.0;
                    float wSum = 0.0;
                    float R = 12.0 + sin(u_time * 0.5) * 4.0; // Breathing kernel radius
                    
                    for(float a = 0.0; a < 6.283; a += 0.392) {
                        vec2 offset = vec2(cos(a), sin(a)) * (R / u_res);
                        sum += texture(u_state, fract(uv + offset)).r;
                        wSum += 1.0;
                    }
                    float avg = sum / wSum;

                    // Lenia Growth Function (Activator-Inhibitor bump)
                    float mu = 0.15;
                    float sigma = 0.017;
                    float growth = 2.0 * exp(-pow(avg - mu, 2.0) / (2.0 * sigma * sigma)) - 1.0;

                    // Continuous update
                    float dt = 0.1;
                    float nextState = clamp(state + dt * growth, 0.0, 1.0);

                    // Feral injection: Constant spontaneous generation to keep the infection alive
                    if (hash(uv + floor(u_time * 10.0)) < 0.002) {
                        nextState = 1.0;
                    }
                    
                    // Initial seed blast
                    if (u_time < 0.5 && hash(uv * 10.0) < 0.1) {
                        nextState = hash(uv);
                    }

                    fragColor = vec4(nextState, 0.0, 0.0, 1.0);
                }
            `
        });

        const leniaScene = new THREE.Scene();
        leniaScene.add(new THREE.Mesh(plane, leniaMat));

        // --- PASS 2: THE BROADCAST COMPOSITE ---
        // Competing media failure systems driven by the Lenia map and strictly palettized.
        const mainMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_lenia: { value: null }
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
                uniform float u_time;
                uniform vec2 u_res;
                uniform sampler2D u_lenia;
                in vec2 vUv;
                out vec4 fragColor;

                // --- STRICT PALETTE ENFORCEMENT ---
                // No black, no gray, no mud. Only feral neon.
                vec3 getStrictPalette(float t) {
                    t = fract(t);
                    int idx = int(t * 7.0);
                    if(idx == 0) return vec3(0.5, 0.0, 1.0); // Saturated Purple (Acts as "Shadow")
                    if(idx == 1) return vec3(1.0, 0.0, 0.5); // Hot Pink
                    if(idx == 2) return vec3(1.0, 0.6, 0.8); // Pastel Pink
                    if(idx == 3) return vec3(0.0, 1.0, 0.8); // Bright Teal
                    if(idx == 4) return vec3(0.0, 1.0, 0.0); // Neon Green
                    if(idx == 5) return vec3(1.0, 1.0, 0.0); // Electric Yellow
                    return vec3(1.0, 1.0, 1.0);              // White (Acts as "Highlight")
                }

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), f.x),
                               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
                }

                void main() {
                    vec2 uv = vUv;

                    // --- GLITCH STATE CONTROLLER ---
                    // Simplex-ish shifting dominance of different failure modes
                    float t_vhs   = smoothstep(0.2, 0.8, noise(vec2(u_time * 0.3, 0.0)));
                    float t_crt   = smoothstep(0.2, 0.8, noise(vec2(u_time * 0.4, 10.0)));
                    float t_digi  = smoothstep(0.2, 0.8, noise(vec2(u_time * 0.5, 20.0)));
                    float t_film  = smoothstep(0.2, 0.8, noise(vec2(u_time * 0.3, 30.0)));
                    float t_moire = smoothstep(0.2, 0.8, noise(vec2(u_time * 0.2, 40.0)));

                    // Normalize weights so they fight for screen space
                    float total = t_vhs + t_crt + t_digi + t_film + t_moire + 0.001;
                    t_vhs /= total; t_crt /= total; t_digi /= total; t_film /= total; t_moire /= total;

                    // Violent system spikes
                    float burst = step(0.96, hash(vec2(floor(u_time * 8.0), 0.0)));

                    // --- LENIA INFECTION DATA ---
                    float lenia = texture(u_lenia, uv).r;
                    vec2 lenia_grad = vec2(
                        texture(u_lenia, uv + vec2(2.0/u_res.x, 0.0)).r - texture(u_lenia, uv - vec2(2.0/u_res.x, 0.0)).r,
                        texture(u_lenia, uv + vec2(0.0, 2.0/u_res.y)).r - texture(u_lenia, uv - vec2(0.0, 2.0/u_res.y)).r
                    );

                    // --- SUBSYSTEM 1: DIGITAL DATAMOSH & COMPRESSION ---
                    vec2 grid = vec2(32.0, 32.0);
                    vec2 block_uv = floor(uv * grid) / grid;
                    float mosh_trigger = step(0.6, hash(block_uv + floor(u_time * 2.0)));
                    // Lenia gradient drives the datamosh smearing
                    vec2 uv_digi = mix(uv, block_uv + lenia_grad * 10.0, mosh_trigger * t_digi);

                    // --- SUBSYSTEM 2: VHS TRACKING TEAR ---
                    float tear_y = hash(vec2(0.0, floor(uv.y * 40.0 + u_time * 15.0)));
                    vec2 uv_vhs = uv + vec2(tear_y * 0.15 * t_vhs, 0.0);
                    if (burst > 0.0) uv_vhs.x += hash(vec2(uv.y * 5.0, u_time)) * 0.4;

                    // --- SUBSYSTEM 3: MOIRÉ / OP-ART MANIFOLD ---
                    vec2 uv_op = uv - 0.5;
                    float r = length(uv_op);
                    float theta = atan(uv_op.y, uv_op.x);
                    // Hyperbolic warp modulated by Lenia infection
                    r = r / (1.0 + r * 3.0 * lenia); 
                    vec2 uv_moire = vec2(r * cos(theta), r * sin(theta)) + 0.5;
                    float op_signal = sin(uv_moire.x * 80.0) * cos(uv_moire.y * 80.0);

                    // --- ROUTING UVs ---
                    vec2 final_uv = uv;
                    final_uv = mix(final_uv, uv_digi, t_digi);
                    final_uv = mix(final_uv, uv_vhs, t_vhs);

                    // --- SIGNAL ACCUMULATION ---
                    // We build a single scalar value from all competing systems, 
                    // which is then mapped strictly to the color palette.
                    float master_signal = 0.0;
                    
                    // Base texture from warped noise
                    master_signal += noise(final_uv * 10.0 + u_time) * 0.3;
                    
                    // Lenia organic structure
                    master_signal += lenia * 0.4;
                    
                    // Op-Art vibration
                    master_signal += op_signal * 0.3 * t_moire;
                    
                    // Digital macroblock noise
                    master_signal += noise(floor(final_uv * 16.0) + u_time) * 0.3 * t_digi;

                    // Shift signal rapidly during bursts
                    master_signal += burst * hash(uv);

                    // --- SUBSYSTEM 4: FILM DAMAGE (Hard Overrides) ---
                    float scratch = smoothstep(0.98, 1.0, hash(vec2(uv.x * 200.0, floor(u_time * 24.0))));
                    float dust = step(0.995, hash(uv + u_time * 1.3));
                    if (t_film > 0.2) {
                        if (scratch > 0.0) master_signal = 0.85; // Forces Electric Yellow / White
                        if (dust > 0.0) master_signal = 0.14;    // Forces Hot Pink
                    }

                    // --- SUBSYSTEM 5: CRT PHOSPHOR & SCANLINES (Hard Overrides) ---
                    float scanline = sin(uv.y * u_res.y * 3.1415) * 0.5 + 0.5;
                    float phosphor = sin(uv.x * u_res.x * 3.1415) * 0.5 + 0.5;
                    if (t_crt > 0.2) {
                        if (scanline < 0.4 || phosphor < 0.4) {
                            master_signal = 0.0; // Forces Saturated Purple (Our "Black")
                        }
                    }

                    // Map the accumulated chaotic signal strictly to the neon palette
                    vec3 final_color = getStrictPalette(master_signal * 2.0 + u_time * 0.1);

                    fragColor = vec4(final_color, 1.0);
                }
            `
        });

        const mainScene = new THREE.Scene();
        mainScene.add(new THREE.Mesh(plane, mainMat));

        canvas.__three = { renderer, camera, rtA, rtB, leniaScene, leniaMat, mainScene, mainMat, frame: 0 };
    }

    const t = canvas.__three;
    t.renderer.setSize(grid.width, grid.height, false);
    
    t.leniaMat.uniforms.u_res.value.set(grid.width, grid.height);
    t.mainMat.uniforms.u_res.value.set(grid.width, grid.height);
    
    t.leniaMat.uniforms.u_time.value = time;
    t.mainMat.uniforms.u_time.value = time;

    // Ping-pong buffer logic for the continuous cellular automaton
    const readRT = t.frame % 2 === 0 ? t.rtA : t.rtB;
    const writeRT = t.frame % 2 === 0 ? t.rtB : t.rtA;

    // Pass 1: Evolve the Lenia infection
    t.leniaMat.uniforms.u_state.value = readRT.texture;
    t.renderer.setRenderTarget(writeRT);
    t.renderer.render(t.leniaScene, t.camera);

    // Pass 2: Render the competing glitch broadcast to the screen
    t.mainMat.uniforms.u_lenia.value = writeRT.texture;
    t.renderer.setRenderTarget(null);
    t.renderer.render(t.mainScene, t.camera);

    t.frame++;

} catch (e) {
    console.error("Feral Broadcast Initialization Failed:", e);
}