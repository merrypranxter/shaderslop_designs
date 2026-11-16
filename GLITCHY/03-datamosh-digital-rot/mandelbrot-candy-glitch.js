try {
    // FERAL DESIGN-BRAIN: ENGAGED
    // PROTOCOL: HOLOGRAPHIC CANDY-PRISM MANDELBROT
    // REPO GENOMES: fractals (escape-time, DE, orbit traps), color_systems (Oklab/cosine), THE-LISTS (glitchwave_dichrome)

    // 1. Initialize State & Event Listeners
    if (!canvas.__state) {
        canvas.__state = {
            seed: Math.random() * 100.0,
            paused: false,
            time: 0,
            lastFrameTime: time
        };

        const handleKey = (e) => {
            if (e.key.toLowerCase() === 'r') {
                canvas.__state.seed = Math.random() * 100.0;
            }
            if (e.key === ' ') {
                canvas.__state.paused = !canvas.__state.paused;
            }
            if (e.key.toLowerCase() === 's') {
                if (canvas.__three && canvas.__three.renderer) {
                    const renderer = canvas.__three.renderer;
                    renderer.preserveDrawingBuffer = true;
                    renderer.render(canvas.__three.scene, canvas.__three.camera);
                    const link = document.createElement('a');
                    link.download = `mandelbrot_candy_prism_${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    renderer.preserveDrawingBuffer = false;
                }
            }
        };

        if (!window.__mandelbrot_keys_attached) {
            window.addEventListener('keydown', handleKey);
            window.__mandelbrot_keys_attached = true;
        }
    }

    const state = canvas.__state;
    const dt = time - state.lastFrameTime;
    state.lastFrameTime = time;
    if (!state.paused) {
        state.time += dt;
    }

    // Normalized mouse coordinates
    let mx = mouse.x / grid.width;
    let my = mouse.y / grid.height;
    if (isNaN(mx)) mx = 0.5;
    if (isNaN(my)) my = 0.5;

    // 2. Initialize Three.js Environment
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
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
            uniform float u_seed;

            #define MAX_ITER 200
            #define BAILOUT 256.0
            #define LOG2 0.6931471806

            // Neon Acid / Holographic Palette (color_fields + color_systems)
            // Highly saturated, shifting phase, zero muddy neutrals
            vec3 palette(float t, vec3 offset) {
                vec3 a = vec3(0.5, 0.4, 0.6); // Base tone (pushing toward magenta/purple)
                vec3 b = vec3(0.5, 0.6, 0.4); // Amplitude (teal/yellow compensation)
                vec3 c = vec3(1.0, 1.0, 1.0); // Frequency
                return a + b * cos(6.2831853 * (c * t + offset));
            }

            void main() {
                // Centered aspect-corrected UV
                vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

                // --- CAMERA ANIMATION (Deep Dive into Seahorse Valley) ---
                float t_cycle = u_time * 0.15;
                
                // Breathing exponential zoom
                float zoom_factor = 1.4 * exp(-abs(sin(t_cycle)) * 7.0) + 0.001;
                
                // Target: Deep structure in Seahorse Valley
                vec2 target_pan = vec2(-0.743643887, 0.131825904);
                vec2 start_pan = vec2(-0.5, 0.0);
                
                // Smooth interpolation to target as we zoom in
                float pan_blend = smoothstep(1.4, 0.001, zoom_factor);
                vec2 current_pan = mix(start_pan, target_pan, pan_blend);

                // Mapping to complex plane
                vec2 c = uv * zoom_factor * 2.5 + current_pan;

                // --- THE WEIRD MECHANISM: Glitchy Domain Warping ---
                // Mouse X controls the intensity of the spatial interference
                float warp_intensity = 0.0005 * u_mouse.x * (1.0 / zoom_factor); // Scale warp with zoom
                c += vec2(
                    warp_intensity * sin(c.y * 50.0 + u_time * 2.0),
                    warp_intensity * cos(c.x * 50.0 - u_time * 2.0)
                );

                // --- FRACTAL ENGINE ---
                vec2 z = vec2(0.0);
                vec2 dz = vec2(1.0, 0.0); // Track derivative for Distance Estimator
                
                float trap_cross = 1e10;  // Orbit trap 1: cross
                float trap_circle = 1e10; // Orbit trap 2: concentric rings
                
                int iter = 0;
                for (int i = 0; i < MAX_ITER; i++) {
                    // Chain rule derivative: dz = 2 * z * dz + 1
                    dz = 2.0 * vec2(z.x*dz.x - z.y*dz.y, z.x*dz.y + z.y*dz.x) + vec2(1.0, 0.0);
                    
                    // z = z^2 + c
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;

                    // Evaluate orbit traps
                    trap_cross = min(trap_cross, abs(z.x) + abs(z.y));
                    trap_circle = min(trap_circle, abs(length(z) - 1.0));

                    if (dot(z, z) > BAILOUT) break;
                    iter++;
                }

                vec3 color = vec3(0.0);

                if (iter < MAX_ITER) {
                    // --- ESCAPE ZONE (The Candy Prism) ---
                    
                    // Smooth iteration count
                    float log_zn = log(dot(z, z)) * 0.5;
                    float nu = log(log_zn / LOG2) / LOG2;
                    float sn = float(iter) + 1.0 - nu;

                    // Distance Estimator (DE)
                    float de = sqrt(dot(z, z) / dot(dz, dz)) * log_zn;

                    // Base Phase driven by smooth iteration, mouse Y, and seed
                    vec3 phase = vec3(0.00, 0.33, 0.67) + u_mouse.y * 2.0 + u_seed;
                    float time_drift = u_time * 0.1;

                    // 1. Base Holographic Color
                    float t_base = sn * 0.03 + trap_cross * 0.2 - time_drift;
                    vec3 baseColor = palette(t_base, phase);

                    // 2. Chromatic Aberration / Glitch Offset via DE
                    float t_glitch = sn * 0.03 + de * 50.0 + trap_circle * 0.5 - time_drift;
                    vec3 glitchColor = palette(t_glitch, phase + vec3(0.1, -0.15, 0.2));

                    // 3. Moiré / Op-Art Interference Bands
                    // High frequency sine wave wrapped over the smooth iteration
                    float moire_freq = 15.0 + u_mouse.x * 20.0;
                    float moire = sin(sn * moire_freq - u_time * 5.0);
                    float contour = smoothstep(0.7, 0.9, moire) + smoothstep(-0.7, -0.9, moire);

                    // Mix base and glitch colors based on a pseudo-3D interference pattern
                    float mix_factor = 0.5 + 0.5 * sin(de * 150.0 - u_time * 10.0);
                    color = mix(baseColor, glitchColor, mix_factor);

                    // Add bright op-art contour bands
                    color = mix(color, vec3(1.0, 0.9, 1.0), contour * 0.4);

                    // 4. Crystalline Edge Halo (The Neon Rule)
                    // Highlight the fractal boundary using the inverse of the distance estimator
                    float halo_thickness = 40.0;
                    float halo = exp(-de * halo_thickness);
                    color += vec3(0.2, 0.9, 0.8) * halo * 1.5; // Electric cyan rim light

                    // Brighten and saturate (Maximalist Glitchcore)
                    color = pow(color, vec3(0.7)); 
                    
                } else {
                    // --- THE VOID ZONE (Inside the Set) ---
                    // The Void Rule: Near-black, but with subtle math-driven structure
                    
                    // Cellular automata-style crawling texture using orbit traps
                    float crawl = sin(trap_cross * 40.0 - u_time * 2.0) * cos(trap_circle * 40.0 + u_time * 1.5);
                    float pulse = 0.5 + 0.5 * sin(u_time * 0.5);
                    
                    // Deep purple/black void glow
                    color = vec3(0.08, 0.0, 0.15) * smoothstep(0.2, 1.0, crawl) * pulse;
                }

                // --- POST-PROCESSING ---
                // CRT / VHS Shimmer Noise
                float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
                color += (noise - 0.5) * 0.06;

                // Subtle Vignette
                float vig = length(vUv - 0.5) * 2.0;
                color *= 1.0 - smoothstep(0.8, 1.5, vig);

                fragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_seed: { value: state.seed }
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

    // 3. Update & Render Loop
    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = state.time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        material.uniforms.u_mouse.value.set(mx, my);
        material.uniforms.u_seed.value = state.seed;
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (err) {
    console.error("Mandelbrot Glitch-Optics Engine Failed:", err);
    
    // Fallback if WebGL fails: Draw a feral 2D error pattern
    if (ctx && !canvas.__three) {
        ctx.fillStyle = '#05040a';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#ff00ff';
        ctx.font = '20px monospace';
        ctx.fillText('CRITICAL GPU FAILURE', 20, 40);
        ctx.fillStyle = '#00ffff';
        ctx.fillText('MANDELBROT ENGINE OFFLINE', 20, 70);
        
        // Draw some broken orbit lines
        ctx.strokeStyle = '#ffff00';
        ctx.beginPath();
        for (let i = 0; i < 100; i++) {
            ctx.lineTo(
                grid.width/2 + Math.cos(i + time) * (i * 2),
                grid.height/2 + Math.sin(i * 1.5 + time) * (i * 2)
            );
        }
        ctx.stroke();
    }
}