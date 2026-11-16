if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
            uniform float u_time;
            uniform vec2 u_resolution;

            in vec2 vUv;
            out vec4 fragColor;

            // --- FERAL MATH & NOISE PRIMITIVES ---
            
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float f = 0.0;
                float amp = 0.5;
                for(int i = 0; i < 5; i++) {
                    f += amp * noise(p);
                    p *= 2.01;
                    amp *= 0.5;
                }
                return f;
            }

            // --- 1. DIGITAL GLITCH & COMPRESSION ROT ---
            // Simulates macroblock failure, datamoshing, and packet loss
            vec2 digitalBlockDamage(vec2 uv, float t) {
                float machineHesitation = step(0.95, hash(vec2(t * 0.5, 0.0))); // Sudden panic
                vec2 gridDim = vec2(32.0, 24.0);
                vec2 block = floor(uv * gridDim);
                
                // Blocky offset triggered by noise threshold
                float n = hash(block + floor(t * 12.0));
                if (n > 0.88 - machineHesitation * 0.2) {
                    float smear = hash(vec2(block.y, floor(t * 4.0))); // Datamosh horizontal smear
                    uv.x += (smear - 0.5) * 0.15;
                    uv.y += (hash(block + 1.0) - 0.5) * 0.02;
                }
                return uv;
            }

            // --- 2. VHS TRACKING & HORIZONTAL TEAR ---
            // Simulates magnetic tape wobble, vertical sync roll, and head switching noise
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                // Vertical sync roll (slow, irregular drifting)
                uv.y = fract(uv.y + t * 0.02 + noise(vec2(t * 0.1)) * 0.05);

                // Head switching noise at bottom of frame
                float trackingBand = smoothstep(0.15, 0.0, uv.y);
                float trackingNoise = noise(vec2(uv.y * 200.0, t * 60.0));
                uv.x += trackingBand * (trackingNoise - 0.5) * 0.1;

                // Horizontal tearing (intermittent violent jumps)
                float tearThreshold = step(0.97, hash(vec2(uv.y * 15.0, floor(t * 15.0))));
                float tearWarp = sin(uv.y * 40.0 + t * 10.0) * 0.05;
                uv.x += tearThreshold * tearWarp;

                // Tape wobble
                uv.x += sin(uv.y * 5.0 + t * 2.0) * 0.003;
                
                return uv;
            }

            // --- 3. MOIRÉ & OP-ART INTERFERENCE ---
            // Bridget Riley trapped in a dying VCR. Incommensurate frequencies & domain warping.
            float opArtField(vec2 uv, float t) {
                vec2 p = uv * 2.0 - 1.0;
                p.x *= u_resolution.x / u_resolution.y;
                
                // Hyperbolic folding and fungal domain warping
                float warp = fbm(p * 2.0 + t * 0.2);
                p += normalize(p) * warp * 0.3;
                
                float d = length(p);
                
                // Sum of incommensurate frequencies to create impossible tension
                float freq = 20.0 + sin(t * 0.5) * 5.0;
                float wave = sin(d * freq) + sin(d * freq * 1.618) * 0.5 + sin(d * freq * 2.718) * 0.25;
                
                // Hypnotic high-contrast thresholding
                return smoothstep(-0.1, 0.1, wave);
            }

            float moireInterference(vec2 uv, float t) {
                // Phase-shifted pattern overlays
                float layer1 = opArtField(uv, t);
                
                // Rotate and scale second layer for moiré beat patterns
                float s = sin(t * 0.1);
                float c = cos(t * 0.1);
                mat2 rot = mat2(c, -s, s, c);
                vec2 uv2 = (uv - 0.5) * rot * 1.05 + 0.5;
                
                float layer2 = opArtField(uv2, t * 1.1 + 10.0);
                
                // XOR-ghost manifold logic
                return abs(layer1 - layer2); 
            }

            // --- 4. BASE DEGRADED SIGNAL ---
            vec3 baseSignal(vec2 uv, float t) {
                float moire = moireInterference(uv, t);
                
                // Dirty analog palette: oxidized yellow-white and bruised dead black
                vec3 darkVal = vec3(0.04, 0.02, 0.05); // Muddy shadow contamination
                vec3 lightVal = vec3(0.85, 0.82, 0.75); // Cigarette ash white
                
                vec3 col = mix(darkVal, lightVal, moire);
                
                // Analog signal bleed (horizontal smearing)
                float bleed = sin(uv.y * 100.0 + t * 20.0) * 0.05;
                col += vec3(0.1, 0.02, 0.08) * bleed; // Bruised magenta undertone
                
                return col;
            }

            // --- 5. RGB CHANNEL DRIFT (CHROMATIC ABERRATION) ---
            vec3 rgbChannelDrift(vec2 uv, float t) {
                // Drift amount fluctuates based on machine hesitation
                float driftAmt = 0.005 + 0.02 * pow(noise(vec2(t * 2.0, 0.0)), 3.0);
                
                vec2 rUV = uv + vec2(driftAmt, 0.0);
                vec2 gUV = uv + vec2(0.0, driftAmt * 0.2); // Slight vertical misregistration
                vec2 bUV = uv - vec2(driftAmt, 0.0);
                
                float r = baseSignal(rUV, t).r;
                float g = baseSignal(gUV, t).g;
                float b = baseSignal(bUV, t).b;
                
                // Cyan channel bleed enhancement
                g += 0.05 * b; 
                b += 0.05 * g;
                
                return vec3(r, g, b);
            }

            // --- 6. FILM DAMAGE (GRAIN, SCRATCHES, BURNS) ---
            vec3 filmDamageLayer(vec3 col, vec2 uv, float t) {
                // Analog snow / noise grain
                float grain = hash(uv * t);
                col -= grain * 0.15;
                
                // Deep physical film scratches
                float scratchX = uv.x + sin(uv.y * 3.0 + t) * 0.02;
                float scratch = step(0.998, hash(vec2(scratchX * 5.0, floor(t * 14.0))));
                col += scratch * vec3(0.8, 0.8, 0.7); // Bright oxidized scratch
                
                // Overexposed amber film burn / thermal bloom
                float burnNoise = fbm(uv * 3.0 - vec2(0.0, t * 0.5));
                // Throttle burn frequency
                float burnPulse = smoothstep(0.4, 0.9, sin(t * 0.3)); 
                float burn = smoothstep(0.65, 0.85, burnNoise) * burnPulse;
                vec3 burnCol = vec3(0.95, 0.4, 0.05) * burn; // Sickly amber
                col += burnCol;
                
                return col;
            }

            // --- 7. CRT RASTER & PHOSPHOR TRIAD ---
            vec3 crtScanlines(vec3 col, vec2 uv, vec2 fragCoord) {
                // Horizontal scanline decay
                float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.08;
                col -= scanline;
                
                // Phosphor triad mask (RGB grid mapping)
                float triad = mod(fragCoord.x, 3.0);
                vec3 mask = vec3(0.0);
                if (triad < 1.0) mask = vec3(1.0, 0.6, 0.6);      // Red phosphor
                else if (triad < 2.0) mask = vec3(0.6, 1.0, 0.6); // Green phosphor
                else mask = vec3(0.6, 0.6, 1.0);                  // Blue phosphor
                
                // Blend mask loosely to avoid total darkening
                col *= mix(vec3(1.0), mask, 0.35);
                
                // Sickly green CRT glow around edges
                float vignette = length(uv - 0.5);
                col *= smoothstep(0.9, 0.3, vignette);
                col += vec3(0.0, 0.05, 0.02) * smoothstep(0.4, 0.8, vignette);
                
                return col;
            }

            // --- MAIN COMPOSITE ---
            void main() {
                // Time warping (machine hesitation & P-adic time leaks)
                float t = u_time + noise(vec2(u_time * 0.5)) * 1.5;
                
                // Normalize UV
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                
                // 1. Digital Block Corruption
                uv = digitalBlockDamage(uv, t);
                
                // 2. VHS Tracking & Tear
                uv = vhsTrackingWarp(uv, t);
                
                // 3 & 4 & 5. Base Signal + Op-Art Moiré + RGB Channel Drift
                vec3 col = rgbChannelDrift(uv, t);
                
                // 6. Film Scratches, Grain, and Overexposed Burns
                col = filmDamageLayer(col, uv, t);
                
                // 7. CRT Scanlines, Phosphors, and Vignette
                col = crtScanlines(col, uv, gl_FragCoord.xy);
                
                // Flicker / Black crush
                float flicker = 0.95 + 0.05 * hash(vec2(t * 10.0));
                col *= flicker;
                
                // Final output
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
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
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

/*
===============================================================================
THE WEIRD CODE GUY - SHADER EXPLANATION & TWEAK NOTES
===============================================================================

[LAYER EXPLANATION]
1. digitalBlockDamage: Warps UVs in a grid pattern. Uses high-threshold noise 
   to trigger sudden UV offsets, creating datamosh smears and macroblock rot.
2. vhsTrackingWarp: Mutates UV.y over time to create an endless vertical roll. 
   Injects high-frequency noise at the bottom (head switching) and violent 
   horizontal sine offsets (tearing).
3. opArtField & moireInterference: The core content. FBM domain-warped sine 
   waves using incommensurate frequencies (golden ratio/euler multipliers). 
   Two fields overlap with rotation to create heavy interference (XOR logic).
4. baseSignal: Maps the moiré to a dirty palette (cigarette ash white, dead 
   bruised black) and adds a horizontal analog bleed.
5. rgbChannelDrift: Samples the base signal 3 times with fluctuating offsets. 
   Injects cyan/magenta crosstalk to mimic component video degradation.
6. filmDamageLayer: Adds stochastic pixel noise (grain), physical scratch lines, 
   and low-frequency FBM thresholding for amber thermal film burns.
7. crtScanlines: Multiplies horizontal sine waves and a modulo-3 RGB phosphor 
   mask. Finishes with a sickly green-tinted vignette.

[TWEAK NOTES]
1. MORE VHS: Increase the multiplier on `trackingNoise` in `vhsTrackingWarp`. 
   Change `t * 0.02` to `t * 0.1` in the `uv.y` roll to make the VCR panic.
2. MORE CRT: Increase the `0.35` multiplier on `mix(vec3(1.0), mask, 0.35)` 
   in `crtScanlines` to make the RGB phosphor triad more aggressive.
3. MORE DIGITAL GLITCH: Lower the `0.88` threshold in `digitalBlockDamage` 
   to `0.7` so blocks corrupt constantly instead of intermittently.
4. MORE FILM DAMAGE: Lower the `0.998` threshold in `scratch` to `0.95` for 
   a destroyed negative. Increase `burnPulse` amplitude to melt the film.
5. MORE OP-ART: In `opArtField`, increase `freq` from 20.0 to 50.0. Remove 
   the `fbm` warp to make the concentric geometry brutally clean and hypnotic.
===============================================================================
*/