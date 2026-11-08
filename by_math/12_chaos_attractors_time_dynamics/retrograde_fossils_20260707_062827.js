try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL2 context not available");

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: ctx,
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: false
        });
        renderer.setPixelRatio(1);

        const w = grid.width;
        const h = grid.height;

        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        const rtA = new THREE.WebGLRenderTarget(w, h, rtOptions);
        const rtB = new THREE.WebGLRenderTarget(w, h, rtOptions);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        const feedbackMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_prevFrame: { value: null },
                u_resolution: { value: new THREE.Vector2(w, h) }
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
                uniform sampler2D u_prevFrame;
                uniform vec2 u_resolution;

                #define PI 3.14159265359

                float hash11(float p) {
                    return fract(sin(p) * 43758.5453123);
                }

                vec2 hash21(float p) {
                    return fract(sin(vec2(p, p + 1.0)) * vec2(43758.5453123, 22578.1459123));
                }

                float vnoise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash11(dot(i, vec2(1.0, 57.0)));
                    float b = hash11(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
                    float c = hash11(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0)));
                    float d = hash11(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 5; i++) {
                        v += a * vnoise(p);
                        p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                vec2 quantize(vec2 uv, float bits) {
                    float levels = exp2(bits);
                    return floor(uv * levels) / levels;
                }

                void main() {
                    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                    vec2 p = (vUv - 0.5) * aspect;

                    vec3 prev = texture(u_prevFrame, vUv).rgb;
                    
                    // Afterimage painter: complementary burn-in
                    vec3 comp = vec3(1.0) - prev;
                    float prevLuma = dot(prev, vec3(0.299, 0.587, 0.114));
                    vec3 ghost = comp * smoothstep(0.7, 1.0, prevLuma) * 0.08;
                    
                    // Base decay creates trails without smearing static objects into oblivion
                    vec3 color = prev * 0.88 + ghost; 
                    
                    const int NUM_EVENTS = 15;
                    for (int i = 0; i < NUM_EVENTS; i++) {
                        float seed = float(i) * 1.61803;
                        
                        // Deterministic event parameters
                        float t_exp = hash11(seed) * 10.0;
                        vec2 pos = (i == 0) ? vec2(0.0) : (hash21(seed + 1.0) - 0.5) * 1.8 * aspect;
                        bool is_false = (i != 0) && (hash11(seed + 2.0) < 0.3);
                        float scale = (i == 0) ? 1.4 : 0.2 + 0.5 * hash11(seed + 3.0);
                        
                        // Local time wrapping around the 10-second loop
                        float dt = mod(u_time - t_exp + 5.0, 10.0) - 5.0;
                        
                        vec2 dp = p - pos;
                        float dist = length(dp);
                        float angle = atan(dp.y, dp.x);
                        
                        // 1. Anticipation: Fossil Scars (t < 0)
                        if (dt > -4.0 && dt < 0.5) {
                            float f_alpha = smoothstep(-4.0, -2.0, dt) * smoothstep(0.5, 0.0, dt);
                            
                            float n1 = fbm(dp * 12.0 / scale + seed);
                            float n2 = fbm(dp * 20.0 / scale - seed);
                            
                            // Circular burn + branching shock cracks
                            float ring = smoothstep(0.03 * scale, 0.0, abs(dist - 0.4 * scale * n1));
                            float branch = smoothstep(0.02, 0.0, abs(fract(angle * 3.0 / PI + n2) - 0.5)) * smoothstep(0.6 * scale, 0.1 * scale, dist);
                            
                            float fossil = max(ring, branch) * f_alpha;
                            vec3 scar_col = mix(vec3(1.0, 0.1, 0.6), vec3(0.5, 1.0, 0.0), n1); // Hot pink to acid green
                            
                            color = max(color, scar_col * fossil); // Max prevents static elements from blowing out
                        }
                        
                        // 2. Retrograde Particles (t < 0)
                        if (dt > -3.0 && dt < 0.0) {
                            float p_alpha = smoothstep(-3.0, -1.0, dt);
                            float r_path = abs(dt) * 0.6 * scale;
                            
                            float p_noise = fbm(vec2(angle * 12.0, seed + dt * 2.0));
                            float p_mask = smoothstep(0.02 * scale, 0.0, abs(dist - r_path)) * smoothstep(0.6, 0.8, p_noise);
                            
                            color += vec3(0.0, 1.0, 1.0) * p_mask * p_alpha * 0.6; // Cyan converging trails
                        }
                        
                        // 3. Explosion (t >= 0)
                        if (!is_false && dt >= 0.0 && dt < 2.0) {
                            float e_prog = dt / 2.0;
                            float e_r = e_prog * 2.5 * scale;
                            float e_thick = 0.1 * scale;
                            
                            // Floating Point Dementia Void
                            if (dist < e_r) {
                                float bits = mix(2.0, 8.0, e_prog);
                                vec2 q_dp = quantize(dp, bits);
                                float q_dist = length(q_dp);
                                
                                float void_mask = smoothstep(e_r, e_r - 0.2 * scale, q_dist);
                                
                                // Ultraviolet NaN burn with grid artifacts
                                vec3 nan_col = vec3(0.6, 0.0, 1.0);
                                float grid = step(0.8, fract(q_dp.x * 20.0 / scale)) + step(0.8, fract(q_dp.y * 20.0 / scale));
                                nan_col += vec3(0.4, 0.0, 0.5) * grid;
                                
                                color = mix(color, nan_col, void_mask * 0.3 * (1.0 - e_prog));
                                color = max(color, vec3(0.0, 0.3, 1.0) * void_mask * 0.15 * (1.0 - e_prog)); // Electric blue base
                            }
                            
                            // Expanding False Vacuum Shockwave
                            float wall_dist = abs(dist - e_r);
                            float wall = smoothstep(e_thick, 0.0, wall_dist);
                            float w_noise = fbm(dp * 25.0 - u_time * 4.0);
                            
                            // White/yellow core to orange shock dust
                            vec3 w_col = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 1.0, 0.8), w_noise);
                            color += w_col * wall * (1.0 - e_prog) * 1.5;
                        }
                    }
                    
                    fragColor = vec4(clamp(color, 0.0, 1.5), 1.0);
                }
            `
        });

        const screenMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_tex: { value: null }
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
                uniform sampler2D u_tex;
                
                // ACES Tonemapping
                vec3 aces(vec3 x) {
                    float a = 2.51;
                    float b = 0.03;
                    float c = 2.43;
                    float d = 0.59;
                    float e = 0.14;
                    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
                }
                
                void main() {
                    vec3 col = texture(u_tex, vUv).rgb;
                    col = aces(col);
                    
                    // Vignette
                    vec2 d = vUv - 0.5;
                    col *= 1.0 - 0.7 * dot(d, d);
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });

        const feedbackMesh = new THREE.Mesh(geometry, feedbackMaterial);
        const screenMesh = new THREE.Mesh(geometry, screenMaterial);
        
        const feedbackScene = new THREE.Scene();
        feedbackScene.add(feedbackMesh);
        
        const screenScene = new THREE.Scene();
        screenScene.add(screenMesh);

        canvas.__three = {
            renderer,
            camera,
            rtA,
            rtB,
            feedbackScene,
            screenScene,
            feedbackMaterial,
            screenMaterial,
            pingpong: true
        };
    }

    const { renderer, camera, rtA, rtB, feedbackScene, screenScene, feedbackMaterial, screenMaterial } = canvas.__three;

    const w = grid.width;
    const h = grid.height;
    if (rtA.width !== w || rtA.height !== h) {
        renderer.setSize(w, h, false);
        rtA.setSize(w, h);
        rtB.setSize(w, h);
        feedbackMaterial.uniforms.u_resolution.value.set(w, h);
    }

    const readRT = canvas.__three.pingpong ? rtA : rtB;
    const writeRT = canvas.__three.pingpong ? rtB : rtA;

    feedbackMaterial.uniforms.u_time.value = time;
    feedbackMaterial.uniforms.u_prevFrame.value = readRT.texture;

    renderer.setRenderTarget(writeRT);
    renderer.render(feedbackScene, camera);

    screenMaterial.uniforms.u_tex.value = writeRT.texture;
    renderer.setRenderTarget(null);
    renderer.render(screenScene, camera);

    canvas.__three.pingpong = !canvas.__three.pingpong;

} catch (e) {
    console.error("WebGL Initialization or Render Failed:", e);
    throw e;
}