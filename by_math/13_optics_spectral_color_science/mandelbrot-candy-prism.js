if (!canvas.__state) {
    canvas.__state = {
        center: new THREE.Vector2(-0.5, 0.0),
        zoom: 2.5,
        seed: Math.random(),
        paused: false,
        timeOffset: 0,
        lastTime: time,
        eventsBound: false,
        userInteracted: false
    };
}

const state = canvas.__state;

if (!state.eventsBound) {
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ') state.paused = !state.paused;
        if (e.key.toLowerCase() === 'r') state.seed = Math.random();
        if (e.key.toLowerCase() === 's') {
            const link = document.createElement('a');
            link.download = `feral_mandelbrot_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    });
    state.eventsBound = true;
}

// Time integration
let dt = time - state.lastTime;
state.lastTime = time;
if (!state.paused) {
    state.timeOffset += dt;
}

// Deep dive logic (auto-pilot unless user interacts)
if (mouse.isPressed) {
    state.userInteracted = true;
}

if (!state.userInteracted) {
    // Auto dive into the Seahorse Valley / Deep Minibrot
    let cycle = (state.timeOffset * 0.03) % 1.0; 
    let ease = 1.0 - Math.pow(1.0 - cycle, 4.0); // smooth plunge
    
    state.zoom = 2.5 * Math.pow(10, -ease * 5.0);
    
    let startX = -0.5, startY = 0.0;
    let targetX = -0.7435669, targetY = 0.1314023;
    
    state.center.x = startX + (targetX - startX) * ease;
    state.center.y = startY + (targetY - startY) * ease;
} else if (mouse.isPressed) {
    // If interacted, allow dragging the fractal
    let nx = (mouse.x / grid.width) * 2 - 1;
    let ny = -(mouse.y / grid.height) * 2 + 1;
    state.center.x += nx * state.zoom * 0.02;
    state.center.y += ny * state.zoom * 0.02;
}

// Map mouse position to glitch and phase (even during auto-pilot)
let mx = mouse.x / grid.width;
let my = mouse.y / grid.height;
let glitchStrength = 1.0 + (mx || 0) * 8.0;
let phaseOffset = (my || 0) * Math.PI * 2.0;

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
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
            uniform vec2 u_center;
            uniform float u_zoom;
            uniform float u_seed;
            uniform float u_glitch_strength;
            uniform float u_phase;

            #define MAX_ITER 200
            #define BAILOUT 256.0

            // --- COLOR SYSTEMS: OKLCh -> Linear sRGB -> sRGB ---
            vec3 OKLCh_to_OKLab(vec3 lch) {
                return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
            }

            vec3 OKLab_to_linearSRGB(vec3 c) {
                float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
                float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
                float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

                float l = l_*l_*l_;
                float m = m_*m_*m_;
                float s = s_*s_*s_;

                return vec3(
                     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                );
            }

            float linear_to_sRGB(float x) {
                return x <= 0.0031308 ? x * 12.92 : 1.055 * pow(max(x, 0.0), 1.0/2.4) - 0.055;
            }

            vec3 oklch_to_srgb(vec3 lch) {
                vec3 lin = OKLab_to_linearSRGB(OKLCh_to_OKLab(lch));
                return vec3(linear_to_sRGB(lin.r), linear_to_sRGB(lin.g), linear_to_sRGB(lin.b));
            }

            // --- CANDY PRISM PALETTE ---
            vec3 candy_palette(float t) {
                float h = t * 6.28318 + u_phase + u_seed * 10.0;
                float C = 0.28 + 0.08 * sin(t * 20.0 - u_time * 2.0); // High chroma neon
                float L = 0.65 + 0.15 * cos(t * 13.0 + u_time);       // Brightness variations
                return oklch_to_srgb(vec3(L, C, h));
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

                // Machine Hesitation / Glitch Prophet
                float hesitation = step(0.99, fract(sin(u_time * 13.0 + uv.y * 10.0) * 43758.5));
                uv.x += hesitation * 0.03 * sin(u_time * 50.0);

                vec2 c = uv * u_zoom + u_center;

                // Thermal Bloom / Undulating Math Distortion
                vec2 warp = vec2(sin(c.y * 30.0 / u_zoom + u_time * 3.0), cos(c.x * 30.0 / u_zoom + u_time * 2.5));
                c += warp * 0.001 * u_zoom * u_glitch_strength;

                vec2 z = vec2(0.0);
                vec2 dz = vec2(1.0, 0.0);
                float trap = 1e10;
                float n = 0.0;
                bool escaped = false;

                // Mandelbrot Iteration
                for(int i = 0; i < MAX_ITER; i++) {
                    // Distance estimator derivative: dz = 2 * z * dz + 1
                    dz = 2.0 * vec2(z.x*dz.x - z.y*dz.y, z.x*dz.y + z.y*dz.x) + vec2(1.0, 0.0);
                    // z = z^2 + c
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;

                    // Orbit traps (Cross and Circle)
                    float dCross = min(abs(z.x), abs(z.y));
                    float dCirc = abs(length(z) - 1.0);
                    trap = min(trap, min(dCross, dCirc));

                    if(dot(z,z) > BAILOUT) {
                        float log_zn = log(dot(z,z)) * 0.5;
                        float nu = log(log_zn / 0.69314718) / 0.69314718;
                        n = float(i) + 1.0 - nu;
                        escaped = true;
                        break;
                    }
                }

                vec3 color = vec3(0.0);

                if(!escaped) {
                    // The Ship / The Grey Room Interior
                    float t = trap * 5.0 - u_time * 0.5;
                    color = oklch_to_srgb(vec3(0.15 + 0.1*sin(t), 0.15, t * 2.0)); // Deep pulsing void
                    float grid = smoothstep(0.95, 1.0, sin(z.x * 50.0)) + smoothstep(0.95, 1.0, sin(z.y * 50.0));
                    color += grid * 0.15; // Austere mathematical grid
                } else {
                    // Exterior: Candy Prism + Op-Art
                    float de = sqrt(dot(z,z)/dot(dz,dz)) * log(dot(z,z)) * 0.5;
                    
                    float t_base = n * 0.02 - u_time * 0.15;

                    // Chromatic Aberration Offset
                    float offset = 0.005 * u_glitch_strength * (1.0 + 10.0 * hesitation);
                    float r = candy_palette(t_base).r;
                    float g = candy_palette(t_base + offset).g;
                    float b = candy_palette(t_base + offset * 2.0).b;
                    color = vec3(r, g, b);

                    // Op-Art Contour Bands
                    float bands = fract(n * 2.0 - u_time * 2.0);
                    float contour = smoothstep(0.85, 1.0, bands);
                    color = mix(color, vec3(1.0), contour * 0.6); // Sharp white rings

                    // Moiré Interference
                    float moire = sin(n * 15.0) * cos(n * 20.0 + u_time * 4.0);
                    color += moire * 0.2 * candy_palette(t_base + 0.5);

                    // Crystalline Edge Halos (Distance Estimator Glow)
                    float halo = exp(-de * (150.0 + 50.0 * sin(u_time * 2.0)) / u_zoom);
                    color += halo * oklch_to_srgb(vec3(0.9, 0.25, u_time * 3.0)); // Holographic burn
                }

                // CRT / VHS Shimmer
                color *= 0.95 + 0.05 * sin(gl_FragCoord.y * 3.0 - u_time * 20.0);
                
                // Vignette
                float dist = length(uv);
                color *= smoothstep(1.5, 0.0, dist);

                fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_center: { value: state.center },
                u_zoom: { value: state.zoom },
                u_seed: { value: state.seed },
                u_glitch_strength: { value: 1.0 },
                u_phase: { value: 0.0 }
            },
            vertexShader,
            fragmentShader
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
    material.uniforms.u_time.value = state.timeOffset;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    material.uniforms.u_center.value.copy(state.center);
    material.uniforms.u_zoom.value = state.zoom;
    material.uniforms.u_seed.value = state.seed;
    material.uniforms.u_glitch_strength.value = glitchStrength;
    material.uniforms.u_phase.value = phaseOffset;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);