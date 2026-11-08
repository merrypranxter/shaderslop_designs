if (!canvas.__state) {
    canvas.__state = {
        customTime: 0,
        lastTime: time,
        paused: false,
        seed: Math.random() * 100.0,
        bound: false
    };
}

let state = canvas.__state;
let dt = time - state.lastTime;
state.lastTime = time;

if (!state.paused) {
    state.customTime += dt;
}

if (!state.bound) {
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            state.paused = !state.paused;
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'r') {
            state.seed = Math.random() * 100.0;
        }
        if (e.key.toLowerCase() === 's') {
            const link = document.createElement('a');
            link.download = 'feral_burning_ship.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    });
    state.bound = true;
}

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL2 context required");
        
        const renderer = new THREE.WebGLRenderer({ 
            canvas, 
            context: ctx, 
            alpha: true, 
            antialias: true, 
            preserveDrawingBuffer: true 
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
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
            uniform float u_seed;

            // Helper for random noise
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            // Palette: Acid Vibration + Cyberdelic Neon
            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.6, 0.4, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67) + u_seed;
                return a + b * cos(6.28318 * (c * t + d));
            }

            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            vec2 complexSq(vec2 z) {
                return vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y);
            }

            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Mouse interaction
                vec2 m = u_mouse * 2.0 - 1.0;

                // Glitch/Chromatic Shearing (CRT/VHS effect)
                float glitch = step(0.98, fract(sin(u_time * 10.0 + uv.y * 50.0) * 43758.5453));
                vec2 glitchOffset = vec2(glitch * 0.08 * sin(u_time * 30.0), 0.0);
                vec2 baseUv = uv + glitchOffset;

                // Camera/Zoom setup (Targeting the Burning Ship 'armada')
                float t = u_time * 0.15;
                float zoom = 0.015 + 0.014 * sin(t); // Deep zoom oscillation
                vec2 target = vec2(-1.765, -0.035);
                
                // Subtle rotation and drift
                baseUv *= rot(sin(t * 0.5) * 0.1);
                target += vec2(sin(t*1.3), cos(t*1.7)) * 0.005; 
                
                vec2 c = baseUv * zoom + target;
                c += m * zoom * 0.5; // Mouse pan

                // Fluid distortion / Heat-haze warping
                vec2 warp = vec2(sin(c.y * 800.0 + u_time * 5.0), cos(c.x * 800.0 - u_time * 4.0)) * 0.00005;
                c += warp;

                // Burning Ship Engine
                vec2 z = vec2(0.0);
                float iter = 0.0;
                float trap1 = 1e10; // Cross trap
                float trap2 = 1e10; // Circular trap
                const float MAX_ITER = 200.0;

                for (float i = 0.0; i < MAX_ITER; i++) {
                    z = vec2(abs(z.x), abs(z.y));
                    z = complexSq(z) + c;
                    
                    trap1 = min(trap1, abs(z.x + z.y));
                    trap2 = min(trap2, length(z));

                    if (dot(z, z) > 256.0) {
                        float log_zn = log(dot(z, z)) * 0.5;
                        float nu = log(log_zn / 0.6931471806) / 0.6931471806;
                        iter = i + 1.0 - nu;
                        break;
                    }
                }

                vec3 col = vec3(0.0);

                if (iter < MAX_ITER) {
                    float norm_iter = iter / 60.0;
                    
                    // Base coloring via palette
                    // Shift RGB channels slightly for chromatic aberration
                    float r = palette(norm_iter - u_time * 0.1).r;
                    float g = palette(norm_iter - u_time * 0.1 + 0.03).g;
                    float b = palette(norm_iter - u_time * 0.1 + 0.06).b;
                    col = vec3(r, g, b);

                    // Op-Art Contour Banding
                    float contour = fract(iter * 4.0 - u_time * 3.0);
                    float band = smoothstep(0.0, 0.1, contour) - smoothstep(0.1, 0.2, contour);
                    
                    // Holographic Iridescence on edges
                    vec3 iridescence = 0.5 + 0.5 * cos(u_time * 3.0 + trap1 * 30.0 + vec3(0, 2, 4));
                    col += band * iridescence * 1.8;

                    // Moiré Interference ripples around recursive edges
                    float moire = sin(length(z) * 80.0 - u_time * 15.0) * 0.5 + 0.5;
                    col += vec3(0.0, 0.9, 0.8) * moire * 0.4 * smoothstep(0.0, 1.0, trap2);
                    
                    // Crystalline specular glints
                    float glint = pow(1.0 - fract(trap2 * 8.0 + u_time), 25.0);
                    col += vec3(1.0) * glint * 1.5;

                    // Reaction-Diffusion Bloom (approximated via trap distance)
                    float bloom = exp(-trap1 * 4.0);
                    col += vec3(1.0, 0.0, 0.6) * bloom * 0.8; // Hot pink glow

                } else {
                    // Interior "Void" - Cathedral inferno
                    float interiorGlow = exp(-trap2 * 12.0);
                    float pulse = sin(u_time * 4.0 - length(baseUv)*10.0) * 0.5 + 0.5;
                    col = mix(vec3(0.1, 0.0, 0.2), vec3(1.0, 0.3, 0.0), interiorGlow * pulse);
                }

                // CRT / VHS Post-Processing
                // Scanlines
                float scanline = sin(vUv.y * u_resolution.y * 1.5) * 0.05;
                col -= scanline;

                // Phosphor flicker
                float flicker = random(uv + u_time) * 0.06;
                col += flicker;

                // Vignette
                float vignette = length(vUv - 0.5);
                col *= smoothstep(0.85, 0.2, vignette);

                // Clamp & Output
                fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_seed: { value: state.seed }
            },
            depthWrite: false,
            depthTest: false
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
    material.uniforms.u_time.value = state.customTime;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    let targetMx = mouse.isPressed ? mouse.x / grid.width : 0.5;
    let targetMy = mouse.isPressed ? 1.0 - (mouse.y / grid.height) : 0.5;
    
    material.uniforms.u_mouse.value.x += (targetMx - material.uniforms.u_mouse.value.x) * 0.05;
    material.uniforms.u_mouse.value.y += (targetMy - material.uniforms.u_mouse.value.y) * 0.05;
    
    material.uniforms.u_seed.value = state.seed;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);