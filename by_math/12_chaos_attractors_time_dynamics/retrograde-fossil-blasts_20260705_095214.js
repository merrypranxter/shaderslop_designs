if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.autoClear = false;

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const sceneMain = new THREE.Scene();
        const sceneCopy = new THREE.Scene();

        const matMain = new THREE.ShaderMaterial({
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
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform sampler2D u_feedback;

                float hash11(float p) { return fract(sin(p)*43758.5453123); }
                vec2 hash22(vec2 p) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))))*43758.5453123); }
                vec3 hash31(float p) { return fract(sin(vec3(p, p+1.0, p+2.0))*43758.5453123); }

                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod(i, 289.0);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m; m = m*m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                float fbm(vec2 x) {
                    float v = 0.0;
                    float a = 0.5;
                    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                    for (int i = 0; i < 4; ++i) {
                        v += a * snoise(x);
                        x = rot * x * 2.0 + vec2(100.0);
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y));
                    vec3 col = vec3(0.0);

                    float loopTime = mod(u_time, 10.0);

                    // Electric blue void background
                    col += vec3(0.01, 0.04, 0.1) * max(0.0, 1.0 - length(uv) * 0.5);

                    const int NUM_EVENTS = 15;

                    for(int i = 0; i < NUM_EVENTS; i++) {
                        vec3 h = hash31(float(i + 1) * 137.9);
                        vec2 pos = (h.xy - 0.5) * 2.5;
                        float t_e = h.z * 10.0;

                        bool is_hero = (i == 0);
                        if (is_hero) {
                            pos = vec2(0.0);
                            t_e = 5.0; 
                        }

                        float is_false_cause = (hash11(float(i)*77.7) < 0.25 && !is_hero) ? 1.0 : 0.0;

                        // Wrap time for seamless 10-second loop
                        float dt = mod(loopTime - t_e + 5.0, 10.0) - 5.0;
                        float scale = is_hero ? 2.0 : mix(0.3, 1.0, h.x);
                        float d = length(uv - pos);

                        // 1. FOSSIL SCAR (Echo-First)
                        float fossil_env = smoothstep(-4.0, -1.0, dt) * smoothstep(1.0, 0.0, dt);
                        if (is_false_cause > 0.5) fossil_env = smoothstep(-4.0, -2.0, dt) * smoothstep(4.0, 2.0, dt);

                        if (fossil_env > 0.001) {
                            float n = fbm(uv * 8.0 - pos + dt * 0.1);
                            float angle = atan(uv.y - pos.y, uv.x - pos.x);
                            float branches = floor(mix(4.0, 9.0, h.y));
                            float crack = abs(sin(angle * branches + n * 5.0));
                            
                            float ring = smoothstep(0.06 * scale, 0.0, abs(d - 0.25 * scale - n * 0.1 * scale));
                            float core_burn = smoothstep(0.1 * scale, 0.0, d);
                            
                            float fossil = (ring * (1.0 - crack) + core_burn * crack * 0.5) * exp(-d * 4.0 / scale);
                            vec3 fossil_col = mix(vec3(1.0, 0.1, 0.6), vec3(0.5, 1.0, 0.0), h.z); // Hot Pink to Acid Green
                            col += fossil_col * fossil * fossil_env * 3.0;
                        }

                        // 2. RETROGRADE PARTICLES (Anticipation)
                        float part_time = clamp((dt + 2.0) / 2.0, 0.0, 1.0);
                        if (dt > -2.0 && dt < 0.0 && is_false_cause < 0.5) {
                            for(int p = 0; p < 5; p++) {
                                vec2 p_hash = hash22(vec2(float(i), float(p)));
                                float p_angle = p_hash.x * 6.283 + dt * (p_hash.y - 0.5);
                                float p_dist = mix(1.2 * scale, 0.0, pow(part_time, 3.0));
                                
                                vec2 p_pos = pos + vec2(cos(p_angle), sin(p_angle)) * p_dist;
                                p_pos += (hash22(p_pos) - 0.5) * 0.1 * part_time; // Wobble
                                
                                float pd = length(uv - p_pos);
                                float p_size = mix(0.02, 0.002, part_time);
                                col += vec3(0.0, 1.0, 1.0) * smoothstep(p_size, 0.0, pd) * part_time * 2.0; // Cyan
                            }
                        }

                        // 3. EXPLOSION & DEMENTIA (Late/Redundant)
                        if (dt >= 0.0 && dt < 2.0 && is_false_cause < 0.5) {
                            float exp_env = exp(-dt * 3.0);
                            float core_heat = smoothstep(0.25 * scale, 0.0, d);

                            // Floating Point Dementia (ULP breaking)
                            float bits = mix(1.0, 6.0, dt); 
                            float levels = exp2(bits);
                            float dementia = floor(core_heat * levels) / levels;
                            float error = abs(core_heat - dementia);

                            // Blast Core (White/Yellow)
                            col += vec3(1.0, 1.0, 0.8) * dementia * exp_env * 3.0;
                            // NaN Burns (Ultraviolet)
                            col += vec3(0.6, 0.0, 1.0) * error * exp_env * 20.0;

                            // False Vacuum Membrane
                            float radius = dt * 2.0 * scale + snoise(uv * 5.0 - dt) * 0.05 * scale;
                            float membrane = smoothstep(0.03 * scale, 0.0, abs(d - radius));
                            
                            col += vec3(0.0, 0.4, 1.0) * membrane * exp(-dt * 2.0) * 1.5; // Electric blue shockwave
                            col += vec3(1.0, 0.4, 0.0) * membrane * smoothstep(0.0, 0.1 * scale, d - radius) * exp(-dt * 1.5); // Orange shock dust
                        }
                    }

                    vec3 prev = texture(u_feedback, vUv).rgb;
                    
                    // Afterimage Painter (Complementary burn-in)
                    vec3 comp = max(vec3(0.0), vec3(1.0) - prev);
                    float luma = dot(prev, vec3(0.299, 0.587, 0.114));
                    vec3 ghost = comp * luma * 0.08;

                    // Temporal Decay
                    vec3 decay = clamp(prev * 0.88, 0.0, 10.0);

                    fragColor = vec4(col + decay + ghost, 1.0);
                }
            `
        });

        const matCopy = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { u_tex: { value: null } },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                uniform sampler2D u_tex;
                out vec4 fragColor;
                
                // ACES-ish tonemapping
                vec3 tonemap(vec3 x) {
                    float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
                    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
                }

                void main() {
                    vec3 col = texture(u_tex, vUv).rgb;
                    fragColor = vec4(tonemap(col), 1.0);
                }
            `
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        sceneMain.add(new THREE.Mesh(quad.geometry, matMain));
        sceneCopy.add(new THREE.Mesh(quad.geometry, matCopy));

        canvas.__three = { renderer, rtA, rtB, camera, sceneMain, sceneCopy, matMain, matCopy };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const t = canvas.__three;
t.renderer.setSize(grid.width, grid.height, false);

if (t.rtA.width !== grid.width || t.rtA.height !== grid.height) {
    t.rtA.setSize(grid.width, grid.height);
    t.rtB.setSize(grid.width, grid.height);
    t.matMain.uniforms.u_resolution.value.set(grid.width, grid.height);
}

t.matMain.uniforms.u_time.value = time;
t.matMain.uniforms.u_feedback.value = t.rtA.texture;

t.renderer.setRenderTarget(t.rtB);
t.renderer.render(t.sceneMain, t.camera);

t.renderer.setRenderTarget(null);
t.matCopy.uniforms.u_tex.value = t.rtB.texture;
t.renderer.render(t.sceneCopy, t.camera);

const temp = t.rtA;
t.rtA = t.rtB;
t.rtB = temp;