if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mouse_pressed: { value: 0.0 }
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
                uniform vec2 u_mouse;
                uniform float u_mouse_pressed;

                const int MAX_ITER = 120;
                const float BAILOUT = 256.0;

                // Hash function for procedural noise
                vec2 hash22(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453);
                }

                // Manhattan distance Worley noise (Circuit Board / Sector Faults)
                float worleyManhattan(vec2 p) {
                    vec2 n = floor(p);
                    vec2 f = fract(p);
                    float d1 = 8.0;
                    for (int j = -1; j <= 1; j++) {
                        for (int i = -1; i <= 1; i++) {
                            vec2 g = vec2(float(i), float(j));
                            vec2 o = hash22(n + g);
                            // Jitter the cells over time to simulate unstable memory
                            o = 0.5 + 0.5 * sin(u_time * 1.5 + 6.28318 * o);
                            vec2 r = g + o - f;
                            float d = abs(r.x) + abs(r.y);
                            if (d < d1) d1 = d;
                        }
                    }
                    return d1;
                }

                // Complex multiplication
                vec2 cmul(vec2 a, vec2 b) {
                    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
                }

                // Neon Acid Palette (from color_fields)
                vec3 paletteNeon(float t) {
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.33);
                    vec3 c = vec3(2.0, 1.0, 1.0);
                    vec3 d = vec3(0.5, 0.2, 0.25);
                    return a + b * cos(6.28318 * (c * t + d));
                }

                // ACES Tonemapping (from color_fields)
                vec3 tonemapACES(vec3 x) {
                    float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
                    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
                }

                void main() {
                    vec2 uv = vUv * 2.0 - 1.0;
                    float aspect = u_resolution.x / u_resolution.y;
                    uv.x *= aspect;

                    // Retrofuturism: CRT Warp & Distortion
                    float rSq = dot(uv, uv);
                    vec2 warpedUV = uv * (1.0 + 0.15 * rSq);

                    // Base Julia parameter: San Marco Dragon drifting
                    float t = u_time * 0.15;
                    vec2 base_c = vec2(-0.7269, 0.1889) + vec2(sin(t) * 0.04, cos(t * 1.1) * 0.04);

                    // Interaction: Mouse overrides the diagnostic parameter
                    vec2 mouse_c = (u_mouse * 2.0 - 1.0) * vec2(aspect, 1.0) * 1.5;
                    vec2 c = mix(base_c, mouse_c, u_mouse_pressed);

                    vec2 z = warpedUV * 1.3;
                    float iter = 0.0;
                    float trap = 1e10;
                    float fault_count = 0.0;

                    for(int i = 0; i < MAX_ITER; i++) {
                        // The Strange Mechanism: Crystallization of a Bureaucratic Failure
                        // When the fractal iteration enters a corrupted Manhattan noise sector,
                        // it executes a "Celtic Fold" instead of a normal complex squaring.
                        // This forces sharp, crystalline, circuit-like logic into the smooth fractal.
                        float w = worleyManhattan(z * 3.0 + u_time * 0.2);
                        float fault_thresh = 0.2 + 0.1 * sin(u_time * 8.0 + z.y * 12.0);

                        if(w < fault_thresh) {
                            // Celtic variant logic (abs on real part)
                            float rx = z.x * z.x - z.y * z.y;
                            z = vec2(abs(rx) + c.x, 2.0 * z.x * z.y + c.y);
                            fault_count += 1.0;
                        } else {
                            // Normal Julia logic
                            z = cmul(z, z) + c;
                        }

                        // Orbit trap: scanline-like horizontal bands
                        trap = min(trap, abs(z.y + sin(z.x * 4.0 - u_time * 2.0) * 0.2));

                        if(dot(z, z) > BAILOUT) {
                            iter = float(i);
                            break;
                        }
                    }

                    vec3 col = vec3(0.0);

                    if(iter > 0.0 && iter < float(MAX_ITER) - 1.0) {
                        // Smooth escape time
                        float smooth_iter = iter - log2(max(1.0, log2(dot(z, z))));
                        float norm_iter = smooth_iter / float(MAX_ITER);

                        // Color mapped from Neon Acid palette
                        col = paletteNeon(norm_iter * 5.0 - u_time * 0.4 + trap * 0.8);

                        // Emphasize the corrupted sectors (Toxic Growth / Radioactive pulse)
                        col += vec3(0.8, 1.0, 0.0) * (fault_count / 20.0) * (0.5 + 0.5 * sin(u_time * 10.0));
                    } else {
                        // Interior: Deep Cosmic Void with a faint data grid
                        col = vec3(0.02, 0.01, 0.05);
                        float grid = step(0.98, fract(warpedUV.x * 12.0)) + step(0.98, fract(warpedUV.y * 12.0));
                        col += vec3(0.15, 0.05, 0.2) * grid * (1.0 - length(warpedUV));
                    }

                    // Cassette Futurism UI Overlays
                    // Glitchy targeting reticle
                    float jitter = step(0.95, fract(sin(u_time * 43.0) * 43758.5453)) * 0.02;
                    float reticle = smoothstep(0.02 + jitter, 0.0, abs(warpedUV.x)) * step(abs(warpedUV.y), 0.15) +
                                    smoothstep(0.02 + jitter, 0.0, abs(warpedUV.y)) * step(abs(warpedUV.x), 0.15);
                    reticle *= step(0.08, length(warpedUV)); // Hollow center
                    col = mix(col, vec3(1.0, 0.1, 0.3), reticle * 0.8);

                    // Scanlines & Phosphor persistence
                    float scanline = sin(vUv.y * u_resolution.y * 3.14159) * 0.08;
                    col -= scanline;

                    // Chromatic Aberration near the edges
                    float ca = rSq * 0.08;
                    col.r += ca * sin(u_time * 5.0);
                    col.b -= ca * cos(u_time * 5.0);

                    // Vignette
                    float vignette = 1.0 - smoothstep(0.4, 1.8, length(uv));
                    col *= vignette;

                    col = tonemapACES(col);

                    fragColor = vec4(col, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - (mouse.y / grid.height));
    material.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);