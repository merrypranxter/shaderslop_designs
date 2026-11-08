if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        
        // Orthographic camera for full-screen quad
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

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
            uniform vec2 u_mouse;
            uniform float u_seed;

            #define MAX_STEPS 80
            #define MAX_DIST 25.0
            #define SURF_DIST 0.002
            #define ITERS 8

            // 2D Rotation Matrix
            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // High-tension Cyberdelic Palette (OKLab inspired)
            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.4, 0.6); 
                vec3 b = vec3(0.6, 0.5, 0.6); 
                vec3 c = vec3(1.0, 1.0, 1.0); 
                vec3 d = vec3(0.0, 0.33, 0.67) + u_seed; 
                vec3 col = a + b * cos(6.28318 * (c * t + d));
                
                // Inject neon bursts
                col = mix(col, vec3(1.0, 0.0, 0.5), smoothstep(0.8, 1.0, sin(t * 15.0))); // Hot Pink
                col = mix(col, vec3(0.0, 1.0, 0.8), smoothstep(0.8, 1.0, cos(t * 11.0))); // Electric Teal
                col = mix(col, vec3(0.8, 1.0, 0.0), smoothstep(0.9, 1.0, sin(t * 7.0)));  // Acid Yellow
                
                return col;
            }

            // Pseudo-random hash
            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            // Sierpinski Tetrahedron Distance Estimator (Folded Space)
            float de(vec3 p, out vec4 trap) {
                // Infinite recursive lattice (Domain Repetition)
                float spacing = 3.5;
                p.xyz = mod(p.xyz + spacing * 0.5, spacing) - spacing * 0.5;

                // Subtle spatial twist (Reaction-Diffusion like warp)
                p.xy *= rot(sin(p.z * 0.5 + u_time * 0.2) * 0.1);

                // Breathing recursion scale (Quasicrystal shifting)
                float scale = 2.0 + 0.08 * sin(u_time * 0.4); 
                vec3 offset = vec3(1.0);
                float dr = 1.0;

                trap = vec4(1e4);

                for(int i = 0; i < ITERS; i++) {
                    // Angular triangular folds
                    if(p.x + p.y < 0.0) p.xy = -p.yx;
                    if(p.x + p.z < 0.0) p.xz = -p.zx;
                    if(p.y + p.z < 0.0) p.yz = -p.zy;

                    p = p * scale - offset * (scale - 1.0);
                    dr *= scale;

                    // Orbit traps for color/glow mapping
                    trap.x = min(trap.x, length(p.xy)); // Edge glints
                    trap.y = min(trap.y, length(p.yz)); // Face bloom
                    trap.z = min(trap.z, length(p.xz)); // Structure
                    trap.w = min(trap.w, length(p));    // Vertices
                }

                return (length(p) - 1.5) / dr;
            }

            // Normal calculation
            vec3 getNormal(vec3 p) {
                vec4 t;
                float d = de(p, t);
                vec2 e = vec2(0.002, 0.0);
                return normalize(vec3(
                    de(p + e.xyy, t) - d,
                    de(p + e.yxy, t) - d,
                    de(p + e.yyx, t) - d
                ));
            }

            // Moiré Interference Pattern
            float moire(vec2 uv) {
                float f1 = sin((uv.x + uv.y) * 300.0);
                float f2 = sin((uv.x - uv.y) * 300.0 + u_time * 2.0);
                return smoothstep(0.0, 0.5, f1 * f2);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Camera setup
                // Mouse X controls lateral pan/rotation, Mouse Y controls glitch intensity
                vec3 ro = vec3(
                    sin(u_time * 0.2 + u_mouse.x * 2.0) * 0.5,
                    cos(u_time * 0.3) * 0.5,
                    u_time * 1.5 // Constant forward motion through the lattice
                );
                
                vec3 rd = normalize(vec3(uv, 1.0));
                
                // Fluid/Ripple distortion on the view ray
                float ripple = sin(length(uv) * 15.0 - u_time * 3.0) * 0.015;
                rd.xy += ripple;
                rd.xy *= rot(sin(u_time * 0.1) * 0.3 + u_mouse.x * 0.5);

                float t = 0.0;
                vec3 p;
                vec4 trap = vec4(0.0);
                float steps = 0.0;

                // Raymarching
                for(int i = 0; i < MAX_STEPS; i++) {
                    p = ro + rd * t;
                    vec4 curTrap;
                    float d = de(p, curTrap);
                    trap += curTrap;
                    if(d < SURF_DIST || t > MAX_DIST) break;
                    t += d;
                    steps += 1.0;
                }

                trap /= steps; // Normalize traps

                vec3 col = vec3(0.0);

                if(t < MAX_DIST) {
                    vec3 n = getNormal(p);
                    vec3 v = normalize(ro - p);
                    vec3 l = normalize(vec3(1.0, 2.0, -1.0)); // Light dir

                    float diff = max(dot(n, l), 0.0);
                    float spec = pow(max(dot(reflect(-l, n), v), 0.0), 64.0);
                    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);

                    // Base holographic color
                    vec3 baseCol = palette(trap.w * 0.2 + p.z * 0.1 - u_time * 0.1);

                    // Op-art line striping on planes
                    float opArt = smoothstep(0.4, 0.6, sin(p.x * 50.0) * sin(p.y * 50.0));
                    baseCol = mix(baseCol, vec3(0.1), opArt * 0.3);

                    col = baseCol * (diff * 0.7 + 0.3);

                    // Luxurious / Crystalline Accents
                    col += vec3(1.0, 0.1, 0.7) * smoothstep(0.15, 0.0, trap.x) * 2.5; // Hot pink angular cascades
                    col += vec3(0.0, 1.0, 0.8) * smoothstep(0.2, 0.0, trap.y) * 1.5;  // Teal recursive voids
                    col += vec3(0.9, 1.0, 0.2) * spec * 3.0;                          // Acid yellow specular glints
                    col += vec3(0.6, 0.1, 1.0) * fresnel * 2.0;                       // Purple aura

                    // Depth fog (Mystical Void)
                    col = mix(col, vec3(0.03, 0.0, 0.08), smoothstep(MAX_DIST * 0.3, MAX_DIST, t));
                } else {
                    // Background void
                    col = vec3(0.03, 0.0, 0.08) + palette(uv.y + u_time * 0.2) * 0.05;
                }

                // --- Psychedelic Collage & Glitchcore Post-Processing ---

                // Screen-Space Chromatic Aberration via Derivatives (Hardware Magic)
                float edge = length(dFdx(col)) + length(dFdy(col));
                float glitchIntensity = 0.5 + u_mouse.y * 3.0; // Mouse Y drives chaos
                
                // RGB split on high-contrast edges
                col.r += edge * 0.5 * glitchIntensity * sin(u_time * 12.0);
                col.b += edge * 0.5 * glitchIntensity * cos(u_time * 15.0);

                // Moiré Interference Overlay (Structural Shine)
                float m = moire(uv + u_time * 0.02);
                col += m * 0.15 * vec3(0.0, 0.8, 1.0); // Cyan structural weave

                // CRT / VHS Shimmer & Scanlines
                float scanline = sin(vUv.y * u_resolution.y * 2.5) * 0.05;
                col -= scanline;
                
                // Temporal Flicker
                col *= 1.0 + 0.04 * sin(u_time * 45.0 + uv.y * 10.0); 

                // Tone mapping
                col = smoothstep(0.0, 1.2, col);
                col = pow(col, vec3(0.85)); // Contrast punch

                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_seed: { value: 0.0 }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
        canvas.__paused = false;

        // --- Interaction Handlers ---
        if (!canvas.__handlersAttached) {
            canvas.__handlersAttached = true;
            
            // Mouse Interaction
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                if (canvas.__three && canvas.__three.material) {
                    canvas.__three.material.uniforms.u_mouse.value.set(
                        (e.clientX - rect.left) / rect.width,
                        1.0 - (e.clientY - rect.top) / rect.height
                    );
                }
            });

            // Keyboard Interaction
            window.addEventListener('keydown', (e) => {
                const key = e.key.toLowerCase();
                if (key === 's') {
                    // Save Screenshot
                    const dataURL = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'sierpinski_acid_tapestry.png';
                    link.click();
                } else if (key === 'r') {
                    // Reseed / Palette Shift (Golden Ratio step)
                    if (canvas.__three && canvas.__three.material) {
                        canvas.__three.material.uniforms.u_seed.value += 0.618033;
                    }
                } else if (key === ' ') {
                    // Pause/Play
                    e.preventDefault();
                    canvas.__paused = !canvas.__paused;
                }
            });
        }
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    if (!canvas.__paused) {
        material.uniforms.u_time.value = time;
    }
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);