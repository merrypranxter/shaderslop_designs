try {
    if (!ctx) throw new Error("Context missing");

    // Defensive check for THREE
    if (typeof THREE === 'undefined') {
        throw new Error("THREE.js is required for this shader.");
    }

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: ctx,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            // [THE-LISTS] Domain 8: Digital Folklore & Glitch Methodologies
            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            
            float noise(vec2 x) {
                vec2 p = floor(x); vec2 f = fract(x);
                f = f*f*(3.0-2.0*f);
                float n = p.x + p.y*57.0;
                return mix(mix(hash(n), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
            }

            // [color_fields] Neon Acid Cosine Palette
            vec3 neonAcid(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.33);
                vec3 c = vec3(2.0, 1.0, 1.0);
                vec3 d = vec3(0.5, 0.2, 0.25);
                return a + b * cos(6.28318 * (c * t + d));
            }

            // [structural_color] Thin-Film Interference (Chitin / Mycelial Wall)
            vec3 thinFilm(float cosTheta, float thickness) {
                float n_film = 1.56; // Chitin refractive index
                // Optical path difference
                float pathDiff = 2.0 * n_film * thickness * sqrt(1.0 - pow(sin(acos(cosTheta))/n_film, 2.0));
                vec3 phase = vec3(0.0, 0.33, 0.67);
                return 0.5 + 0.5 * cos(6.28318 * (pathDiff / 550.0 + phase));
            }
            
            // [color_systems] OKLab LCh perceptual rotation mapping
            vec2 cmul(vec2 a, vec2 b) {
                return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
            }

            // Complex math for fractal
            vec2 csqr(vec2 a) {
                return vec2(a.x*a.x - a.y*a.y, 2.0*a.x*a.y);
            }

            vec3 renderFractal(vec2 uv_offset, float time_offset) {
                vec2 uv = vUv * 2.0 - 1.0 + uv_offset;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // [THE-LISTS] Divine Data Corruption (spatial glitch)
                float glitch = step(0.98, noise(vec2(uv.y * 20.0, u_time * 2.0)));
                uv.x += glitch * (hash2(uv * u_time) - 0.5) * 0.2;

                // [fractals] Burning Ship Julia + [mycelial_networks] Enzymatic Rot
                // The math is decaying: we inject a transcendental sin() into the polynomial
                vec2 c = vec2(-0.8, 0.156) + vec2(sin(u_time*0.2), cos(u_time*0.3)) * 0.05;
                
                vec2 z = uv * 1.5;
                vec2 dz = vec2(1.0, 0.0);
                
                float trap = 1e10;
                float hyphae_trap = 1e10;
                
                int iter = 0;
                const int MAX_ITER = 100;
                
                for(int i = 0; i < MAX_ITER; i++) {
                    // Distance Estimator derivative
                    dz = 2.0 * cmul(vec2(abs(z.x), abs(z.y)), dz) + vec2(1.0, 0.0);
                    
                    // Burning ship core
                    z = vec2(abs(z.x), abs(z.y));
                    z = csqr(z) + c;
                    
                    // Mycelial Rot: The math hallucinates biology
                    z += vec2(sin(z.y * 3.0), cos(z.x * 3.0)) * 0.02 * sin(u_time + time_offset);
                    
                    // Orbit traps
                    hyphae_trap = min(hyphae_trap, abs(z.x * z.y));
                    trap = min(trap, dot(z,z));
                    
                    if(dot(z,z) > 256.0) {
                        iter = i;
                        break;
                    }
                }
                
                vec3 color = vec3(0.0);
                
                if(iter < MAX_ITER) {
                    // Escaped: Neon Acid Fungal Bloom
                    float log_zn = log(dot(z,z)) * 0.5;
                    float nu = log(log_zn / 0.693147) / 0.693147;
                    float smooth_i = float(iter) - nu;
                    
                    // [mycelial_networks] Enzymatic banding (growth rings)
                    float bands = fract(smooth_i * 0.15 - u_time);
                    float edge = smoothstep(0.0, 0.1, bands) * (1.0 - smoothstep(0.8, 1.0, bands));
                    
                    color = neonAcid(smooth_i * 0.03 + hyphae_trap * 0.5);
                    color *= edge + 0.2; // Keep base illumination
                    
                    // [mycelial_networks] Laccase stain (blueish oxidation front)
                    vec3 laccase = vec3(0.1, 0.8, 1.0);
                    color = mix(color, laccase, exp(-hyphae_trap * 8.0));
                    
                } else {
                    // Interior: [retrofuturism] Y2K Chrome Bubble + [structural_color] Thin Film
                    float de = sqrt(dot(z,z) / dot(dz,dz)) * log(dot(z,z)) * 0.5;
                    
                    // Fake normal from distance field proximity
                    vec3 normal = normalize(vec3(z.x, z.y, 0.5));
                    float cosTheta = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
                    
                    // Iridescence thickness modulated by fungal trap
                    float thickness = 200.0 + 800.0 * trap + sin(u_time * 2.0) * 100.0;
                    color = thinFilm(cosTheta, thickness);
                    
                    // Y2K Gloss Specular
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    vec3 viewDir = vec3(0.0, 0.0, 1.0);
                    vec3 halfDir = normalize(lightDir + viewDir);
                    float spec = pow(max(0.0, dot(normal, halfDir)), 64.0);
                    
                    color += vec3(1.0) * spec * 1.5;
                }
                
                return color;
            }

            void main() {
                // [THE-LISTS] RGB Phase Bleed (Chromatic Aberration)
                float aberration = 0.008 + noise(vec2(u_time)) * 0.01;
                
                vec3 col;
                col.r = renderFractal(vec2(aberration, 0.0), 0.0).r;
                col.g = renderFractal(vec2(0.0, 0.0), 0.1).g;
                col.b = renderFractal(vec2(-aberration, 0.0), 0.2).b;
                
                // Vignette
                float dist = length(vUv - 0.5);
                col *= 1.0 - smoothstep(0.4, 0.9, dist);
                
                // [color_fields] ACES Filmic Tonemapping approximation
                col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
                
                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            depthWrite: false,
            depthTest: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral Design-Brain WebGL Error:", e);
    // Failsafe 2D glitch execution if WebGL is unavailable
    if (ctx && !ctx.bindBuffer) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#ff00ff';
        ctx.font = '20px monospace';
        ctx.fillText("DIVINE DATA CORRUPTION: WEBGL CONTEXT LOST", 20, grid.height / 2);
    }
}