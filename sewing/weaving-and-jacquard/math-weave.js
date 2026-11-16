try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;

            #define PI 3.14159265359

            // Hash & FBM for Fiber Microstructure & Hyperbolic Warp
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for(int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            // Oklch to sRGB (Perceptual Color Space from color_systems repo)
            vec3 oklch2srgb(vec3 c) {
                float L = c.x;
                float C = c.y;
                float h = c.z;
                float a = C * cos(h);
                float b = C * sin(h);

                float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
                float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
                float s_ = L - 0.0894841775 * a - 1.2914855480 * b;

                float l = l_ * l_ * l_;
                float m = m_ * m_ * m_;
                float s = s_ * s_ * s_;

                vec3 rgb = vec3(
                     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                );

                vec3 srgb = vec3(
                    rgb.r <= 0.0031308 ? rgb.r * 12.92 : 1.055 * pow(max(rgb.r, 0.0), 1.0 / 2.4) - 0.055,
                    rgb.g <= 0.0031308 ? rgb.g * 12.92 : 1.055 * pow(max(rgb.g, 0.0), 1.0 / 2.4) - 0.055,
                    rgb.b <= 0.0031308 ? rgb.b * 12.92 : 1.055 * pow(max(rgb.b, 0.0), 1.0 / 2.4) - 0.055
                );
                return clamp(srgb, 0.0, 1.0);
            }

            // Black Body Radiation (from color_fields repo)
            vec3 blackBody(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 c;
                c.r = smoothstep(0.0, 0.33, t);
                c.g = smoothstep(0.15, 0.6, t) * 0.85;
                c.b = smoothstep(0.4, 0.9, t) * 0.6;
                c *= 0.5 + 2.0 * t * t;
                return c;
            }

            // Complex Math
            vec2 complex_sq(vec2 z) {
                return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
            }

            // Julia Set Evaluation (Smooth Escape + Distance Estimator)
            // Returns: vec3(smooth_iterations, distance_estimator, is_interior)
            vec3 julia_data(vec2 z, vec2 c) {
                vec2 dz = vec2(1.0, 0.0);
                float n = 0.0;
                for(int i = 0; i < 90; i++) {
                    if(dot(z, z) > 256.0) break;
                    // dz_{n+1} = 2 * z_n * dz_n
                    dz = 2.0 * vec2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x);
                    z = complex_sq(z) + c;
                    n += 1.0;
                }
                
                if(n >= 90.0) return vec3(0.0, 0.0, 1.0); // Interior
                
                float r2 = dot(z, z);
                float log_zn = log(r2) * 0.5;
                float nu = log(log_zn / 0.69314718) / 0.69314718;
                float smooth_n = n - nu;
                
                float de = sqrt(r2 / dot(dz, dz)) * log_zn * 0.5;
                return vec3(smooth_n, de, 0.0);
            }

            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y));
                
                // Hyperbolic Topology Fold (from crochet_patterns / structural_color)
                vec2 macro_uv = uv;
                macro_uv *= rot(length(macro_uv) * 0.4 - u_time * 0.05);
                macro_uv += vec2(sin(u_time * 0.1), cos(u_time * 0.07)) * 0.2;

                // Dynamic C parameter hovering near Seahorse Valley
                vec2 c_param = vec2(-0.76, 0.12) + vec2(sin(u_time * 0.13), cos(u_time * 0.17)) * 0.04;
                
                // Evaluate Jacquard Fractal Pattern
                vec3 j_data = julia_data(macro_uv * 2.2, c_param);
                float smooth_n = j_data.x;
                float de = j_data.y;
                float is_interior = j_data.z;

                // Scale of the Jacquard loom threads
                float scale = 180.0;
                vec2 thread_uv = uv * scale;
                
                // Stress Tensor Warp (Differential Growth / Fiber Pull)
                thread_uv += vec2(fbm(uv * 8.0 + u_time * 0.05), fbm(uv * 8.0 - u_time * 0.05)) * 1.5;

                vec2 id = floor(thread_uv);
                vec2 local = fract(thread_uv) - 0.5;

                // Twill Weave / Damask Logic
                float twill = mod(id.x - id.y, 3.0) > 0.5 ? 1.0 : -1.0;
                
                float warp_z = cos(local.y * PI);
                float weft_z = cos(local.x * PI);
                
                // Fractal pattern modulates the weave structure (Brocade effect)
                float pattern = smoothstep(2.0, 35.0, smooth_n);
                warp_z += mix(-1.2, 1.2, pattern) * twill;
                weft_z += mix(1.2, -1.2, pattern) * twill;

                bool warp_visible = warp_z > weft_z;
                float current_z = warp_visible ? warp_z : weft_z;
                float dist = warp_visible ? abs(local.x) : abs(local.y);
                
                // Fiber Microstructure & Fuzz
                float fuzz = fbm(thread_uv * 15.0) * 0.2;
                float thread_mask = smoothstep(0.45 + fuzz, 0.35 - fuzz, dist);

                // Bismuth Quantization (Structural Color L-Infinity Steps)
                float stepped_z = floor(current_z * 5.0) / 5.0;

                // Oklch Structural Color (Thin Film Interference Approximation)
                // Base hue uses Golden Angle (2.39996 rad) to separate warp and weft
                float base_hue = u_time * 0.15 + (warp_visible ? 0.0 : 2.39996);
                float hue = base_hue + pattern * 3.0 + stepped_z * 0.8;
                
                // High chroma for "Neon Acid" / "Jewel Beetle" iridescence
                float chroma = 0.12 + 0.08 * pattern + fuzz * 0.5;
                float lightness = 0.35 + 0.25 * current_z + fuzz;
                
                lightness *= thread_mask; // Darken gaps between threads
                
                // Self-shadowing: Top thread casts shadow on bottom thread
                float shadow_width = 0.4;
                if (warp_visible) {
                    lightness *= smoothstep(0.05, shadow_width, abs(local.x)); // Warp casts shadow horizontally
                } else {
                    lightness *= smoothstep(0.05, shadow_width, abs(local.y)); // Weft casts shadow vertically
                }

                vec3 fabric_color = oklch2srgb(vec3(lightness, chroma, hue));

                // Devoré (Burnout) Textile Technique mapped to Julia Set DE
                // The interior of the Julia set is burned away, revealing glowing embers and a cosmic void.
                float heat = 0.0;
                if (is_interior < 0.5) {
                    // Heat spikes aggressively as DE approaches the boundary
                    heat = exp(-de * 200.0) * 2.0;
                    // Feral Noise Modulator for organic burning
                    heat *= fbm(uv * 25.0 - u_time * 1.5) * 1.2 + 0.3;
                }

                vec3 ember_color = blackBody(heat);
                
                // Mix fabric and ember at the burnout edges
                vec3 final_color = mix(fabric_color, ember_color, clamp(heat * 1.5, 0.0, 1.0));
                
                if (is_interior > 0.5) {
                    // Cosmic Void / Discharged Dye Base
                    final_color = vec3(0.01, 0.005, 0.03) * fbm(uv * 40.0);
                } else {
                    // Completely burn away the fabric where heat is critical
                    float burn_mask = smoothstep(0.7, 1.2, heat);
                    final_color = mix(final_color, ember_color * 1.5, burn_mask);
                }

                // Vignette & Contrast
                float vignette = 1.0 - smoothstep(0.4, 1.8, length(vUv - 0.5));
                final_color *= vignette;
                
                // Simple ACES-like tonemapping curve to handle glowing embers
                final_color = final_color / (final_color + 0.15);
                final_color = pow(final_color, vec3(1.0 / 1.2)); // Gamma tweak

                fragColor = vec4(final_color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
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

} catch (e) {
    console.error("Feral Weave Initialization Failed:", e);
}