/**
 * THE WEIRD CODE GUY - FERAL GLITCH ENGINE
 * 
 * [EXPLANATION OF MAJOR SYSTEMS]
 * This shader is a "competitive damage" state machine. It does not apply a static 
 * filter; instead, it uses overlapping low-frequency noise (time envelopes) to rotate 
 * dominance between five distinct media failure families:
 * 
 * 1. env_vhs: Analog tracking errors, horizontal tearing, magnetic tape creases, chroma drift.
 * 2. env_digi: Datamosh block stutter, macroblocking, temporal lag, quantized posterization.
 * 3. env_film: Gate weave (XY wobble), vertical emulsion scratches, chemical light leaks.
 * 4. env_moire: Op-Art structural vibration, phase cancellation bands, concentric funnel traps.
 * 5. env_crt: Phosphor shadow mask alignment, neon scanline dimming, signal bloom.
 * 
 * [STRICT COLOR MAPPING]
 * The signal is processed as three independent offset channels (simulating RGB drift), 
 * but instead of standard RGB, the intensities are used as barycentric weights to blend 
 * ONLY the allowed neon palette (Purple, Hot Pink, Pastel Pink, Teal, Neon Green, Yellow, White).
 * Black is entirely replaced by Saturated Purple to maintain maximum visual energy.
 * 
 * [TWEAK NOTES FOR THE BRAVE]
 * To adjust the dominance of any system, look for the "STATE CONTROLLER" section in the fragment shader.
 * - More VHS: Increase the base multiplier on `env_vhs`.
 * - More CRT: Boost `env_crt` and increase the phosphor mask multiplier (`env_crt * 0.7`).
 * - More Digital: Increase `env_digi` and lower the block size vector `vec2(20.0, 15.0)`.
 * - More Film: Boost `env_film` and increase the scratch density threshold (`0.99`).
 * - More Moiré/Op-Art: Increase `env_moire` and multiply the frequencies inside `getSignal()`.
 * - Stronger Mode-Switching: Change the sine-wave powers from `2.0` to `6.0` to make the peaks sharper and shorter.
 */

try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
            uniform float u_time;
            uniform vec2 u_resolution;
            out vec4 fragColor;

            // Pseudo-random hash functions
            float hash12(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * .1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            // The core Op-Art / Moiré signal generator
            float getSignal(vec2 p, float t, float moireEnv) {
                vec2 center = p - 0.5;
                float radius = length(center);
                float angle = atan(center.y, center.x);

                // Radial Hypnosis Field
                float radial = sin(radius * (80.0 + moireEnv * 60.0) - t * 4.0);

                // Stripe Fluid Distortion
                float stripe = sin(p.x * 60.0 + sin(p.y * 40.0 + t * 2.0) * 4.0);

                // Warped Checker Funnel
                float checker = sign(sin(p.x * 50.0 + angle) * sin(p.y * 50.0 + radius * 10.0));

                // Moiré Phase Interference
                float phase1 = sin(radius * 120.0);
                float phase2 = sin(length(center + vec2(sin(t)*0.03, cos(t)*0.03)) * 120.0);
                float interference = phase1 * phase2;

                // Blend systems based on moire envelope
                float base = mix(radial, interference, moireEnv * 0.8);
                base = mix(base, checker, 0.2);
                base += stripe * 0.3;

                return base * 0.5 + 0.5; // Normalize 0-1
            }

            void main() {
                vec2 uv = vUv;
                float time = u_time;

                // ==========================================
                // 1. STATE CONTROLLER (The Dominance Engine)
                // ==========================================
                float tSpeed = time * 0.4;
                
                // Overlapping power-sine envelopes create surging, competing states
                float env_vhs   = pow(sin(tSpeed * 1.1 + 0.0) * 0.5 + 0.5, 2.0);
                float env_digi  = pow(sin(tSpeed * 1.3 + 2.1) * 0.5 + 0.5, 4.0); // Spikier
                float env_film  = pow(sin(tSpeed * 0.8 + 4.5) * 0.5 + 0.5, 2.0);
                float env_moire = pow(sin(tSpeed * 0.9 + 1.2) * 0.5 + 0.5, 1.5);
                float env_crt   = pow(sin(tSpeed * 1.5 + 5.7) * 0.5 + 0.5, 2.0);

                // Rare, violent corruption bursts
                float burst = step(0.98, fract(sin(time * 17.34) * 43758.54));
                env_vhs  = clamp(env_vhs + burst, 0.0, 1.0);
                env_digi = clamp(env_digi + burst, 0.0, 1.0);

                // ==========================================
                // 2. SPATIAL & TEMPORAL MANGLEMENT (UV Warping)
                // ==========================================
                float localTime = time;

                // DIGITAL: Macroblock Stutter & Datamosh
                if (env_digi > 0.05) {
                    vec2 blockUv = floor(uv * vec2(20.0, 15.0)) / vec2(20.0, 15.0);
                    float blockHash = hash12(blockUv + floor(time * 6.0));
                    if (blockHash < env_digi * 0.6) {
                        localTime = floor(time * 4.0) / 4.0 - blockHash; // Time stutter
                        uv.x += (blockHash * 0.1) * env_digi; // Spatial smear
                    }
                }

                // FILM: Gate Weave & Splice Jumps
                if (env_film > 0.05) {
                    uv.x += sin(time * 14.0) * 0.005 * env_film;
                    uv.y += cos(time * 9.0)  * 0.005 * env_film;
                    float splice = step(0.97, fract(sin(time * 3.1) * 43758.54));
                    uv.y += splice * 0.2 * env_film;
                }

                // VHS: Horizontal Tracking Tear & Creases
                if (env_vhs > 0.05) {
                    float tearY = uv.y * 12.0 + time * 3.0;
                    float tear = sin(tearY) + sin(tearY * 2.7) + sin(tearY * 6.3);
                    float offset = step(1.2, tear) * 0.08 * env_vhs;
                    uv.x += offset * sin(time * 60.0); // Jitter tear

                    // Magnetic tape crease
                    float crease = exp(-pow((uv.y - 0.5 + sin(time * 0.8) * 0.4) * 30.0, 2.0));
                    uv.x += crease * 0.04 * env_vhs;
                }

                // ==========================================
                // 3. SIGNAL GENERATION & CHANNEL DRIFT
                // ==========================================
                float driftAmt = 0.005 + (0.04 * env_vhs) + (0.02 * env_digi) + (burst * 0.1);
                vec2 driftDir = vec2(1.0, sin(time * 2.0) * 0.2); // Mostly horizontal

                float sig1 = getSignal(uv + driftDir * driftAmt, localTime, env_moire);
                float sig2 = getSignal(uv, localTime, env_moire);
                float sig3 = getSignal(uv - driftDir * driftAmt, localTime, env_moire);

                // DIGITAL: Compression Banding / Quantization
                if (env_digi > 0.2) {
                    float steps = 5.0 - (env_digi * 2.0); // Fewer steps = more broken
                    sig1 = floor(sig1 * steps) / steps;
                    sig2 = floor(sig2 * steps) / steps;
                    sig3 = floor(sig3 * steps) / steps;
                }

                // ==========================================
                // 4. NEON COLOR MAPPING (Strict Palette)
                // ==========================================
                // Allowed: Purple, Hot Pink, Pastel Pink, Teal, Neon Green, Yellow, White.
                // NO BLACK. Darkest color is saturated purple.
                
                vec3 cPurple    = vec3(0.6, 0.0, 0.8);
                vec3 cHotPink   = vec3(1.0, 0.0, 0.6);
                vec3 cPastel    = vec3(1.0, 0.5, 0.8);
                vec3 cTeal      = vec3(0.0, 0.9, 0.9);
                vec3 cNeonGreen = vec3(0.2, 1.0, 0.2);
                vec3 cYellow    = vec3(1.0, 1.0, 0.0);
                vec3 cWhite     = vec3(1.0, 1.0, 1.0);

                // Map signals to color ranges
                vec3 col1 = mix(cPurple, cHotPink, sig1);       // Shadow to Mid
                vec3 col2 = mix(cNeonGreen, cTeal, sig2);       // Mid to High
                vec3 col3 = mix(cPastel, cYellow, sig3);        // Mid to Peak

                // Max blending creates intense, overlapping neon chromatic aberration
                vec3 finalColor = max(col1 * sig1, max(col2 * sig2, col3 * sig3));

                // Add pure white peaks for high-energy signal overlap
                float masterSig = (sig1 + sig2 + sig3) / 3.0;
                finalColor += cWhite * smoothstep(0.85, 1.0, masterSig);

                // ==========================================
                // 5. SURFACE DAMAGE & CONTAMINATION
                // ==========================================
                
                // VHS: Analog Snow / Static
                if (env_vhs > 0.05) {
                    float snowHash = hash12(uv * 100.0 + time);
                    vec3 snowCol = mix(cHotPink, cTeal, step(0.5, snowHash));
                    finalColor = mix(finalColor, snowCol, snowHash * 0.4 * env_vhs);
                }

                // FILM: Scratches & Chemical Light Leaks
                if (env_film > 0.05) {
                    float scratchHash = hash12(vec2(uv.x * 150.0, floor(time * 14.0)));
                    float scratch = step(0.992, scratchHash) * env_film;
                    finalColor = mix(finalColor, cYellow, scratch); // Yellow scratches

                    float leak = smoothstep(0.2, 0.8, sin(uv.x * 4.0 + time) * sin(uv.y * 3.0 - time * 1.2));
                    finalColor = mix(finalColor, cPastel, leak * env_film * 0.6); // Pastel pink burn
                }

                // ==========================================
                // 6. CRT DECAY (Raster & Phosphor Mask)
                // ==========================================
                if (env_crt > 0.05) {
                    // Scanlines (dimmed to Purple instead of Black)
                    float scanY = uv.y * u_resolution.y * 0.8;
                    float scanline = sin(scanY * 3.14159) * 0.5 + 0.5;
                    vec3 scanDark = cPurple * 0.5; // Deep purple shadow
                    finalColor = mix(finalColor, mix(scanDark, finalColor, scanline * 0.5 + 0.5), env_crt * 0.8);

                    // Phosphor RGB Mask (using Neon variants)
                    float maskX = mod(gl_FragCoord.x, 3.0);
                    vec3 pCol = vec3(0.0);
                    if (maskX < 1.0) pCol = cHotPink;
                    else if (maskX < 2.0) pCol = cTeal;
                    else pCol = cYellow;

                    // Multiply and boost to simulate luminous phosphor emission
                    finalColor = mix(finalColor, finalColor * pCol * 2.2, env_crt * 0.65);
                }

                // Clamp to prevent blowout beyond neon limits
                fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
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
    console.error("Feral Glitch Engine Initialization Failed:", e);
}