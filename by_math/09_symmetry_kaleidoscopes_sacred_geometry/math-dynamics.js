if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        // Use an Orthographic camera for a full-screen quad shader
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float u_time;
            uniform vec2 u_resolution;
            in vec2 vUv;
            out vec4 fragColor;

            #define MAX_STEPS 90
            #define MAX_DIST 12.0
            #define SURF_DIST 0.005

            // --- REPO 4: Psychedelic Collage (Kaleidoscope & Distortion) ---
            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // Hexagonal mirror fold mapping to Crystalline P6/mmm Space Group
            vec2 foldHex(vec2 p) {
                p.x = abs(p.x);
                vec2 n1 = vec2(-0.866025, 0.5); // 150 degrees
                vec2 n2 = vec2(-0.5, 0.866025); // 120 degrees
                p -= 2.0 * min(0.0, dot(p, n1)) * n1;
                p -= 2.0 * min(0.0, dot(p, n2)) * n2;
                p.x = abs(p.x);
                return p;
            }

            // --- REPO 2: Vibration Physics (Chladni Modal Analysis) ---
            // Simulates the physical displacement of a plate at specific eigenfrequencies
            float chladni(vec3 p, float m, float n) {
                float pi = 3.14159265;
                return sin(n * pi * p.x) * sin(m * pi * p.y) - sin(m * pi * p.x) * sin(n * pi * p.y);
            }

            // --- REPO 1 & 3: Crystalline Math + Lisa Frank Maximalism ---
            // SDF for a vibrating crystal lattice
            float getDist(vec3 p) {
                vec3 bp = p;
                
                // Deep time progression through the lattice
                p.z -= u_time * 0.3;
                
                // Apply radial symmetry fold (Occult Mandala / Hexagonal Crystal)
                p.xy = foldHex(p.xy);
                
                // Torsional strain
                p.xy *= rot(p.z * 0.15 + sin(u_time * 0.4) * 0.2);

                // Inject 40Hz Gamma / Chladni cymatic interference
                float vibration = chladni(p, 3.0, 5.0) * 0.2 * sin(u_time * 1.5);
                
                // Cubic Ia3d Space Group (Gyroid) representing the atomic lattice
                float scale = 3.5;
                vec3 q = p * scale;
                float lattice = dot(sin(q + vec3(vibration)), cos(q.zxy)) / scale;
                
                // Hollow out the lattice to create physical thickness (struts)
                lattice = abs(lattice) - 0.06;

                // Bind the infinite lattice inside a carved cylindrical void
                float voidBoundary = length(bp.xy) - 1.8 + sin(bp.z * 2.0 + u_time) * 0.2;
                
                // Smooth boolean intersection for organic, melting crystal feel
                return max(lattice, -voidBoundary);
            }

            // Calculate surface normal
            vec3 getNormal(vec3 p) {
                float d = getDist(p);
                vec2 e = vec2(0.002, 0.0);
                vec3 n = d - vec3(
                    getDist(p - e.xyy),
                    getDist(p - e.yxy),
                    getDist(p - e.yyx)
                );
                return normalize(n);
            }

            // --- REPO 3 & 4: Acid Vibration / Cyberdelic Neon Palette ---
            vec3 palette(float t) {
                // Highly saturated, clashing complementary cosine gradient
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 0.5);
                vec3 d = vec3(0.80, 0.90, 0.30);
                return a + b * cos(6.28318 * (c * t + d));
            }

            // --- REPO 4: Print Artifacts (Halftone Screen) ---
            float halftone(vec2 uv, float luma) {
                // Rotate screen by 45 degrees
                float rad = 0.785398; 
                mat2 rotMat = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                vec2 grid = fract(rotMat * uv * 140.0) - 0.5;
                float radius = sqrt(1.0 - luma) * 0.6;
                return smoothstep(radius + 0.1, radius - 0.1, length(grid));
            }

            void main() {
                // Normalize pixel coordinates (from -1 to 1)
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Camera setup
                vec3 ro = vec3(0.0, 0.0, -3.0);
                vec3 rd = normalize(vec3(uv, 1.0));

                float d0 = 0.0;
                float volumetricGlow = 0.0;
                vec3 p;

                // Raymarching Loop
                for(int i = 0; i < MAX_STEPS; i++) {
                    p = ro + rd * d0;
                    float dS = getDist(p);
                    
                    // Accumulate density for Cyberdelic Neon glow
                    volumetricGlow += 0.012 / (0.01 + abs(dS));
                    
                    if(abs(dS) < SURF_DIST || d0 > MAX_DIST) break;
                    
                    // Sub-stepping to prevent artifacts in heavily folded/warped space
                    d0 += dS * 0.6; 
                }

                // Base void color (Deep space / Occult background)
                vec3 col = vec3(0.02, 0.01, 0.04);

                if(d0 < MAX_DIST) {
                    vec3 n = getNormal(p);
                    
                    // Map spatial coordinates and time to the Acid palette
                    float t = length(p) * 0.15 + n.x * 0.3 - u_time * 0.2;
                    vec3 materialColor = palette(t);

                    // Lighting (Simulating Birefringence and Iridescence)
                    vec3 lightDir = normalize(vec3(sin(u_time), 1.0, -1.0));
                    float diff = max(dot(n, lightDir), 0.0);
                    
                    // Extreme fresnel for crystal edge highlighting
                    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
                    
                    // Mix diffuse with Hot Magenta / Cyan edge fringes
                    col = materialColor * (diff * 0.8 + 0.2);
                    col += fresnel * vec3(1.0, 0.0, 0.8) * 1.5; 
                }

                // Inject the accumulated volumetric feedback glow
                vec3 glowColor = palette(volumetricGlow * 0.05 - u_time * 0.1);
                col += glowColor * volumetricGlow * 0.1;

                // --- POST-PROCESSING: Zine / Collage Print Artifacts ---
                
                // CMYK Misregistration (Chromatic Aberration) fake
                float rShift = getDist(p + vec3(0.05, 0.0, 0.0)) * 0.1;
                float bShift = getDist(p - vec3(0.05, 0.0, 0.0)) * 0.1;
                col.r += rShift;
                col.b += bShift;

                // Halftone Pass
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                float ht = halftone(vUv, luma);
                
                // Multiply blend the halftone dots to simulate ink on paper
                col = mix(col, col * ht * 1.2, 0.35);

                // Optical Vignette
                float vig = length(vUv - 0.5) * 2.0;
                col *= 1.0 - pow(vig, 2.5) * 0.4;

                // ACES Tonemapping for neon intensity management
                col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed. The feral math requires WebGL2.", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    if (material.uniforms.u_time) {
        material.uniforms.u_time.value = time;
    }
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);