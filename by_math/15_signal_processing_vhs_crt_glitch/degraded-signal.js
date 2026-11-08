// ============================================================================
// THE HAUNTED SIGNAL: A Feral Moiré / Damage Aesthetic Texture System
// ============================================================================
// EXPLANATION OF LAYERS:
// 1. crtCurve: Warps the UV space to simulate the physical bulge of a CRT tube.
// 2. vhsTrackingWarp: Applies horizontal tearing, sync drops, and bottom-screen head-switching noise.
// 3. digitalBlockDamage: Quantizes UVs to create datamosh-like compression smears.
// 4. opArtField & moireInterference: The base signal. A hostile Bridget Riley painting made of 
//    intersecting radial and linear sine waves, producing phase-shifted interference patterns.
// 5. rgbChannelDrift: Samples the composite signal three times with offset UVs to simulate chroma bleed.
// 6. filmScratchLayer & filmBurn: Injects vertical scratches and low-frequency amber overexposure blobs.
// 7. crtScanlines: Multiplies a high-frequency sine wave and a simulated RGB phosphor mask.
//
// TWEAK NOTES (Adjust the constants in the GLSL code below):
// 1. More VHS: Increase VHS_TRACKING (e.g., 0.15) and COLOR_BLEED (e.g., 0.03).
// 2. More CRT: Increase CRT_SCANLINES (e.g., 1.0) and PHOSPHOR_STRENGTH (e.g., 0.6).
// 3. More Digital Glitch: Increase GLITCH_INTENSITY (e.g., 0.8) and BLOCK_DAMAGE_FREQ (e.g., 0.95 to 0.8).
// 4. More Film Damage: Increase FILM_GRAIN (e.g., 0.3) and BURN_INTENSITY (e.g., 0.8).
// 5. More Op-Art/Moiré: Increase MOIRE_STRENGTH (e.g., 1.5) and OP_ART_DENSITY (e.g., 80.0).
// ============================================================================

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
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;

            // ============================================================================
            // FERAL DAMAGE CONTROLS
            // ============================================================================
            const float GLITCH_INTENSITY = 0.4;
            const float VHS_TRACKING = 0.08;
            const float CRT_SCANLINES = 0.7;
            const float RGB_SEPARATION = 0.015;
            const float FILM_GRAIN = 0.15;
            const float MOIRE_STRENGTH = 1.0;
            const float COLOR_BLEED = 0.02;
            const float NOISE_DENSITY = 0.8;
            const float BURN_INTENSITY = 0.5;
            const float OP_ART_DENSITY = 40.0;
            
            // ============================================================================
            // MATH & NOISE UTILS
            // ============================================================================
            float hashNoise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hashNoise(i + vec2(0.0,0.0)), hashNoise(i + vec2(1.0,0.0)), u.x),
                    mix(hashNoise(i + vec2(0.0,1.0)), hashNoise(i + vec2(1.0,1.0)), u.x),
                    u.y
                );
            }

            // ============================================================================
            // GEOMETRY WARPING
            // ============================================================================
            vec2 crtCurve(vec2 uv) {
                vec2 centered = uv * 2.0 - 1.0;
                vec2 offset = abs(centered.yx) / vec2(5.0, 4.0);
                centered = centered + centered * offset * offset;
                return centered * 0.5 + 0.5;
            }

            vec2 vhsTrackingWarp(vec2 uv, float t) {
                // Head switching noise at the bottom
                float headSwitch = step(0.92, uv.y);
                uv.x += (hashNoise(vec2(uv.y * 100.0, t)) - 0.5) * 0.1 * headSwitch;

                // Sync drop / horizontal tear
                float trackingNoise = hashNoise(vec2(t * 0.5, 0.0));
                float tear = step(0.97, trackingNoise) * sin(uv.y * 20.0 + t * 10.0) * 0.2;
                float jitter = (hashNoise(vec2(uv.y, t * 10.0)) - 0.5) * 0.01;
                
                uv.x += (tear + jitter) * VHS_TRACKING;
                
                // Occasional vertical roll
                float roll = step(0.99, hashNoise(vec2(t * 0.1, 1.0))) * (t * 2.0);
                uv.y = fract(uv.y + roll);
                
                return uv;
            }

            vec2 digitalBlockDamage(vec2 uv, float t) {
                // Datamosh / macroblock smearing
                vec2 grid = vec2(32.0, 24.0);
                vec2 blockUV = floor(uv * grid) / grid;
                float blockNoise = hashNoise(blockUV + floor(t * 4.0));
                
                float trigger = step(0.92, blockNoise);
                vec2 smearOffset = vec2(hashNoise(blockUV * 2.0) - 0.5, 0.0) * 0.2;
                
                return mix(uv, uv + smearOffset * GLITCH_INTENSITY, trigger);
            }

            // ============================================================================
            // OP-ART & MOIRE SIGNAL (THE GHOST IN THE MACHINE)
            // ============================================================================
            float opArtField(vec2 uv, float t) {
                vec2 warpedUV = uv + vec2(
                    smoothNoise(uv * 5.0 + t * 0.5),
                    smoothNoise(uv * 5.0 - t * 0.4)
                ) * 0.1;
                
                float stripes = sin(warpedUV.x * OP_ART_DENSITY + sin(warpedUV.y * OP_ART_DENSITY * 0.5 + t));
                return smoothstep(-0.2, 0.2, stripes);
            }

            float moireInterference(vec2 uv, float t) {
                vec2 c1 = vec2(0.5 + sin(t * 0.3) * 0.2, 0.5 + cos(t * 0.2) * 0.2);
                vec2 c2 = vec2(0.5 + cos(t * 0.4) * 0.1, 0.5 + sin(t * 0.5) * 0.1);
                
                float r1 = length(uv - c1);
                float r2 = length(uv - c2);
                
                float ring1 = sin(r1 * OP_ART_DENSITY * 2.0 - t * 2.0);
                float ring2 = sin(r2 * OP_ART_DENSITY * 2.1 + t * 1.5);
                
                // Multiplicative interference creates the phantom moire bands
                return (ring1 * ring2 * 0.5 + 0.5) * MOIRE_STRENGTH;
            }

            vec3 baseSignal(vec2 uv, float t) {
                float op = opArtField(uv, t);
                float mo = moireInterference(uv, t);
                
                // XOR-like blend for harsh optical tension
                float signal = abs(op - mo);
                
                // Dirty analog color palette
                vec3 darkMuck = vec3(0.05, 0.02, 0.08); // Bruised black
                vec3 sickGreen = vec3(0.4, 0.6, 0.4);
                vec3 oxidizedBlue = vec3(0.2, 0.4, 0.5);
                vec3 deadWhite = vec3(0.85, 0.85, 0.8);
                
                vec3 col = mix(darkMuck, oxidizedBlue, signal);
                col = mix(col, deadWhite, smoothstep(0.4, 0.6, mo));
                col = mix(col, sickGreen, smoothstep(0.8, 1.0, op) * 0.5);
                
                return col;
            }

            // ============================================================================
            // COLOR DRIFT & BLEED
            // ============================================================================
            vec3 rgbChannelDrift(vec2 uv, float t) {
                float driftAmount = RGB_SEPARATION + (hashNoise(vec2(t, 0.0)) > 0.95 ? 0.05 : 0.0);
                
                // Luma/Chroma separation simulation (colors smear wider than luma)
                vec2 rUV = uv + vec2(driftAmount + COLOR_BLEED, 0.0);
                vec2 gUV = uv;
                vec2 bUV = uv - vec2(driftAmount * 0.5, driftAmount * 0.2);
                
                float r = baseSignal(rUV, t).r;
                float g = baseSignal(gUV, t).g;
                float b = baseSignal(bUV, t).b;
                
                return vec3(r, g, b);
            }

            // ============================================================================
            // DIRT, SCRATCHES & BURNS
            // ============================================================================
            vec3 filmScratchLayer(vec3 col, vec2 uv, float t) {
                // Scratches (Vertical)
                float scratchX = uv.x * 2.0 + hashNoise(vec2(floor(t * 12.0), 0.0)) * 0.1;
                float scratchNoise = hashNoise(vec2(scratchX, 0.0));
                float scratch = step(0.995, scratchNoise) * (0.5 + 0.5 * sin(t * 5.0 + uv.y * 10.0));
                col += scratch * vec3(0.8, 0.9, 0.7) * FILM_GRAIN * 5.0;
                
                // Dust & Grain
                float grain = hashNoise(uv * t) * 2.0 - 1.0;
                col += grain * FILM_GRAIN;
                
                // Film Burn (Amber / Orange)
                vec2 burnUV = uv + vec2(t * 0.1, -t * 0.05);
                float burnNoise = smoothNoise(burnUV * 3.0) * smoothNoise(burnUV * 8.0);
                float burn = smoothstep(0.6, 1.0, burnNoise + hashNoise(vec2(t)) * 0.1);
                vec3 burnColor = vec3(0.9, 0.3, 0.05); // Sickly amber/red
                
                col = mix(col, burnColor, burn * BURN_INTENSITY);
                
                return col;
            }

            // ============================================================================
            // CRT DISPLAY OVERLAY
            // ============================================================================
            vec3 crtDisplay(vec3 col, vec2 uv) {
                // High frequency scanlines
                float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.04;
                col -= scanline * CRT_SCANLINES;
                
                // Phosphor dot mask (RGB triads)
                float mask = mod(uv.x * u_resolution.x, 3.0);
                vec3 phosphor = vec3(
                    step(mask, 1.0),
                    step(1.0, mask) * step(mask, 2.0),
                    step(2.0, mask)
                );
                
                // Blend phosphor mask
                col = mix(col, col * phosphor * 2.0, 0.15 * CRT_SCANLINES);
                
                // Vignette
                float vignette = length(uv - 0.5);
                col *= smoothstep(0.8, 0.3, vignette);
                
                return col;
            }

            // ============================================================================
            // MAIN COMPOSITE
            // ============================================================================
            void main() {
                vec2 uv = vUv;
                float t = u_time * 0.5; // Scale time for better pacing
                
                // 1. Hardware Curve
                uv = crtCurve(uv);
                
                // Out of bounds check for CRT curve
                if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                    fragColor = vec4(0.01, 0.01, 0.01, 1.0);
                    return;
                }
                
                // 2. Playback / Digital Damage
                uv = vhsTrackingWarp(uv, t);
                uv = digitalBlockDamage(uv, t);
                
                // 3. Signal Generation & Chroma Separation
                vec3 col = rgbChannelDrift(uv, t);
                
                // 4. Material Contamination
                col = filmScratchLayer(col, uv, t);
                
                // 5. Display Artifacts
                col = crtDisplay(col, uv);
                
                // 6. Final contrast crush to emulate bad dynamic range
                col = smoothstep(0.05, 0.95, col);
                
                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader,
            fragmentShader
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        if (material.uniforms.u_time) material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
        }
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("The Haunted Signal initialization failed:", e);
}