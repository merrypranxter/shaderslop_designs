try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;

            #define PI 3.14159265359

            // [GLITCH PROPHET] Deterministic hardware confusion
            float hash(vec2 p) { 
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); 
            }
            float hash1(float n) { 
                return fract(sin(n) * 43758.5453); 
            }

            // Noise for resist dye diffusion
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for(int i=0; i<4; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            // [STRUCTURAL COLOR] Physics-based spectral interference mapping
            vec3 spectral_color(float w) {
                vec3 c = vec3(0.0);
                if(w >= 380.0 && w < 440.0) c = vec3(-(w-440.0)/60.0, 0.0, 1.0);
                else if(w >= 440.0 && w < 490.0) c = vec3(0.0, (w-440.0)/50.0, 1.0);
                else if(w >= 490.0 && w < 510.0) c = vec3(0.0, 1.0, -(w-510.0)/20.0);
                else if(w >= 510.0 && w < 580.0) c = vec3((w-510.0)/70.0, 1.0, 0.0);
                else if(w >= 580.0 && w < 645.0) c = vec3(1.0, -(w-645.0)/65.0, 0.0);
                else if(w >= 645.0 && w < 780.0) c = vec3(1.0, 0.0, 0.0);
                return pow(clamp(c, 0.0, 1.0), vec3(0.8)); // Saturation boost
            }

            vec3 thin_film_interference(float cosTheta, float thickness) {
                vec3 col = vec3(0.0);
                float n_film = 1.56; // Chitin / synthetic holographic thread
                float opd = 2.0 * n_film * thickness * cosTheta;
                // Integrate over visible spectrum
                for(float i = 0.0; i < 6.0; i++) {
                    float lambda = mix(400.0, 700.0, i / 5.0);
                    float phase = (opd / lambda) * 6.28318;
                    float intensity = 0.5 + 0.5 * cos(phase);
                    col += spectral_color(lambda) * intensity;
                }
                return col / 6.0;
            }

            // [WEBGPU CYMATIC KNOTS] Gyroid as macro-yarn topology
            float gyroid(vec3 p) {
                return dot(sin(p), cos(p.zxy));
            }

            // [SIMULATION HYPOTHESIS] Z-Fighting precision failure
            float z_fight(vec2 p, float z1, float z2, float prec) {
                float buckets = 1.0 / prec;
                float q1 = floor(z1 * buckets) / buckets;
                float q2 = floor(z2 * buckets) / buckets;
                if(abs(q1 - q2) < prec * 0.5) return step(0.5, hash(p * 150.0 + floor(u_time * 24.0)));
                return step(z2, z1);
            }

            void main() {
                vec2 st = (vUv - 0.5) * 2.0;
                st.x *= u_resolution.x / u_resolution.y;

                // Mouse interaction for view angle
                vec2 m = u_mouse * 2.0 - 1.0;
                m.y = -m.y;

                // [MEMORY PRESSURE] LOD Pop logic
                float lod_phase = mod(u_time * 0.25, 3.0);
                float lod = (lod_phase < 1.0) ? 1.0 : ((lod_phase < 2.0) ? 2.0 : 3.0);
                float scale = 6.0 * pow(1.6, lod); // Snaps scale abruptly

                float pop_flash = smoothstep(0.0, 0.1, fract(u_time * 0.25)) * (1.0 - smoothstep(0.1, 0.4, fract(u_time * 0.25)));

                // [TEXTILE SURFACE FX] Base Drape & Fold
                float drape = fbm(st * 1.5 + u_time * 0.1) * 0.4;
                vec3 p3 = vec3(st * scale, drape * scale + u_time * 1.5);

                // Fabric Micro-structure (Knitting / Boucle loops)
                float h_fabric = gyroid(p3) * 0.15;
                
                // Add Fuzz / Fleece Halo
                h_fabric += hash(st * scale * 5.0) * 0.03;

                // [RESIST DYE PATTERNS] Shibori diffusion bloom controlling film thickness
                float bloom = fbm(st * 3.0 - u_time * 0.05);
                float dye_thickness = 150.0 + 800.0 * smoothstep(0.2, 0.8, bloom);
                dye_thickness += 50.0 * sin(st.x * 20.0) * cos(st.y * 20.0); // Weave variation

                // Calculate Normal from gyroid derivative
                vec2 e = vec2(0.02, 0.0);
                float d_dx = gyroid(p3 + e.xyy) * 0.15 - h_fabric;
                float d_dy = gyroid(p3 + e.yxy) * 0.15 - h_fabric;
                vec3 normal = normalize(vec3(-d_dx, -d_dy, 0.3));

                // View angle (Observer Effect)
                vec3 view = normalize(vec3(m.x * 0.5, m.y * 0.5, 1.0) - vec3(st, h_fabric + drape));
                float cosTheta = max(0.0, dot(normal, view));

                // Generate Iridescent Textile Color
                vec3 fabric_col = thin_film_interference(cosTheta, dye_thickness + h_fabric * 200.0);

                // [VOID STATE] The simulation before assets stream in
                vec2 grid = fract(st * 8.0);
                float wire = 1.0 - smoothstep(0.0, 0.04, min(grid.x, grid.y));
                vec3 void_col = vec3(0.0, 0.4, 0.2) * wire;
                
                // AABB Ghost Outlines (Pop-in artifacts)
                vec2 cell = floor(st * 8.0);
                if (hash(cell + floor(u_time)) > 0.85) {
                    float aabb = smoothstep(0.45, 0.5, max(abs(grid.x - 0.5), abs(grid.y - 0.5)));
                    void_col += vec3(0.9, 0.1, 0.4) * aabb * (0.5 + 0.5 * sin(u_time * 10.0));
                }

                // Z-Fighting Intersection
                float z_total_fabric = h_fabric + drape;
                float z_void = 0.1 * sin(st.x * 8.0 + u_time) + 0.1 * cos(st.y * 8.0); 
                float z_prec = 0.01 + 0.04 * sin(u_time * 1.5); // Fluctuating depth precision
                
                float winner = z_fight(st, z_total_fabric, z_void, z_prec);

                // TAA Ghosting Bleed (Temporal Anti-Aliasing failure)
                float ghost = smoothstep(0.8, 1.0, sin(st.y * 80.0 + u_time * 12.0));
                fabric_col.r += ghost * 0.3 * (1.0 - winner);
                fabric_col.b += ghost * 0.3 * winner;

                // Mix based on Z-fight
                vec3 final_col = mix(void_col, fabric_col, winner);

                // Apply LOD Pop Flash
                final_col += vec3(0.2, 0.8, 1.0) * pop_flash * (1.0 - winner) * 2.0;
                final_col += vec3(0.9, 0.3, 0.1) * pop_flash * winner * 0.5;

                // Vignette
                float vig = 1.0 - smoothstep(0.5, 1.5, length(st));
                final_col *= vig;

                fragColor = vec4(final_col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        
        // Smooth mouse interpolation
        const targetMouseX = mouse.x / grid.width;
        const targetMouseY = mouse.y / grid.height;
        material.uniforms.u_mouse.value.x += (targetMouseX - material.uniforms.u_mouse.value.x) * 0.1;
        material.uniforms.u_mouse.value.y += (targetMouseY - material.uniforms.u_mouse.value.y) * 0.1;
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL 2 Initialization Failed:", e);
    
    // Fallback to 2D canvas failure state if WebGL breaks
    if (ctx && ctx.fillText) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#ff0033';
        ctx.font = '14px monospace';
        ctx.fillText('GPU SIMULATION CONTEXT LOST.', 20, 30);
        ctx.fillText('VOID STATE INITIATED.', 20, 50);
    }
}