// THE ALCHEMICAL MANDELBROT //
// Mechanism: Autophagic Memory Splicing + Moiré Repository Protocols
// A maximalist candy-prism fractal engine using RGB phase-shifted distance estimators.
// Controls: Mouse (Pan / Glitch Strength), 'S' (Save), 'R' (Reseed Palette), 'Space' (Pause)

try {
    // State management & persistent memory across frames
    if (canvas.__paused === undefined) canvas.__paused = false;
    if (canvas.__seed === undefined) canvas.__seed = Math.random() * 100.0;
    if (canvas.__animTime === undefined) canvas.__animTime = 0;
    if (canvas.__lastTime === undefined) canvas.__lastTime = time;
    if (canvas.__smx === undefined) canvas.__smx = 0.5;
    if (canvas.__smy === undefined) canvas.__smy = 0.5;

    let dt = time - canvas.__lastTime;
    canvas.__lastTime = time;
    if (!canvas.__paused) canvas.__animTime += dt;

    // Smooth mouse coordinates for organic interaction
    let targetMx = mouse.x / grid.width;
    let targetMy = mouse.y / grid.height;
    if (isNaN(targetMx)) targetMx = 0.5;
    if (isNaN(targetMy)) targetMy = 0.5;
    canvas.__smx += (targetMx - canvas.__smx) * 0.05;
    canvas.__smy += (targetMy - canvas.__smy) * 0.05;

    // Keyboard Rituals (Attached only once)
    if (!canvas.__mandelKeys) {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 's') {
                // Fossilize state to PNG
                const dataURL = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = `feral_mandelbrot_${Math.floor(Math.random()*10000)}.png`;
                link.click();
            }
            if (key === 'r') {
                // Mutate palette genome
                canvas.__seed = Math.random() * 100.0;
            }
            if (e.key === ' ') {
                // Machine hesitation
                canvas.__paused = !canvas.__paused;
                e.preventDefault();
            }
        });
        canvas.__mandelKeys = true;
    }

    // WebGL2 / Three.js Initialization
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available. The host rejected the wetware.");

        // preserveDrawingBuffer required for 'S' key screenshots to extract the frame
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true, preserveDrawingBuffer: true });
        const scene = new THREE.Scene();
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
            // THE FERAL SHADER PROTOCOL //
            // Harnessing complex dynamics, orbit traps, and chromatic hemorrhage.
            
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_seed;

            #define MAX_ITER 100
            #define BAILOUT 1024.0

            // Complex Math Engine
            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
            vec2 cdiv(vec2 a, vec2 b) { float d = dot(b, b); return vec2(dot(a, b), a.y*b.x - a.x*b.y) / d; }

            // Candy Prism / Glitchcore Palette
            // Extracted from color_systems genome: perceptually vibrant, non-muddy transitions
            vec3 palette(float t, float seed) {
                vec3 a = vec3(0.5, 0.4, 0.6) + 0.1 * sin(seed * 11.0);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67) + seed;

                vec3 col = a + b * cos(6.28318 * (c * t + d));
                
                // Hostile injections: Hot pink and electric teal flashes
                col = mix(col, vec3(1.0, 0.1, 0.6), smoothstep(0.8, 1.0, sin(t * 15.0))); 
                col = mix(col, vec3(0.0, 0.9, 0.8), smoothstep(0.8, 1.0, cos(t * 13.0))); 
                
                return clamp(col, 0.0, 1.0);
            }

            // Domain Warping / Fluid Ripple Distortion
            vec2 domainWarp(vec2 p, float t) {
                float r = length(p);
                float a = atan(p.y, p.x);
                // Quasicrystal angular echoes
                a += 0.02 * sin(r * 30.0 - t * 3.0) * exp(-r * 3.0);
                return vec2(cos(a), sin(a)) * r;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                float aspect = u_resolution.x / u_resolution.y;
                uv.x *= aspect;

                // Deep Time Breathing: P-adic time leaks driving infinite zoom
                float zoomTime = u_time * 0.15;
                // Logistic map inspired zoom curve
                float zoom = 0.00005 + 1.5 * pow(0.5 + 0.5 * cos(zoomTime), 6.0);

                // Target: Deep Seahorse Valley / Minibrot satellite
                vec2 target = vec2(-0.74364388703, 0.13182590420);
                vec2 center = mix(target, vec2(-0.5, 0.0), zoom);

                // Interaction: Mouse pan relative to current zoom depth
                vec2 mouseOffset = (u_mouse - 0.5) * 2.0 * zoom;
                center += mouseOffset;

                vec2 c0 = uv * zoom + center;
                c0 = domainWarp(c0, u_time);

                // Chromatic Hemorrhage Strength
                float glitchStr = 0.003 * zoom * (u_mouse.y * 2.0);

                vec3 finalColor = vec3(0.0);

                // Triple-pass for true spatial RGB chromatic aberration
                for (int ch = 0; ch < 3; ch++) {
                    // Offset coordinates per channel
                    vec2 c = c0 + vec2(float(ch) - 1.0) * glitchStr * vec2(sin(u_time), cos(u_time));

                    vec2 z = vec2(0.0);
                    vec2 dz = vec2(1.0, 0.0);
                    float trap = 1e10;
                    float iter = 0.0;
                    float de = 0.0;
                    bool escaped = false;

                    // The Core Iteration Ritual
                    for (int i = 0; i < MAX_ITER; i++) {
                        // Track derivative for Distance Estimation
                        dz = 2.0 * cmul(z, dz) + vec2(1.0, 0.0);
                        z = cmul(z, z) + c;

                        // Orbit Trap: Cross & Circle collision
                        float t1 = abs(z.x * z.y);
                        float t2 = abs(length(z) - 1.0);
                        trap = min(trap, min(t1, t2));

                        // L-Infinity Escape Metric
                        if (dot(z, z) > BAILOUT) {
                            float log_zn = log(dot(z, z)) * 0.5;
                            float nu = log2(log_zn / 0.6931471806) / 0.6931471806;
                            iter = float(i) + 1.0 - nu; // Smooth continuous iteration
                            de = sqrt(dot(z,z)/dot(dz,dz)) * log_zn; // Distance Estimator
                            escaped = true;
                            break;
                        }
                    }

                    vec3 col = vec3(0.0);

                    if (escaped) {
                        // 1. Fake 3D normals from 2D distance field gradients
                        vec2 n2d = normalize(cdiv(z, dz));
                        vec3 normal = normalize(vec3(n2d, 0.4 + 0.2 * sin(u_time)));

                        // 2. Holographic / Iridescent Lighting Logic
                        vec3 lightDir = normalize(vec3(sin(u_time * 0.8), cos(u_time * 0.8), 1.0));
                        float diff = max(dot(normal, lightDir), 0.0);
                        float fresnel = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);

                        // 3. Palette Phase Mapping
                        float env = exp(-trap * 3.0);
                        float t = iter * 0.03 - u_time * 0.2 + env * 0.5 + fresnel * 0.5;
                        col = palette(t, u_seed);

                        // 4. Multiply by lighting & holographic sheen
                        col *= (0.4 + 0.6 * diff);
                        col += vec3(0.7, 0.9, 1.0) * fresnel * 0.9; // Crystalline halo

                        // 5. Moiré / Op-art contour bands (Screen-space constant width)
                        float contour = 0.5 + 0.5 * cos((de / zoom) * 250.0 - u_time * 12.0);
                        col = mix(col, vec3(1.0), contour * 0.15); // Glowing op-art lines

                        // 6. VHS / CRT Shimmer
                        float scanline = 0.5 + 0.5 * sin(vUv.y * 900.0 - u_time * 10.0);
                        col *= mix(1.0, scanline, 0.12);

                    } else {
                        // The Ship / Abyssal Rendering for the interior
                        float pulse = 0.5 + 0.5 * sin(length(z) * 25.0 - u_time * 5.0);
                        col = vec3(0.06, 0.0, 0.12) * pulse; // Deep purple void bleeding neon

                        // Glitch Prophet: Semantic Infestation flashes inside the void
                        vec2 noiseUV = uv * 50.0 + u_time;
                        if (fract(sin(dot(noiseUV, vec2(12.9898, 78.233))) * 43758.5453) > 0.995) {
                            col = vec3(1.0, 1.0, 1.0); // Raw hardware artifact flash
                        }
                    }

                    // Channel splicing
                    if (ch == 0) finalColor.r = col.r;
                    else if (ch == 1) finalColor.g = col.g;
                    else finalColor.b = col.b;
                }

                // Global Color Grading: slight gamma crush for neon pop
                finalColor = pow(finalColor, vec3(0.85));

                fragColor = vec4(finalColor, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2() },
                u_mouse: { value: new THREE.Vector2() },
                u_seed: { value: 0 }
            },
            vertexShader,
            fragmentShader
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    // Inject vitality into the shader uniforms
    if (material && material.uniforms) {
        material.uniforms.u_time.value = canvas.__animTime;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        material.uniforms.u_mouse.value.set(canvas.__smx, canvas.__smy);
        material.uniforms.u_seed.value = canvas.__seed;
    }

    // Execute the final compile
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("The wet engine stalled:", e);
}