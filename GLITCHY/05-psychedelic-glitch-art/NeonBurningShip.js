if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            uniform float u_mouse_pressed;
            uniform float u_seed;

            #define MAX_ITER 120

            // Hashing for noise and glitch
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            float rand(vec2 n) {
                return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
            }

            // Quasicrystal geometry for the interior "abyss"
            float quasicrystal(vec2 p) {
                float q = 0.0;
                for(int i = 0; i < 5; i++) {
                    float a = float(i) * 3.14159 / 5.0;
                    q += cos(dot(p, vec2(cos(a), sin(a))) + u_time * 1.5);
                }
                return q * 0.1 + 0.5;
            }

            // Core Burning Ship Engine with Orbit Traps and Distance Estimation
            vec3 getShip(vec2 c, vec2 uv) {
                vec2 z = vec2(0.0);
                float iter = 0.0;
                float trap1 = 1e20; // Faceting trap (Bismuth / mineral structure)
                float trap2 = 1e20; // Core distance
                vec2 dz = vec2(1.0, 0.0);
                float m2 = 0.0;

                for(int i = 0; i < MAX_ITER; i++) {
                    vec2 absZ = abs(z);

                    // Distance estimator derivative: dz = 2 * |z| * dz + 1
                    dz = 2.0 * vec2(absZ.x * dz.x - absZ.y * dz.y, absZ.x * dz.y + absZ.y * dz.x) + vec2(1.0, 0.0);

                    // Burning ship formula: z = (|Re(z)| + i|Im(z)|)^2 + c
                    z = vec2(absZ.x * absZ.x - absZ.y * absZ.y, 2.0 * absZ.x * absZ.y) + c;
                    m2 = dot(z, z);

                    // Record traps
                    trap1 = min(trap1, abs(z.x + z.y)); 
                    trap2 = min(trap2, length(z));

                    if(m2 > 256.0) break;
                    iter++;
                }

                if(iter >= float(MAX_ITER)) {
                    // Inside the set: return quasicrystal echo
                    float qc = quasicrystal(uv * 150.0);
                    return vec3(-1.0, qc, 0.0);
                }

                // Smooth iteration (continuous escape time)
                float nu = log(log(m2) * 0.5) / log(2.0);
                float smoothIter = iter + 1.0 - nu;

                // Distance estimator (for luminous structural bloom)
                float de = sqrt(m2 / dot(dz, dz)) * 0.5 * log(m2);

                return vec3(smoothIter, trap1, de);
            }

            // Loud, saturated, maximalist palette (Acid/Neon)
            vec3 palette(float t) {
                vec3 a = vec3(0.5);
                vec3 b = vec3(0.5);
                vec3 c = vec3(2.0, 1.0, 0.0);
                vec3 d = vec3(0.5, 0.2, 0.25) + u_seed;
                vec3 p = a + b * cos(6.28318 * (c * t + d));
                
                // Oversaturate for that cyberdelic neon look
                return mix(vec3(dot(p, vec3(0.333))), p, 1.6);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * u_resolution / u_resolution.y;

                // Fluid distortion / Heat-haze warping
                float haze = sin(uv.y * 25.0 + u_time * 2.0) * cos(uv.x * 15.0 - u_time) * 0.0015;
                uv.x += haze;

                // Glitchcore / VHS tearing based on mouse input
                float glitchIntensity = 0.02 + u_mouse_pressed * 0.08;
                float tear = step(0.99, hash(vec2(floor(uv.y * 60.0), u_time * 10.0))) * glitchIntensity * u_mouse.x;
                uv.x += tear;

                // Animation: Ominous breathing zoom
                float zoomPhase = sin(u_time * 0.12);
                float zoom = 0.05 * exp(zoomPhase * 2.2); 

                // Target center: a dramatic spire in the Burning Ship
                vec2 center = vec2(-1.758, -0.035);
                
                // Slow drift
                center += vec2(sin(u_time * 0.08), cos(u_time * 0.11)) * 0.003;
                
                // Mouse panning
                center += (u_mouse - 0.5) * 0.05 * zoom;

                // Map to complex plane
                vec2 c = uv * zoom + center;

                // Subtle rotational instability (breathing motion)
                float angle = sin(u_time * 0.2) * 0.015;
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                c = rot * c;

                // Chromatic Aberration / CMYK misregistration logic
                float ca = 0.003 * zoom * (1.0 + u_mouse_pressed * 3.0);
                vec2 cR = c + vec2(ca, ca * 0.5);
                vec2 cG = c;
                vec2 cB = c - vec2(ca, ca * 0.5);

                vec3 resR = getShip(cR, uv);
                vec3 resG = getShip(cG, uv);
                vec3 resB = getShip(cB, uv);

                vec3 color = vec3(0.0);

                // Process Red Channel
                if(resR.x < 0.0) {
                    color.r = resR.y * 0.15; // Abyss echo
                } else {
                    float t = resR.x * 0.04 - u_time * 0.2;
                    float band = smoothstep(0.4, 0.6, sin(resR.x * 6.0 - u_time * 4.0)); // Op-art contour
                    float facet = smoothstep(0.0, 0.05, fract(resR.y * 30.0)) * smoothstep(1.0, 0.95, fract(resR.y * 30.0)); // Crystalline shards
                    color.r = palette(t).r * (0.5 + 0.5 * band) + facet * 0.4;
                }

                // Process Green Channel
                if(resG.x < 0.0) {
                    color.g = resG.y * 0.08;
                } else {
                    float t = resG.x * 0.04 - u_time * 0.2 + 0.1;
                    float band = smoothstep(0.4, 0.6, sin(resG.x * 6.0 - u_time * 4.0));
                    float facet = smoothstep(0.0, 0.05, fract(resG.y * 30.0)) * smoothstep(1.0, 0.95, fract(resG.y * 30.0));
                    color.g = palette(t).g * (0.5 + 0.5 * band) + facet * 0.4;
                }

                // Process Blue Channel
                if(resB.x < 0.0) {
                    color.b = resB.y * 0.3;
                } else {
                    float t = resB.x * 0.04 - u_time * 0.2 + 0.2;
                    float band = smoothstep(0.4, 0.6, sin(resB.x * 6.0 - u_time * 4.0));
                    float facet = smoothstep(0.0, 0.05, fract(resB.y * 30.0)) * smoothstep(1.0, 0.95, fract(resB.y * 30.0));
                    color.b = palette(t).b * (0.5 + 0.5 * band) + facet * 0.4;
                }

                // Luminous Edge Definition (Reaction-Diffusion bloom proxy)
                if (resG.x > 0.0) {
                    float deGlow = exp(-resG.z * 120.0 / zoom);
                    vec3 glowColor = palette(resG.x * 0.015 - u_time * 0.1);
                    color += glowColor * deGlow * 1.8;
                }

                // Moiré Halftone Overlay (psychedelic_collage print artifact)
                float luma = dot(color, vec3(0.299, 0.587, 0.114));
                float freq = 180.0;
                vec2 rotUV2 = vec2(uv.x * 0.707 - uv.y * 0.707, uv.x * 0.707 + uv.y * 0.707);
                vec2 cell = fract(rotUV2 * freq) - 0.5;
                float dotRadius = sqrt(1.0 - clamp(luma, 0.0, 1.0)) * 0.45;
                float ht = smoothstep(dotRadius + 0.05, dotRadius - 0.05, length(cell));
                
                // Screen blend the halftone
                color = color + (color * ht * 0.5);

                // CRT / Scanline shimmer
                float scanline = sin(vUv.y * u_resolution.y * 0.6) * 0.03;
                color -= scanline;
                
                // Film grain / Noise ritual
                color *= 1.0 - 0.15 * rand(vUv * u_time);

                // Vignette
                float vig = length(vUv - 0.5);
                color *= smoothstep(0.75, 0.2, vig);

                fragColor = vec4(color, 1.0);
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
                u_mouse_pressed: { value: 0.0 },
                u_seed: { value: Math.random() * 10.0 }
            }
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };

        canvas.__state = {
            internalTime: 0,
            lastTime: time,
            paused: false,
            seed: Math.random() * 100.0
        };

        if (!canvas.__keysAttached) {
            window.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 's') {
                    const link = document.createElement('a');
                    link.download = 'burning_ship_monument.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }
                if (e.key.toLowerCase() === 'r') {
                    canvas.__state.seed = Math.random() * 100.0;
                    if (canvas.__three?.material?.uniforms?.u_seed) {
                        canvas.__three.material.uniforms.u_seed.value = canvas.__state.seed;
                    }
                }
                if (e.key === ' ') {
                    canvas.__state.paused = !canvas.__state.paused;
                    e.preventDefault();
                }
            });
            canvas.__keysAttached = true;
        }

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;
const state = canvas.__state;

const dt = time - state.lastTime;
state.lastTime = time;

if (!state.paused) {
    state.internalTime += dt;
}

if (material?.uniforms) {
    material.uniforms.u_time.value = state.internalTime;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);

    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    material.uniforms.u_mouse.value.set(mx, my);
    material.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);