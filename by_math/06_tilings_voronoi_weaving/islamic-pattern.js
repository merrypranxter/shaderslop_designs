try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;

            const float PI = 3.14159265359;
            const float TAU = 6.28318530718;

            // --- OKLab Perceptual Color Math (color_systems) ---
            vec3 srgb_to_linear(vec3 c) {
                vec3 b1 = c / 12.92;
                vec3 b2 = pow((c + 0.055) / 1.055, vec3(2.4));
                return mix(b1, b2, step(0.04045, c));
            }

            vec3 linear_to_srgb(vec3 c) {
                vec3 b1 = c * 12.92;
                vec3 b2 = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
                return mix(b1, b2, step(0.0031308, c));
            }

            vec3 linear_to_oklab(vec3 c) {
                float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
                float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
                float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
                float l_ = pow(max(l, 0.0), 1.0/3.0);
                float m_ = pow(max(m, 0.0), 1.0/3.0);
                float s_ = pow(max(s, 0.0), 1.0/3.0);
                return vec3(
                    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
                    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
                    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
                );
            }

            vec3 oklab_to_linear(vec3 c) {
                float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
                float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
                float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
                float l = l_ * l_ * l_;
                float m = m_ * m_ * m_;
                float s = s_ * s_ * s_;
                return vec3(
                     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                );
            }

            vec3 oklabMix(vec3 c1, vec3 c2, float t) {
                vec3 lab1 = linear_to_oklab(srgb_to_linear(c1));
                vec3 lab2 = linear_to_oklab(srgb_to_linear(c2));
                return linear_to_srgb(oklab_to_linear(mix(lab1, lab2, t)));
            }

            // --- Noise & Domain Warp (noise_fields) ---
            vec3 permute(vec3 x) { return mod(((x*34.0)+10.0)*x, 289.0); }
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy));
                vec2 x0 = v - i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m * m; m = m * m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            vec2 hash22(vec2 p) {
                p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
                return fract(sin(p)*43758.5453);
            }

            float worleyEdge(vec2 p) {
                vec2 n = floor(p);
                vec2 f = fract(p);
                float d1 = 8.0, d2 = 8.0;
                for (int j = -1; j <= 1; j++) {
                    for (int i = -1; i <= 1; i++) {
                        vec2 g = vec2(float(i), float(j));
                        vec2 o = hash22(n + g);
                        // Fungal animation
                        o = 0.5 + 0.5 * sin(u_time * 0.4 + TAU * o);
                        vec2 r = g + o - f;
                        float d = dot(r, r);
                        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
                    }
                }
                return sqrt(d2) - sqrt(d1);
            }

            // --- Islamic Geometry (islamic_tiling) ---
            float pgDist(vec2 p, int k, float sp, float math_error) {
                float a = float(k) * PI / 5.0;
                float g = float(k + 1) / 10.0 + math_error;
                vec2 n = vec2(cos(a), sin(a));
                return abs(fract(dot(p, n) / sp + g + 0.5) - 0.5) * sp;
            }

            float rosettePotential(vec2 p, float sp) {
                float s = 0.0;
                for (int k = 0; k < 5; k++) {
                    float a = float(k) * PI / 5.0;
                    float g = float(k + 1) / 10.0;
                    s += cos((dot(p, vec2(cos(a), sin(a))) / sp + g) * TAU);
                }
                return s;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y));
                vec2 p = uv * 6.0;

                // Slow celestial rotation
                float rot = u_time * 0.04;
                mat2 rMat = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
                p = rMat * p;

                // 1. FUNGAL SUCCESSION FIELD (noise_fields + minerals)
                // Represents the reaction-diffusion front of Azurite converting to Malachite
                float inf_noise = snoise(p * 0.25 + vec2(u_time * 0.15, -u_time * 0.1));
                inf_noise = inf_noise * 0.5 + 0.5;

                // 2. SACRED IMMUNITY (islamic_tiling)
                // The 10-fold rosette centers resist mathematical decay
                float pot = rosettePotential(p, 1.0);
                float immunity = smoothstep(-3.0, -4.8, pot);

                // 3. BUREAUCRATIC FAILURE (The Weird Mechanism)
                // The mathematical infection overrides the geometry
                float infection = clamp((inf_noise * 1.6) - (immunity * 1.1) + (sin(u_time * 0.3) * 0.1), 0.0, 1.0);
                
                // Quantized error injected into the sacred geometry
                float math_error = floor(infection * 5.0) * 0.06 * infection;

                // Domain Warp: coordinates melt under infection
                vec2 warp = vec2(snoise(p * 1.5 + u_time * 0.5), snoise(p * 1.5 - u_time * 0.5));
                vec2 p_girih = p + warp * infection * 0.6;

                // Calculate Girih structure with corrupted coordinates
                float d_girih = 1e9;
                float sum_idx = 0.0;
                for (int k = 0; k < 5; k++) {
                    d_girih = min(d_girih, pgDist(p_girih, k, 1.0, math_error));
                    float a = float(k) * PI / 5.0;
                    float g = float(k + 1) / 10.0 + math_error;
                    sum_idx += floor(dot(p_girih, vec2(cos(a), sin(a))) + g + 0.5);
                }
                float girih_parity = mod(sum_idx, 2.0);

                // Calculate Worley structure (Malachite botryoidal growth)
                float d_worley = worleyEdge((p * 2.5) - (warp * infection * 2.0)) * 0.4;

                // Morphing Topology: SDF interpolation
                float morph_blend = smoothstep(0.3, 0.8, infection);
                float d = mix(d_girih, d_worley, morph_blend);

                // --- PALETTES (color_systems + minerals) ---
                // Azurite (Healthy State)
                vec3 C_AZU_DARK = vec3(0.02, 0.04, 0.18);
                vec3 C_AZU_LITE = vec3(0.06, 0.14, 0.52);
                
                // Malachite (Infected State)
                vec3 C_MAL_DARK = vec3(0.00, 0.10, 0.00);
                vec3 C_MAL_LITE = vec3(0.05, 0.35, 0.15);

                // Strapwork
                vec3 C_GOLD = vec3(0.95, 0.80, 0.15); // Divine order
                vec3 C_TOXIC = vec3(0.60, 1.00, 0.00); // Fungal bloom

                // Background mixing
                vec3 bg_girih = oklabMix(C_AZU_DARK, C_AZU_LITE, girih_parity);
                vec3 bg_worley = oklabMix(C_MAL_DARK, C_MAL_LITE, clamp(d_worley * 2.5, 0.0, 1.0));
                vec3 bg = oklabMix(bg_girih, bg_worley, infection);

                // Strapwork mixing
                vec3 line_col = oklabMix(C_GOLD, C_TOXIC, infection);

                // Breathing, swelling line width in infected zones
                float lw = mix(0.025, 0.07 + 0.03 * snoise(p * 4.0 - u_time), morph_blend);

                // Rendering
                float line_mask = 1.0 - smoothstep(lw - 0.015, lw + 0.015, d);
                float glow = 0.006 / (d * d + 0.001);

                // Final Composition
                vec3 final_col = mix(bg, line_col, line_mask);
                final_col += line_col * glow * mix(0.4, 1.5, infection); // Bloom intensity rises with infection

                // Vignette
                float vignette = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.8;
                final_col *= clamp(vignette, 0.0, 1.0);

                fragColor = vec4(clamp(final_col, 0.0, 1.0), 1.0);
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

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(plane);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (err) {
    console.error("Feral Fungal-Girih Render Failed:", err);
}