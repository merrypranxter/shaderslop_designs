// The Feral Burning Ship: A Psychedelic Recursive Disaster Monument
// Powered by Three.js & GLSL3

if (!window.__feralState) {
    window.__feralState = {
        seed: Math.random() * 100.0,
        paused: false,
        timeAcc: 0,
        lastTime: performance.now()
    };

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 's') {
            const link = document.createElement('a');
            link.download = `feral_burning_ship_${Date.now()}.png`;
            link.href = document.querySelector('canvas').toDataURL('image/png');
            link.click();
        }
        if (key === 'r') {
            window.__feralState.seed = Math.random() * 100.0;
        }
        if (key === ' ') {
            window.__feralState.paused = !window.__feralState.paused;
            e.preventDefault();
        }
    });
}

// Calculate delta time for pause functionality
const now = performance.now();
const dt = (now - window.__feralState.lastTime) / 1000.0;
window.__feralState.lastTime = now;
if (!window.__feralState.paused) {
    window.__feralState.timeAcc += dt;
}

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false, preserveDrawingBuffer: true });
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
            precision highp float;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_seed;

            in vec2 vUv;
            out vec4 fragColor;

            #define MAX_ITER 110.0
            #define BAILOUT 256.0

            // Saturated, feral palette function
            vec3 palette(float t) {
                // Base neon-acid cosine palette
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.1, 0.8, 0.4) + u_seed;
                vec3 col = a + b * cos(6.28318 * (c * t + d));
                
                // Push extremes for that hot-pink/cyan/lava look
                col = mix(col, vec3(1.0, 0.0, 0.5), 0.3 * sin(t * 10.0)); // Hot Pink
                col = mix(col, vec3(1.0, 0.3, 0.0), 0.3 * cos(t * 15.0)); // Lava Orange
                col = mix(col, vec3(0.0, 1.0, 0.8), 0.3 * sin(t * 7.0));  // Electric Teal
                
                return clamp(col, 0.0, 1.0);
            }

            // Core Fractal Engine
            vec3 getFractal(vec2 c, vec2 offset) {
                vec2 z = vec2(0.0);
                float iter = 0.0;
                
                float trap1 = 1e10; // Structural scaffolding
                float trap2 = 1e10; // Void cores
                float glow = 0.0;   // Reaction-diffusion style bloom
                
                // Domain warp / Heat haze
                c += offset;
                c.x += sin(c.y * 30.0 + u_time * 2.0) * 0.0005;
                c.y += cos(c.x * 25.0 - u_time * 1.5) * 0.0005;

                // Feral mutation: slight continuous rotational fold to break perfect symmetry
                float a = sin(u_time * 0.1) * 0.05;
                mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));

                for(float i = 0.0; i < MAX_ITER; i++) {
                    // Burning Ship absolute fold
                    z = vec2(abs(z.x), abs(z.y));
                    
                    // Mutagenic rotation
                    z = rot * z; 
                    
                    // Complex squaring + c
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;

                    // Compute traps for structural rendering
                    trap1 = min(trap1, abs(z.x + z.y));
                    trap2 = min(trap2, length(z - vec2(0.5)));
                    glow += exp(-length(z) * 1.5);

                    if(dot(z,z) > BAILOUT) {
                        iter = i;
                        break;
                    }
                }

                // Smooth iteration count
                float sn = iter;
                if(iter < MAX_ITER - 0.5) {
                    sn = iter - log2(log2(dot(z,z))) + 4.0;
                }

                // --- COLOR SYNTHESIS ---
                vec3 col = vec3(0.0);

                if(iter < MAX_ITER - 0.5) {
                    // Exterior
                    float t = sn * 0.02 - u_time * 0.1;
                    col = palette(t);

                    // Op-Art Contour Banding
                    float band = smoothstep(0.4, 0.6, 0.5 + 0.5 * sin(sn * 20.0 - u_time * 10.0));
                    col = mix(col, vec3(0.02, 0.0, 0.05), band * 0.6);

                    // Moiré interference on edges
                    float moire = sin(trap1 * 150.0) * cos(trap2 * 120.0 + u_time * 5.0);
                    col += moire * 0.15 * vec3(1.0, 0.9, 0.1); // Acid yellow moiré sparks

                    // Crystalline structural glints
                    float glint = exp(-trap1 * 40.0);
                    col += glint * vec3(0.8, 0.2, 1.0);

                } else {
                    // Interior / Abyss
                    col = vec3(0.01, 0.0, 0.03); 
                    // Luminous void cores
                    col += vec3(0.0, 0.8, 1.0) * exp(-trap2 * 15.0) * (0.5 + 0.5 * sin(u_time * 3.0));
                }

                // Skeleton glow (Accumulated energy)
                vec3 glowCol = vec3(1.0, 0.2, 0.5) * (glow * 0.015);
                col += glowCol;

                return col;
            }

            void main() {
                vec2 uv = vUv;
                vec2 st = (uv - 0.5) * 2.0;
                st.x *= u_resolution.x / u_resolution.y;

                // Subtle camera drift and rotation
                float camRot = sin(u_time * 0.05) * 0.05;
                mat2 rotCam = mat2(cos(camRot), -sin(camRot), sin(camRot), cos(camRot));
                st = rotCam * st;

                // Mouse interaction for panning
                vec2 mouse = u_mouse * 2.0 - 1.0;
                mouse.y = -mouse.y; 

                // Base coordinates targeting the Burning Ship "armada"
                vec2 center = vec2(-1.75, -0.04) + mouse * 0.03;

                // Hypnotic breathing zoom
                float zoom = 0.025 + 0.015 * sin(u_time * 0.15);
                vec2 c = center + st * zoom;

                // Glitchcore / Digital Damage Vector
                vec2 glitchDir = vec2(sin(u_time * 12.0), cos(u_time * 17.0));
                // Sharp horizontal tearing
                float tear = step(0.98, fract(sin(uv.y * 150.0 + u_time * 5.0) * 43758.5453));
                vec2 glitchOffset = tear * glitchDir * 0.001 * zoom;

                // Chromatic Aberration / RGB Separation (3 passes)
                float rOffset = 0.001 * zoom;
                float bOffset = -0.001 * zoom;

                vec3 colR = getFractal(c, glitchOffset + vec2(rOffset, 0.0));
                vec3 colG = getFractal(c, glitchOffset);
                vec3 colB = getFractal(c, glitchOffset + vec2(bOffset, 0.0));

                vec3 finalCol = vec3(colR.r, colG.g, colB.b);

                // CRT / VHS Post-Processing
                // Scanlines
                float scanline = 0.9 + 0.1 * sin(uv.y * u_resolution.y * 2.0);
                finalCol *= scanline;

                // Vignette
                float vig = length(uv - 0.5) * 2.0;
                finalCol *= 1.0 - pow(vig, 2.5) * 0.6;

                // Phosphor Bloom (Overdrive brights)
                finalCol += pow(max(finalCol, 0.0), vec3(2.5)) * 0.5;

                // Noise dither to prevent banding
                float dither = fract(sin(dot(uv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
                finalCol += (dither - 0.5) * 0.03;

                fragColor = vec4(finalCol, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(mouse.x / grid.width, mouse.y / grid.height) },
                u_seed: { value: window.__feralState.seed }
            },
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("Feral Burning Ship Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = window.__feralState.timeAcc;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    material.uniforms.u_mouse.value.set(
        Math.max(0, Math.min(1, mouse.x / grid.width)),
        Math.max(0, Math.min(1, mouse.y / grid.height))
    );
    material.uniforms.u_seed.value = window.__feralState.seed;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);