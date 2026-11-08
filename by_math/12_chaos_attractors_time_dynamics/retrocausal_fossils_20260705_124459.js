try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: true });
        renderer.autoClear = false;

        const rtParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        };
        
        // Fallback to UnsignedByteType if HalfFloat is not supported
        if (!renderer.capabilities.isWebGL2 && !renderer.extensions.get('OES_texture_half_float')) {
            rtParams.type = THREE.UnsignedByteType;
        }

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtParams);
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtParams);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();

        const shaderMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_feedback: { value: null }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform sampler2D u_feedback;

                // --- Hashing & Noise ---
                float hash21(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                
                vec2 hash22(vec2 p) {
                    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.xx + p3.yz) * p3.zy);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p); 
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    float a = hash21(i); 
                    float b = hash21(i + vec2(1.0, 0.0));
                    float c = hash21(i + vec2(0.0, 1.0)); 
                    float d = hash21(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0, a = 0.5;
                    for(int i = 0; i < 4; i++) { 
                        v += a * noise(p); 
                        p *= 2.0; 
                        a *= 0.5; 
                    }
                    return v;
                }

                // --- Event Generator ---
                // Returns: pos.xy, t_event, is_false_cause
                vec4 getEvent(vec2 cell) {
                    if (cell.x == 100.0) { 
                        // Hero Event (Center)
                        return vec4(0.0, 0.0, 8.0, 0.0);
                    }
                    vec2 h = hash22(cell);
                    vec2 pos = (cell + h - 1.5) * 1.2; // Spread out grid
                    float t_event = h.x * 10.0;
                    float false_cause = h.y > 0.75 ? 1.0 : 0.0; // 25% chance of being a false cause
                    return vec4(pos, t_event, false_cause);
                }

                // --- Render Individual Explosion / Fossil ---
                vec3 renderEvent(vec4 evt, vec2 p, float seed) {
                    vec3 col = vec3(0.0);
                    vec2 pos = evt.xy;
                    float t_event = evt.z;
                    float is_false = evt.w;

                    // Temporal anticipation: wraps seamlessly over 10s loop
                    float dt = mod(u_time - t_event + 5.0, 10.0) - 5.0;
                    
                    vec2 d = p - pos;
                    float r = length(d);
                    float a = atan(d.y, d.x);

                    // 1. Fossil Scars (Echo-first anticipation)
                    // Appears before the event, peaks at 0, then vanishes
                    float scar_t = smoothstep(-3.5, -1.0, dt) * smoothstep(1.5, 0.0, dt);
                    if (scar_t > 0.0) {
                        float noise_val = fbm(vec2(a * 3.0, r * 10.0) + seed);
                        float ring = abs(r - 0.25 - 0.1 * noise_val);
                        float crack = abs(fbm(d * 12.0 + seed) - 0.5);

                        float scar = 0.002 / (ring + 0.001) + 0.001 / (crack + 0.001) * exp(-r * 4.0);
                        
                        vec3 hotPink = vec3(1.0, 0.1, 0.6);
                        vec3 acidGreen = vec3(0.6, 1.0, 0.1);
                        vec3 scarCol = mix(hotPink, acidGreen, fbm(d * 5.0 + u_time * 0.1));

                        col += scarCol * scar * scar_t;
                    }

                    // 2. Retrograde Particles (Anticipation)
                    // Stream inward before the explosion
                    float part_t = smoothstep(-2.5, -0.2, dt) * smoothstep(0.0, -0.1, dt);
                    if (part_t > 0.0) {
                        float part_ray = smoothstep(0.85, 1.0, fbm(vec2(a * 10.0, seed)));
                        float part_stream = fract(r * 12.0 + dt * 15.0); // Moves inward
                        float part = part_ray * smoothstep(0.7, 1.0, part_stream) * exp(-r * 5.0);

                        vec3 cyan = vec3(0.0, 0.8, 1.0);
                        col += cyan * part * part_t * 2.5;
                    }

                    // 3. Explosion Flash (Floating Point Dementia & False Vacuum)
                    float dementia = exp(-dt * 6.0) * step(0.0, dt) * (1.0 - is_false);
                    if (dementia > 0.0) {
                        // Quantization / Bit-crushed V-buffers
                        float q_level = mix(150.0, 3.0, dementia);
                        vec2 pq = floor(d * q_level) / q_level;
                        float rq = length(pq);

                        float core = 0.03 / (rq + 0.001);
                        vec3 whiteYel = vec3(1.0, 0.9, 0.5);
                        vec3 orangeDust = vec3(1.0, 0.4, 0.1);
                        vec3 expCol = mix(whiteYel, orangeDust, rq * 5.0);

                        // XOR-Ghost Manifold Logic
                        int bit_x = int(pq.x * 30.0);
                        int bit_y = int(pq.y * 30.0);
                        float xor_val = float(bit_x ^ bit_y) / 64.0;
                        vec3 uvBurn = vec3(0.6, 0.0, 1.0) * xor_val * 4.0;

                        // False Vacuum Membrane
                        float membrane = smoothstep(0.04, 0.0, abs(r - dt * 2.5));
                        membrane *= smoothstep(0.3, 0.7, fbm(d * 20.0 - u_time * 4.0));
                        vec3 acidGreen = vec3(0.6, 1.0, 0.1);

                        col += (expCol * core + uvBurn) * dementia;
                        col += acidGreen * membrane * dementia * 3.0;
                    }

                    return col;
                }

                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    p.x *= u_resolution.x / u_resolution.y;

                    vec3 col = vec3(0.0);

                    // Electric blue void background
                    col += vec3(0.01, 0.03, 0.08) * (1.0 - length(p) * 0.4);

                    // Minor Events (Grid-based)
                    vec2 grid = p * 1.5;
                    vec2 cell = floor(grid);

                    for (int y = -1; y <= 1; y++) {
                        for (int x = -1; x <= 1; x++) {
                            vec2 c = cell + vec2(x, y);
                            vec4 evt = getEvent(c);
                            col += renderEvent(evt, p, hash21(c));
                        }
                    }

                    // Hero Event (Center)
                    col += renderEvent(getEvent(vec2(100.0)), p, 42.0) * 1.5;

                    // --- Feedback & Autophagic Memory Splicing ---
                    // Poincaré Hyperbolic Parasites: outward spatial drift
                    vec2 center_uv = vUv - 0.5;
                    float r_uv = length(center_uv);
                    vec2 hyper = center_uv / (1.0 - r_uv * r_uv + 0.1); 
                    
                    // Liquid melt distortion
                    vec2 melt = (vec2(fbm(vUv * 15.0 + u_time), fbm(vUv * 15.0 - u_time)) - 0.5) * 0.003;
                    vec2 feed_uv = vUv + hyper * 0.002 + melt;
                    
                    vec3 prev = texture(u_feedback, feed_uv).rgb;

                    // Decay the old frame
                    vec3 decayed = prev * 0.88;

                    // Chromatic Cannibalism: opponent color burn-in
                    vec3 ghost = (vec3(1.0) - prev) * smoothstep(0.6, 1.0, dot(prev, vec3(0.333))) * 0.12;

                    col += decayed + ghost;

                    // Clamp to prevent total blowout before screen mapping
                    fragColor = vec4(clamp(col, 0.0, 2.0), 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial);
        scene.add(mesh);

        const screenScene = new THREE.Scene();
        const screenMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { u_texture: { value: null } },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D u_texture;
                void main() {
                    vec3 col = texture(u_texture, vUv).rgb;
                    // ACES-like tonemapping for the overexposed blasts
                    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
                    fragColor = vec4(col, 1.0);
                }
            `
        });
        const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMaterial);
        screenScene.add(screenMesh);

        canvas.__three = { renderer, scene, camera, shaderMaterial, rtA, rtB, screenScene, screenMaterial };
    }

    const { renderer, scene, camera, shaderMaterial, rtA, rtB, screenScene, screenMaterial } = canvas.__three;

    if (rtA.width !== grid.width || rtA.height !== grid.height) {
        rtA.setSize(grid.width, grid.height);
        rtB.setSize(grid.width, grid.height);
    }

    if (shaderMaterial && shaderMaterial.uniforms) {
        shaderMaterial.uniforms.u_time.value = time;
        shaderMaterial.uniforms.u_resolution.value.set(grid.width, grid.height);
        shaderMaterial.uniforms.u_feedback.value = rtA.texture;
    }

    // Render to RT B
    renderer.setRenderTarget(rtB);
    renderer.render(scene, camera);

    // Render RT B to Screen
    if (screenMaterial && screenMaterial.uniforms) {
        screenMaterial.uniforms.u_texture.value = rtB.texture;
    }
    renderer.setRenderTarget(null);
    renderer.render(screenScene, camera);

    // Swap Ping-Pong Buffers
    canvas.__three.rtA = rtB;
    canvas.__three.rtB = rtA;

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
    throw e;
}