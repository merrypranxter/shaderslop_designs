try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
            precision highp float;
            
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;

            // =====================================================================
            // TWEAKABLE DAMAGE CONTROLS
            // =====================================================================
            #define GLITCH_INTENSITY 1.2
            #define VHS_TRACKING_DAMAGE 1.5
            #define CRT_SCANLINE_STRENGTH 0.85
            #define RGB_SEPARATION_AMOUNT 0.012
            #define FILM_GRAIN_AMOUNT 0.15
            #define MOIRE_OP_ART_STRENGTH 1.0
            #define DISTORTION_SPEED 1.0
            #define DAMAGE_FREQUENCY 0.8
            #define OVERALL_CONTRAST 1.2
            #define BLOOM_BLEED_INTENSITY 0.7

            // =====================================================================
            // UTILITIES & NOISE
            // =====================================================================
            float hashNoise(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hashNoise(i + vec2(0.0, 0.0)), hashNoise(i + vec2(1.0, 0.0)), u.x),
                           mix(hashNoise(i + vec2(0.0, 1.0)), hashNoise(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float f = 0.0;
                float w = 0.5;
                for(int i = 0; i < 5; i++) {
                    f += w * valueNoise(p);
                    p *= 2.0;
                    w *= 0.5;
                }
                return f;
            }

            // =====================================================================
            // 6. MOIRÉ / OP-ART INTERFERENCE LAYER
            // =====================================================================
            float opArtField(vec2 uv, float t) {
                // Bridget Riley falling into a malfunctioning VCR
                vec2 p = uv * 2.0 - 1.0;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Warped structural tension
                float warp = sin(r * 15.0 - t * 2.0) * 0.15 * MOIRE_OP_ART_STRENGTH;
                float spiral = sin(a * 8.0 + r * 40.0 + warp * 25.0 + t);
                
                // Broken checker grid fighting the spiral
                float grid = sin(uv.x * 80.0 + t) * cos(uv.y * 80.0 - t * 1.5);
                
                // High-contrast thresholding
                return smoothstep(-0.1, 0.1, spiral * grid + warp);
            }

            float moireInterference(vec2 uv, float t) {
                // Phase-shifted pattern overlays creating optical vibration
                float m1 = sin(length(uv - vec2(0.3, 0.6)) * 200.0 - t * 4.0);
                float m2 = sin(length(uv - vec2(0.7, 0.4)) * 196.0 + t * 3.5);
                float m3 = sin(uv.x * 150.0 + sin(uv.y * 50.0 + t));
                return smoothstep(0.2, 0.8, (m1 * m2 + m3) * 0.5 + 0.5);
            }

            // =====================================================================
            // 1. BASE DEGRADED VIDEO SIGNAL LAYER
            // =====================================================================
            float signalComposite(vec2 uv, float t) {
                // The underlying signal is an unstable mix of Op-Art and Moiré
                float op = opArtField(uv, t);
                
                // Interference ripples pushing the UVs
                vec2 moireUv = uv + vec2(sin(t * DISTORTION_SPEED), cos(t * DISTORTION_SPEED)) * 0.02;
                float moire = moireInterference(moireUv, t);
                
                // Signal slip and dropout bursts
                float slip = step(0.95, hashNoise(vec2(t * 0.1, 1.0))) * sin(uv.y * 10.0 + t * 20.0);
                
                return mix(op, moire, 0.5 + slip * 0.5);
            }

            // =====================================================================
            // DIRTY ANALOG COLOR MAPPING
            // =====================================================================
            vec3 mapToDirtyPalette(float sig, float t) {
                // Dead black, bruised magenta, oxidized blue, sickly green, off-white
                vec3 deadBlack = vec3(0.08, 0.05, 0.10);
                vec3 bruisedMag = vec3(0.40, 0.15, 0.30);
                vec3 oxidizedBlue = vec3(0.15, 0.35, 0.45);
                vec3 sicklyGreen = vec3(0.50, 0.60, 0.30);
                vec3 offWhite = vec3(0.85, 0.80, 0.75);

                // Non-linear color mapping to simulate chemical/phosphor decay
                vec3 col = mix(deadBlack, bruisedMag, smoothstep(0.0, 0.25, sig));
                col = mix(col, oxidizedBlue, smoothstep(0.25, 0.5, sig));
                col = mix(col, sicklyGreen, smoothstep(0.5, 0.75, sig));
                col = mix(col, offWhite, smoothstep(0.75, 1.0, sig));
                
                // Muddy shadow contamination
                float mud = fbm(vec2(sig * 10.0, t));
                col -= mud * 0.15;
                
                return col * OVERALL_CONTRAST;
            }

            // =====================================================================
            // 4. DIGITAL CORRUPTION / BLOCK ARTIFACT LAYER
            // =====================================================================
            vec2 digitalBlockDamage(vec2 uv, float t) {
                // Macroblocking and datamosh prediction residue
                float blockRes = 32.0;
                vec2 blockUv = floor(uv * blockRes) / blockRes;
                
                // Trigger damage based on frequency and time
                float damageTrigger = hashNoise(blockUv + floor(t * 10.0 * DISTORTION_SPEED));
                
                if (damageTrigger > (1.0 - 0.05 * GLITCH_INTENSITY * DAMAGE_FREQUENCY)) {
                    // Datamosh smear: borrow UVs from a neighboring block
                    return blockUv + vec2(sin(t * 10.0), cos(t * 10.0)) * 0.05;
                }
                
                if (damageTrigger > (1.0 - 0.1 * GLITCH_INTENSITY)) {
                    // Packet loss fragmentation
                    return uv + (hashNoise(uv + t) - 0.5) * 0.02;
                }
                
                return uv;
            }

            // =====================================================================
            // 3. VHS TRACKING & HORIZONTAL TEAR LAYER
            // =====================================================================
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                vec2 warped = uv;
                
                // Rolling vertical sync error
                float roll = fract(t * 0.2);
                if (hashNoise(vec2(t * 0.5)) > 0.9) {
                    warped.y = fract(warped.y + roll);
                }

                // Horizontal tracking distortion / tape wobble
                float wobble = sin(uv.y * 15.0 + t * 5.0) * 0.005 * VHS_TRACKING_DAMAGE;
                wobble += sin(uv.y * 50.0 - t * 15.0) * 0.002 * VHS_TRACKING_DAMAGE;
                warped.x += wobble;

                // Violent horizontal tear / dropout
                float tearPos = hashNoise(vec2(floor(t * 12.0), 0.0));
                float tearWidth = 0.05 + hashNoise(vec2(t)) * 0.1;
                if (abs(uv.y - tearPos) < tearWidth) {
                    float tearOffset = (hashNoise(vec2(uv.y * 100.0, t)) - 0.5) * 0.2 * GLITCH_INTENSITY;
                    warped.x += tearOffset;
                }
                
                // Head-switching noise at the bottom
                if (uv.y < 0.05) {
                    warped.x += (hashNoise(vec2(uv.y * 500.0, t * 50.0)) - 0.5) * 0.05 * VHS_TRACKING_DAMAGE;
                }

                return warped;
            }

            // =====================================================================
            // CHROMATIC ABERRATION & RGB DRIFT
            // =====================================================================
            vec3 rgbChannelDrift(vec2 uv, float t) {
                // Drifting RGB separation
                float driftAmount = RGB_SEPARATION_AMOUNT * (1.0 + sin(t * 2.0) * 0.5);
                
                // Adding a sudden glitch jump to the drift
                if (hashNoise(vec2(t * 5.0)) > 0.95) driftAmount *= 5.0;

                vec2 offsetR = vec2(driftAmount, 0.0);
                vec2 offsetB = vec2(-driftAmount * 0.5, driftAmount * 0.8);

                float sigR = signalComposite(uv + offsetR, t);
                float sigG = signalComposite(uv, t);
                float sigB = signalComposite(uv + offsetB, t);

                vec3 colR = mapToDirtyPalette(sigR, t);
                vec3 colG = mapToDirtyPalette(sigG, t);
                vec3 colB = mapToDirtyPalette(sigB, t);

                // Cyan channel bleed & Bruised Magenta separation
                return vec3(colR.r, colG.g, colB.b);
            }

            // =====================================================================
            // 5. DIRTY FILM GRAIN, SCRATCH & BURN LAYER
            // =====================================================================
            float filmScratchLayer(vec2 uv, float t) {
                // Vertical lines moving randomly (gate weave / scratches)
                float scratchHash = hashNoise(vec2(floor(uv.x * 800.0 + sin(t) * 10.0), floor(t * 8.0)));
                float scratch = step(0.998, scratchHash);
                // Make scratches varying in brightness
                return scratch * (0.5 + 0.5 * hashNoise(uv + t));
            }

            float filmGrain(vec2 uv, float t) {
                // Analog snow / noise grain
                return (hashNoise(uv * 500.0 + t * 100.0) - 0.5) * FILM_GRAIN_AMOUNT;
            }
            
            vec3 overexposedFilmBurn(vec2 uv, float t, vec3 baseCol) {
                // Amber film burn / washed-out yellow-white overexposure
                float burnNoise = fbm(uv * 3.0 + vec2(t * 0.5, -t * 0.2));
                float burnTrigger = sin(t * 0.5) * 0.5 + 0.5; // Pulsing
                
                if (burnNoise > 0.6 + burnTrigger * 0.3) {
                    float intensity = (burnNoise - 0.6) * 3.0;
                    vec3 amber = vec3(0.95, 0.65, 0.20);
                    return mix(baseCol, amber, clamp(intensity * BLOOM_BLEED_INTENSITY, 0.0, 1.0));
                }
                return baseCol;
            }

            // =====================================================================
            // 2. CRT SCANLINE & PHOSPHOR LAYER
            // =====================================================================
            vec3 crtScanlines(vec3 col, vec2 uv, vec2 fragCoord) {
                // Subtle CRT curve warp
                vec2 dc = uv - 0.5;
                float r2 = dot(dc, dc);
                uv += dc * r2 * 0.1; // Barrel distortion

                // Scanlines (horizontal)
                float scanline = sin(uv.y * 800.0) * 0.15 * CRT_SCANLINE_STRENGTH + (1.0 - 0.15 * CRT_SCANLINE_STRENGTH);
                
                // Phosphor triad grid (vertical masking)
                float triad = sin(fragCoord.x * 2.0) * 0.1 * CRT_SCANLINE_STRENGTH + (1.0 - 0.1 * CRT_SCANLINE_STRENGTH);
                
                // Phosphor bloom (softening brights)
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                vec3 bloom = col * smoothstep(0.6, 1.0, luma) * 0.3 * BLOOM_BLEED_INTENSITY;

                vec3 crtCol = (col + bloom) * scanline * triad;
                
                // Edge vignette (darkening borders)
                float vignette = smoothstep(0.8, 0.2, length(dc * 1.5));
                return crtCol * vignette;
            }

            // =====================================================================
            // MAIN COMPOSITE
            // =====================================================================
            void main() {
                vec2 uv = vUv;
                float t = u_time;

                // CRT Curvature applied to base UV
                vec2 dc = uv - 0.5;
                uv += dc * dot(dc, dc) * 0.15;

                // 1. Digital Block Damage (Datamosh / Macroblocks)
                uv = digitalBlockDamage(uv, t);

                // 2. VHS Tracking & Tear (Analog tape wobble)
                uv = vhsTrackingWarp(uv, t);

                // 3. RGB Channel Drift & Base Signal Generation (Op-Art / Moiré)
                vec3 col = rgbChannelDrift(uv, t);

                // 4. Film Scratches & Burns
                float scratch = filmScratchLayer(uv, t);
                col += vec3(0.8, 0.8, 0.7) * scratch * 0.5; // Add bright scratches
                col = overexposedFilmBurn(uv, t, col);

                // 5. Film Grain / Analog Snow
                col += filmGrain(uv, t);

                // 6. CRT Scanlines, Phosphor Triads, Bloom, and Vignette
                col = crtScanlines(col, uv, gl_FragCoord.xy);

                // Final clamp
                fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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

/*
===============================================================================
THE WEIRD CODE GUY - SHADER EXPLANATION & TWEAK NOTES
===============================================================================

[HOW IT WORKS]
This shader is a procedural computational collage of media decay. It does not 
use external textures. It builds a base "signal" out of high-tension Op-Art 
and Moiré interference patterns (Bridget Riley math), and then subjects that 
signal to a gauntlet of simulated hardware failures:

1. digitalBlockDamage(): Quantizes UVs to create H.264 macroblocking and 
   borrows neighboring UVs to simulate datamosh prediction residue.
2. vhsTrackingWarp(): Applies sine-wave wobble for tape tracking, fractional 
   time offsets for vertical rolling, and thresholded noise for violent 
   horizontal tearing.
3. signalComposite() & mapToDirtyPalette(): Generates the Op-Art/Moiré base 
   and maps it to a custom "bruised/oxidized/sickly" color space, avoiding 
   clean digital neon.
4. rgbChannelDrift(): Samples the composite signal three times with offset UVs 
   to create chromatic aberration and color bleed.
5. filmScratchLayer() & overexposedFilmBurn(): Injects vertical hash-based 
   scratches and fractional-Brownian-motion (FBM) amber light leaks.
6. crtScanlines(): Wraps the final image in a barrel-distorted phosphor triad 
   grid, adding scanlines, edge vignette, and luminous bloom.

[TWEAK NOTES - CONSTANTS AT THE TOP OF THE GLSL]
1. MORE VHS: 
   Increase `VHS_TRACKING_DAMAGE` (e.g., 2.5) for aggressive tape wobble. 
   Lower `OVERALL_CONTRAST` (e.g., 0.8) for washed-out magnetic tape feel.
2. MORE CRT: 
   Increase `CRT_SCANLINE_STRENGTH` (e.g., 1.5). 
   Increase `BLOOM_BLEED_INTENSITY` (e.g., 1.2) for heavy phosphor glow.
3. MORE DIGITAL GLITCH: 
   Increase `GLITCH_INTENSITY` (e.g., 2.0) and `DAMAGE_FREQUENCY` (e.g., 1.5). 
   This forces more packet loss and datamosh smearing.
4. MORE FILM DAMAGE: 
   Increase `FILM_GRAIN_AMOUNT` (e.g., 0.3) for heavy 16mm grit. 
   The amber burns will naturally pulse based on time.
5. MORE OP-ART / MOIRÉ: 
   Increase `MOIRE_OP_ART_STRENGTH` (e.g., 2.0). This makes the underlying 
   spiral and checker grids warp more violently against each other, creating 
   dizzying optical tension before the damage even hits.
===============================================================================
*/