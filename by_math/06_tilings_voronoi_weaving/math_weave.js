try {
    if (!ctx) throw new Error("Context not available");

    // We use the 'canvas' and 'ctx' provided by the environment to initialize Three.js safely.
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            context: ctx, 
            alpha: true, 
            antialias: true 
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        // FERAL HYBRID MECHANISM:
        // We are building a "Julia Jacquard Loom".
        // It weaves a physical fabric (warp & weft cylinders) where the interlacing 
        // pattern (the jacquard punch card) is driven by a continuous Julia set fractal.
        // The threads exhibit thin-film interference (structural color) and occasional 
        // "machine hesitation" (dropped stitches/floats).
        
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

            #define PI 3.14159265359

            // --- COLOR SYSTEMS (OKLCh to sRGB) ---
            vec3 oklch_to_srgb(vec3 lch) {
                float L = lch.x;
                float C = lch.y;
                float h = lch.z;
                
                float a = C * cos(h);
                float b = C * sin(h);

                float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
                float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
                float s_ = L - 0.0894841775 * a - 1.2914855480 * b;

                float l = l_*l_*l_;
                float m = m_*m_*m_;
                float s = s_*s_*s_;

                vec3 rgb = vec3(
                     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                );

                vec3 gamma = mix(
                    rgb * 12.92,
                    1.055 * pow(max(rgb, 0.0), vec3(1.0/2.4)) - 0.055,
                    step(0.0031308, rgb)
                );
                return clamp(gamma, 0.0, 1.0);
            }

            // --- STRUCTURAL COLOR (Thin Film Interference) ---
            vec3 thin_film(float cos_theta, float thickness) {
                // 2 * n * d * cos(theta) = m * lambda
                float path_diff = 2.0 * 1.5 * thickness * cos_theta;
                vec3 phase = vec3(0.0, 0.33, 0.67); // RGB phase offsets
                return 0.5 + 0.5 * cos(6.28318 * (path_diff * vec3(1.0, 1.2, 1.5) + phase));
            }

            // --- FRACTAL MATH (Julia Set Jacquard Card) ---
            float julia_punch_card(vec2 uv) {
                // Animated complex parameter 'c' drifting through chaotic regions
                vec2 c = vec2(-0.74543, 0.11301) + vec2(sin(u_time*0.1)*0.05, cos(u_time*0.13)*0.05);
                vec2 z = (uv - 0.5) * 2.5;
                
                float iter = 0.0;
                for(int i=0; i<32; i++) {
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
                    if(dot(z,z) > 4.0) break;
                    iter += 1.0;
                }
                // Smooth escape
                float smooth_i = iter - log2(max(1.0, log2(dot(z,z))));
                return smooth_i / 32.0;
            }

            // --- HESITATION / GLITCH MECHANISM ---
            float machine_hesitation(vec2 cell) {
                // Pseudo-random noise to simulate dropped stitches in the loom
                return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                // 1. Hostile Coordinates: Domain warp to simulate fabric stretch and tension
                vec2 uv = vUv;
                uv += 0.01 * vec2(sin(uv.y * 15.0 + u_time), cos(uv.x * 15.0 - u_time));

                // 2. Weave Grid Setup
                float density = 60.0; // Threads per UV unit
                vec2 grid = uv * density;
                vec2 cell = floor(grid);
                vec2 local = fract(grid);

                // 3. The Jacquard Loom Logic
                float j_val = julia_punch_card(uv);
                
                // Base plain weave (checkerboard)
                float plain = mod(cell.x + cell.y, 2.0);
                
                // Motif overrides the plain weave (creates the fractal pattern)
                float motif = step(0.5, fract(j_val * 6.0));
                float warp_top = mix(plain, 1.0 - plain, motif);

                // Machine hesitation (dropped stitch flips the thread logic rarely)
                if(machine_hesitation(cell) > 0.99) {
                    warp_top = 1.0 - warp_top; 
                }

                // 4. Thread Anatomy & Rendering
                float R = 0.42; // Thread radius (leaving tiny gaps between threads)
                float d_warp = abs(local.x - 0.5);
                float d_weft = abs(local.y - 0.5);

                bool is_warp = d_warp < R;
                bool is_weft = d_weft < R;

                bool show_warp = is_warp && (warp_top > 0.5 || !is_weft);
                bool show_weft = is_weft && (warp_top < 0.5 || !is_warp);

                // Deep void background
                vec3 color = vec3(0.02, 0.01, 0.03); 
                vec3 light_dir = normalize(vec3(0.4, 0.6, 0.8));

                if (show_warp) {
                    // Vertical thread
                    float h = sqrt(max(0.0, R*R - d_warp*d_warp));
                    vec3 normal = normalize(vec3(d_warp * sign(local.x - 0.5), 0.0, h));
                    
                    // Twist the yarn (fibrous microstructure)
                    normal.y += sin(local.y * PI * 4.0) * 0.3;
                    normal = normalize(normal);

                    float diff = max(0.0, dot(normal, light_dir));
                    
                    // Golden angle palette for warp threads based on column
                    float hue = mod(cell.x * 137.508 + u_time * 10.0, 360.0) * (PI/180.0);
                    vec3 base_color = oklch_to_srgb(vec3(0.6, 0.14, hue));
                    
                    // Anisotropic highlight (silk/synthetic sheen)
                    float aniso = pow(max(0.0, dot(normal, vec3(0.0, 1.0, 0.0))), 32.0);

                    color = base_color * (diff * 0.7 + 0.3) + aniso * 0.4;

                } else if (show_weft) {
                    // Horizontal thread
                    float h = sqrt(max(0.0, R*R - d_weft*d_weft));
                    vec3 normal = normalize(vec3(0.0, d_weft * sign(local.y - 0.5), h));
                    
                    normal.x += sin(local.x * PI * 4.0) * 0.3;
                    normal = normalize(normal);

                    float diff = max(0.0, dot(normal, light_dir));
                    
                    // Structural Color for weft threads (iridescent beetle wing effect)
                    float cos_theta = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
                    // Thickness varies slightly along the thread
                    float thickness = 1.2 + sin(cell.y * 0.5) * 0.2; 
                    vec3 iridescence = thin_film(cos_theta, thickness);

                    // Anisotropic highlight perpendicular to warp
                    float aniso = pow(max(0.0, dot(normal, vec3(1.0, 0.0, 0.0))), 32.0);

                    color = iridescence * (diff * 0.6 + 0.4) + aniso * 0.5;
                }

                // Vignette and final output
                float vignette = 1.0 - smoothstep(0.5, 1.5, length(vUv - 0.5));
                fragColor = vec4(color * vignette, 1.0);
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

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    // Update uniforms
    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    // Handle resize and render
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral Loom Initialization Failed:", e);
    // Fallback: if WebGL fails, we draw a glitchy error pattern to the 2D context
    // This assumes the environment might fall back to a 2D ctx if WebGL isn't supported.
    if (ctx && ctx.fillStyle) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#ff0033';
        ctx.font = '14px monospace';
        ctx.fillText('WEAVE.ERR: SILICON_NECROSIS', 20, 40);
        ctx.fillText(e.message.substring(0, 50), 20, 60);
    }
}