try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
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

            /* 
             * GLITCH & DAMAGE TEXTURE SYSTEM
             * 
             * Architecture:
             * 1. State Controller: Cycles prominence weights (w_vhs, w_crt, w_dig, w_flm, w_op)
             *    to shift dominance between glitch families over time.
             * 2. Op-Art Signal: Generates the base structural layer (warped rings, moire, checkers).
             * 3. UV Warping: Applies physical displacement (VHS tracking, film weave, datamosh).
             * 4. Channel Drift: Samples the base signal with offset UVs for RGB splitting.
             * 5. Strict Palette Mapping: Forces all signals into the required high-energy colors.
             *    NO BLACK/GRAY. Shadows are mapped to saturated purple.
             * 6. Damage Overlays: Applies block dropouts, film scratches, light leaks, and CRT masks.
             * 
             * Tweak Notes:
             * - More VHS: Increase multipliers on w_vhs.
             * - More CRT: Increase w_crt influence or adjust phosphor density (3.1415 multiplier).
             * - More Digital: Lower the blockNoise threshold (0.8) or increase w_dig.
             * - More Film: Increase scratch probability or light leak intensity via w_flm.
             * - More Moiré/Op-Art: Increase w_op to favor structural vibration over noise.
             * - Stronger Mode Switching: Adjust the frequencies in the State Controller (st * X).
             */

            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            vec3 getColor(float v) {
                vec3 palette[7];
                palette[0] = vec3(1.0, 0.1, 0.6); // Hot Pink
                palette[1] = vec3(1.0, 0.6, 0.8); // Pastel Pink
                palette[2] = vec3(0.0, 0.9, 0.8); // Bright Teal
                palette[3] = vec3(1.0, 0.9, 0.0); // Electric Yellow
                palette[4] = vec3(0.7, 0.0, 1.0); // Saturated Purple
                palette[5] = vec3(0.1, 1.0, 0.2); // Neon Green
                palette[6] = vec3(1.0, 1.0, 1.0); // White

                v = fract(v) * 6.0;
                int i = int(floor(v));
                float f = smoothstep(0.0, 1.0, fract(v));
                
                if (i == 0) return mix(palette[0], palette[1], f);
                if (i == 1) return mix(palette[1], palette[2], f);
                if (i == 2) return mix(palette[2], palette[3], f);
                if (i == 3) return mix(palette[3], palette[4], f);
                if (i == 4) return mix(palette[4], palette[5], f);
                if (i == 5) return mix(palette[5], palette[6], f);
                return palette[6];
            }

            float getSignal(vec2 p, float t, float w_op, float w_vhs) {
                vec2 cp = p * 2.0 - 1.0;
                
                // VHS Magnetic Warping
                cp.x += sin(cp.y * 5.0 + t * 2.0) * 0.1 * w_vhs;
                
                float r = length(cp);
                float a = atan(cp.y, cp.x);
                
                // Op-Art Domain Warp
                vec2 warp = vec2(sin(r * 12.0 - t), cos(a * 6.0 + t)) * 0.15 * w_op;
                cp += warp;
                
                // Concentric rings vs Checkers
                float rings = sin(length(cp) * (20.0 + 20.0 * w_op) - t * 8.0);
                float checkers = sin(cp.x * 30.0) * cos(cp.y * 30.0);
                
                // Moiré interference
                vec2 cp2 = cp + vec2(sin(t * 0.7), cos(t * 0.8)) * 0.1;
                float moire = sin(length(cp2) * 40.0 + t * 4.0);
                
                float val = mix(rings, rings * moire, w_op);
                
                // Phase shifts between rings and checkers
                float modeSwitch = smoothstep(0.3, 0.7, sin(t * 0.3) * 0.5 + 0.5);
                val = mix(val, checkers, modeSwitch * w_op);
                
                return val * 0.5 + 0.5;
            }

            void main() {
                vec2 uv = vUv;
                float t = u_time;
                
                // STATE CONTROLLER: Cycles prominence of glitch families
                float st = t * 0.3;
                float w_vhs = smoothstep(0.3, 0.7, sin(st * 1.3) * 0.5 + 0.5);
                float w_crt = smoothstep(0.4, 0.6, sin(st * 1.7 + 2.1) * 0.5 + 0.5);
                float w_dig = smoothstep(0.5, 0.8, sin(st * 1.1 + 4.3) * 0.5 + 0.5);
                float w_flm = smoothstep(0.6, 0.9, sin(st * 1.5 + 1.5) * 0.5 + 0.5);
                float w_op  = smoothstep(0.2, 0.8, sin(st * 0.9 + 5.2) * 0.5 + 0.5);
                
                // Burst events for sudden corruption spikes
                float burst = step(0.96, hash(vec2(floor(t * 10.0), 0.0)));
                w_dig = max(w_dig, burst);
                w_vhs = max(w_vhs, burst * 0.8);
                w_crt = max(w_crt, burst * 0.5);
                
                vec2 uv_warped = uv;
                
                // FILM DAMAGE: Gate Weave
                uv_warped.x += (hash(vec2(t, 0.0)) - 0.5) * 0.015 * w_flm;
                uv_warped.y += (hash(vec2(0.0, t)) - 0.5) * 0.015 * w_flm;
                
                // VHS DAMAGE: Horizontal Tracking & V-Sync Roll
                float trackNoise = hash(vec2(floor(uv.y * 25.0), floor(t * 15.0)));
                float tracking = sin(uv.y * 12.0 + t * 10.0) * sin(uv.y * 4.0 - t * 5.0);
                if (trackNoise > 0.7) {
                    uv_warped.x += tracking * 0.08 * w_vhs;
                }
                uv_warped.y = fract(uv_warped.y + t * 0.1 * w_vhs * step(0.9, hash(vec2(floor(t * 0.5), 0.0))));
                
                // DIGITAL CORRUPTION: Datamosh & Macroblocking
                vec2 blockUv = floor(uv_warped * vec2(24.0, 16.0)) / vec2(24.0, 16.0);
                float blockNoise = hash(blockUv + floor(t * 6.0));
                if (blockNoise > 0.8 && w_dig > 0.1) {
                    uv_warped.x += (hash(blockUv * 2.0) - 0.5) * 0.3 * w_dig;
                    uv_warped.y += (hash(blockUv * 3.0) - 0.5) * 0.3 * w_dig;
                }
                
                // CHANNEL DRIFT & SIGNAL ECHO
                float drift = 0.01 + 0.06 * w_vhs + 0.15 * burst;
                vec2 offR = vec2(drift, 0.0);
                vec2 offG = vec2(-drift * 0.5, drift * 0.866);
                vec2 offB = vec2(-drift * 0.5, -drift * 0.866);
                
                float sigR = getSignal(uv_warped + offR, t, w_op, w_vhs);
                float sigG = getSignal(uv_warped + offG, t * 1.05, w_op, w_vhs);
                float sigB = getSignal(uv_warped + offB, t * 0.95, w_op, w_vhs);
                
                // STRICT PALETTE ENFORCEMENT
                vec3 colR = getColor(sigR + t * 0.1);
                vec3 colG = getColor(sigG + 0.33 + t * 0.1);
                vec3 colB = getColor(sigB + 0.66 + t * 0.1);
                
                // Non-linear mix (max) to prevent muddy/gray colors and preserve saturation
                vec3 finalColor = max(colR, max(colG, colB));
                
                // DIGITAL: Blocky Data Dropouts
                if (blockNoise > 0.95 && w_dig > 0.3) {
                    finalColor = getColor(blockNoise * 10.0 + t);
                }
                
                // FILM: Scratches & Light Leaks
                float scratch = hash(vec2(uv_warped.x * 150.0, floor(t * 12.0)));
                if (scratch > 0.99 && w_flm > 0.2) {
                    finalColor = vec3(1.0); // Pure White scratch
                }
                
                float leak = smoothstep(0.6, 1.0, sin(uv.x * 3.0 + t) * sin(uv.y * 2.0 - t));
                vec3 leakCol = mix(vec3(1.0, 0.1, 0.6), vec3(1.0, 0.9, 0.0), sin(t) * 0.5 + 0.5);
                finalColor = mix(finalColor, leakCol, leak * w_flm * 0.6);
                
                // CRT: Phosphor Mask & Scanlines
                float scanline = sin(uv.y * u_resolution.y * 3.1415) * 0.5 + 0.5;
                float maskX = sin(uv.x * u_resolution.x * 3.1415) * 0.5 + 0.5;
                float maskY = sin(uv.y * u_resolution.y * 3.1415 + (mod(floor(uv.x * u_resolution.x), 2.0) * 3.1415)) * 0.5 + 0.5;
                float phosphor = maskX * maskY;
                
                float crtIntensity = (scanline * 0.3 + 0.7) * (phosphor * 0.4 + 0.6);
                
                // Avoid Black: Use Saturated Purple as the "dark" gap in the CRT mask
                vec3 crtDark = vec3(0.7, 0.0, 1.0); 
                vec3 crtApplied = mix(crtDark, finalColor * 1.4, crtIntensity);
                
                finalColor = mix(finalColor, crtApplied, w_crt);
                
                // GLOBAL GLITCH: Temporal Flicker
                float flicker = hash(vec2(floor(t * 24.0), 1.0));
                if (flicker > 0.9 && w_flm > 0.3) {
                    finalColor = mix(finalColor, vec3(0.1, 1.0, 0.2), 0.8); // Flash Neon Green
                }
                
                fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            }
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}