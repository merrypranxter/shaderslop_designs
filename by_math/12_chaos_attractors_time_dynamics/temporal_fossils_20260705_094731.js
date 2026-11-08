if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping
        });
        const rtB = rtA.clone();

        const vert = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const sharedGLSL = `
            in vec2 vUv;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform sampler2D u_feedback;
            uniform float u_seed;

            float hash11(float p) {
                p = fract(p * 0.1031);
                p *= p + 33.33;
                p *= p + p;
                return fract(p);
            }

            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.xx + p3.yz) * p3.zy);
            }

            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f*f*(3.0-2.0*f);
                float a = hash11(i.x + i.y*57.0);
                float b = hash11(i.x + 1.0 + i.y*57.0);
                float c = hash11(i.x + (i.y+1.0)*57.0);
                float d = hash11(i.x + 1.0 + (i.y+1.0)*57.0);
                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            float fbm(vec2 p) {
                float sum = 0.0;
                float amp = 0.5;
                for(int i = 0; i < 4; i++) {
                    sum += amp * vnoise(p);
                    p = p * 2.0 + 17.0;
                    amp *= 0.5;
                }
                return sum;
            }

            vec3 compute_paint(vec2 uv, float t) {
                vec3 paint = vec3(0.0);
                float loop_len = 10.0;
                float local_t = mod(t, loop_len);

                for(int i = 0; i < 12; i++) {
                    float seed = u_seed + float(i) * 1.618;
                    vec2 pos = (hash22(vec2(seed, 1.2)) - 0.5) * 2.2;
                    float t_blast = hash11(seed * 3.33) * loop_len;
                    
                    bool is_hero = (i == 0);
                    bool is_false = (i == 3 || i == 7); // Scars that never explode

                    // Time relative to blast, wrapped to [-5, 5] for seamless loop
                    float dt = mod(local_t - t_blast + loop_len * 0.5, loop_len) - loop_len * 0.5;

                    vec2 q_uv = uv;
                    
                    // Floating Point Dementia: coordinate precision tearing at the moment of the blast
                    if (!is_false && dt > 0.0 && dt < 0.4) {
                        float bits = mix(2.0, 16.0, dt / 0.4);
                        float levels = exp2(bits);
                        q_uv = floor(uv * levels) / levels;
                    }

                    float dist = length(q_uv - pos);

                    // 1. Fossil Scar (Echo-first anticipation)
                    if (dt > -4.0 && dt <= 0.0) {
                        float build = smoothstep(-4.0, -0.1, dt) * smoothstep(0.0, -0.1, dt);
                        
                        vec2 warp = vec2(fbm(q_uv * 4.0 + seed), fbm(q_uv * 4.0 - seed));
                        float crack = abs(fbm(q_uv * 10.0 + warp * 3.0) - 0.5);
                        float scar = smoothstep(0.08, 0.0, crack) * exp(-dist * (is_hero ? 1.5 : 4.0));

                        float ring = abs(dist - (is_hero ? 0.6 : 0.3));
                        float burn = smoothstep(0.015, 0.0, ring) * fbm(q_uv * 15.0 + seed);

                        // Hot pink to acid green
                        vec3 col = mix(vec3(1.0, 0.1, 0.6), vec3(0.6, 1.0, 0.1), warp.x);
                        paint += col * (scar + burn) * build * (is_hero ? 2.5 : 1.2);
                    }

                    // 2. Retrograde Particles (Effect preceding cause)
                    if (dt > -3.0 && dt <= 0.0) {
                        float r = -dt * (is_hero ? 0.6 : 0.3); // Particles fly inward
                        float ring = abs(dist - r);
                        float angle = atan(q_uv.y - pos.y, q_uv.x - pos.x);
                        float particle = smoothstep(0.02, 0.0, ring) * step(0.94, hash11(floor(angle * 40.0) + seed));
                        paint += vec3(0.0, 1.0, 1.0) * particle * smoothstep(-3.0, -0.1, dt); // Cyan
                    }

                    // 3. Blast (False Vacuum Decay & Precision Damage)
                    if (!is_false && dt > 0.0 && dt < 1.5) {
                        float r = dt * (is_hero ? 4.0 : 2.0);
                        float wall = abs(dist - r);
                        float blast = smoothstep(0.04, 0.0, wall);

                        // White/yellow core flash
                        float flash = smoothstep(0.1, 0.0, dt) * exp(-dist * 8.0);
                        paint += vec3(1.0, 1.0, 0.8) * flash * 4.0;

                        // Inside the bubble: Ultraviolet NaN burn void
                        if (dist < r) {
                            paint += vec3(0.8, 0.0, 1.0) * 0.2 * exp(-dt * 2.0);
                        }

                        // Expanding energy wall: Orange shock dust
                        paint += vec3(1.0, 0.5, 0.0) * blast * exp(-dt * 3.0) * 1.5;
                    }

                    // 4. False Cause Dissipation
                    if (is_false && dt > 0.0 && dt < 1.0) {
                        paint += vec3(1.0, 0.2, 0.6) * exp(-dt * 4.0) * 0.5 * exp(-dist * 3.0);
                    }
                }
                return paint;
            }
        `;

        const fragFBO = `
            out vec4 fragColor;
            void main() {
                vec2 uv = (vUv - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
                vec3 p = compute_paint(uv, u_time);
                
                vec2 texel = 1.0 / u_resolution;
                
                // Diffuse the burn slightly to simulate subsurface retinal scatter
                vec3 prev = texture(u_feedback, vUv).rgb * 0.6 +
                            texture(u_feedback, vUv + vec2(texel.x, 0.0)).rgb * 0.1 +
                            texture(u_feedback, vUv - vec2(texel.x, 0.0)).rgb * 0.1 +
                            texture(u_feedback, vUv + vec2(0.0, texel.y)).rgb * 0.1 +
                            texture(u_feedback, vUv - vec2(0.0, texel.y)).rgb * 0.1;

                // Slow exponential decay for the burn memory
                vec3 new_burn = prev * 0.97 + p * 0.06;
                fragColor = vec4(new_burn, 1.0);
            }
        `;

        const fragDisplay = `
            out vec4 fragColor;
            void main() {
                vec2 uv = (vUv - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
                
                vec3 p = compute_paint(uv, u_time);
                vec3 burn = texture(u_feedback, vUv).rgb;

                // Optical complement of the burn buffer (Afterimage Painter logic)
                vec3 comp = vec3(1.0) - burn;
                float burn_strength = max(burn.r, max(burn.g, burn.b));
                float paint_strength = max(p.r, max(p.g, p.b));

                // The ghost only shows where real paint has faded
                vec3 ghost = comp * burn_strength * (1.0 - clamp(paint_strength, 0.0, 1.0));

                vec3 final = p + ghost;

                // Background: Electric blue void
                float bg_noise = fbm(uv * 2.0 + u_time * 0.05);
                vec3 bg = vec3(0.01, 0.03, 0.1) * bg_noise;

                final += bg * (1.0 - clamp(paint_strength + burn_strength, 0.0, 1.0));

                // ACES-ish Tonemap to handle extreme HDR plasma
                final = (final * (2.51 * final + 0.03)) / (final * (2.43 * final + 0.59) + 0.14);

                fragColor = vec4(final, 1.0);
            }
        `;

        const uniforms = {
            u_time: { value: 0 },
            u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            u_feedback: { value: null },
            u_seed: { value: Math.random() * 1000.0 }
        };

        const matFBO = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
            vertexShader: vert,
            fragmentShader: sharedGLSL + fragFBO
        });

        const matDisplay = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
            vertexShader: vert,
            fragmentShader: sharedGLSL + fragDisplay
        });

        const sceneFBO = new THREE.Scene();
        sceneFBO.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matFBO));

        const sceneDisplay = new THREE.Scene();
        sceneDisplay.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matDisplay));

        canvas.__three = { renderer, camera, rtA, rtB, matFBO, matDisplay, sceneFBO, sceneDisplay };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const { renderer, camera, matFBO, matDisplay, sceneFBO, sceneDisplay } = canvas.__three;
let { rtA, rtB } = canvas.__three;

renderer.setSize(grid.width, grid.height, false);
matFBO.uniforms.u_resolution.value.set(grid.width, grid.height);
matDisplay.uniforms.u_resolution.value.set(grid.width, grid.height);

matFBO.uniforms.u_time.value = time;
matDisplay.uniforms.u_time.value = time;

// Ping-pong feedback pass
matFBO.uniforms.u_feedback.value = rtA.texture;
renderer.setRenderTarget(rtB);
renderer.render(sceneFBO, camera);

// Display pass
matDisplay.uniforms.u_feedback.value = rtB.texture;
renderer.setRenderTarget(null);
renderer.render(sceneDisplay, camera);

// Swap targets for next frame
canvas.__three.rtA = rtB;
canvas.__three.rtB = rtA;