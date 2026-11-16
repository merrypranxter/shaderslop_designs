/**
 * ============================================================================
 * THE WEIRD CODE GUY PRESENTS: LISA FRANK'S CURSED VCR (OP-ART DECAY SYSTEM)
 * ============================================================================
 * 
 * DESCRIPTION:
 * This shader system simulates a catastrophic media collision. It takes the 
 * hypnotic, high-contrast structural tension of Op-Art (Bridget Riley moiré fields) 
 * and forces it through a gauntlet of dying analog and digital media systems. 
 * The color palette is a highly acidic, oversaturated "Lisa Frank" spectrum 
 * (neon pinks, cyans, radioactive yellows, bruised magentas) that is actively 
 * bleeding, separating, and rotting.
 * 
 * MAJOR LAYERS:
 * 1. opArtField() & moireInterference(): The structural base. Concentric rings 
 *    and sine stripes intersecting to create spatial aliasing and beat frequencies.
 * 2. digitalBlockDamage(): Simulates macroblocking and packet loss. It quantizes 
 *    the UV coordinates into chunks based on a low-frequency noise threshold.
 * 3. vhsTrackingWarp(): Injects mechanical tape failure. Horizontal shearing, 
 *    sync rolling, and tape wobble.
 * 4. rgbChannelDrift(): Simulates chroma misregistration and CRT convergence 
 *    error by sampling the moiré field three times with offset UVs and feeding 
 *    it into the Lisa Frank acid color generator.
 * 5. filmScratchLayer(): Photochemical damage. Vertical emulsion scratches and 
 *    intermittent overexposed film burns (amber/white blobs).
 * 6. crtScanlines(): The display substrate. High-frequency grid masking and 
 *    barrel distortion to simulate a curved, dying phosphor screen.
 * 
 * TWEAK NOTES (Search for the #define block in the shader):
 * 1. MORE VHS: Increase VHS_TRACKING to > 2.0. Increase NOISE_DENSITY.
 * 2. MORE CRT: Increase CRT_SCANLINES to 1.5. Increase COLOR_BLEED.
 * 3. MORE DIGITAL GLITCH: Increase GLITCH_INTENSITY to > 3.0. This will cause 
 *    massive macroblocking and datamosh-like smearing.
 * 4. MORE FILM DAMAGE: Increase FILM_GRAIN to > 1.0. Tweak filmScratchLayer thresholds.
 * 5. MORE OP-ART/MOIRÉ: Increase MOIRE_STRENGTH. Decrease VHS_TRACKING to 
 *    allow the geometric precision to read clearly before it gets destroyed.
 * ============================================================================
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
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

            // =================================================================
            // DAMAGE CONTROL CONSTANTS (TWEAK THESE)
            // =================================================================
            #define GLITCH_INTENSITY 1.8
            #define VHS_TRACKING 1.5
            #define CRT_SCANLINES 0.85
            #define RGB_SEPARATION 0.04
            #define FILM_GRAIN 0.7
            #define MOIRE_STRENGTH 1.2
            #define COLOR_BLEED 0.4
            #define NOISE_DENSITY 1.0

            // =================================================================
            // UTILITY / NOISE FUNCTIONS
            // =================================================================
            float hashNoise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hashNoise(i);
                float b = hashNoise(i + vec2(1.0, 0.0));
                float c = hashNoise(i + vec2(0.0, 1.0));
                float d = hashNoise(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            // =================================================================
            // LAYER 1: VHS TAPE MECHANICS & TRACKING TEAR
            // =================================================================
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                // Horizontal sync tear
                float tearThreshold = 0.92;
                float tearTrigger = sin(uv.y * 8.0 + t * 3.0);
                float tear = step(tearThreshold, tearTrigger) * sin(uv.y * 40.0) * 0.08 * VHS_TRACKING;
                
                // General tape wobble
                float wobble = sin(t * 1.5 + uv.y * 4.0) * 0.005 * VHS_TRACKING;
                
                // Sudden frame jump (sync loss)
                float jump = step(0.97, hashNoise(vec2(floor(t * 5.0), 1.0))) * 0.15;
                
                return uv + vec2(tear + wobble, jump);
            }

            // =================================================================
            // LAYER 2: DIGITAL MACROBLOCKING & DATAMOSH SMEAR
            // =================================================================
            vec2 digitalBlockDamage(vec2 uv, float t) {
                // Quantize UVs into chunky blocks
                float blocks = 25.0;
                vec2 blockUv = floor(uv * blocks) / blocks;
                
                // Determine if this block is corrupted based on shifting noise
                float corruptionNoise = valueNoise(blockUv * 4.0 + vec2(t * 0.5, -t));
                float isDamaged = step(0.75 / GLITCH_INTENSITY, corruptionNoise);
                
                // If damaged, snap to the block coordinate (creates smeared datamosh feel)
                // Add a slight horizontal drift to the broken blocks
                vec2 corruptedUv = blockUv + vec2(valueNoise(blockUv + t) * 0.05, 0.0);
                
                return mix(uv, corruptedUv, isDamaged * 0.9);
            }

            // =================================================================
            // LAYER 3: OP-ART & MOIRÉ INTERFERENCE
            // =================================================================
            float opArtField(vec2 uv, float t) {
                vec2 p = uv * 2.0 - 1.0;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Warped concentric rings + spirals
                float spiral = sin(r * 35.0 - a * 4.0 - t * 2.0);
                float stripes = sin(uv.x * 45.0 + sin(uv.y * 12.0 + t) * 4.0);
                
                // High contrast clipping
                return smoothstep(0.4, 0.6, spiral * stripes * 0.5 + 0.5);
            }

            float moireInterference(vec2 uv, float t) {
                float g1 = opArtField(uv, t);
                
                // Second grid, slightly rotated and scaled to create spatial beats
                float c = cos(0.15), s = sin(0.15);
                vec2 uv2 = mat2(c, -s, s, c) * (uv - 0.5) * 1.08 + 0.5;
                float g2 = opArtField(uv2, t * 1.1);
                
                return g1 * g2 * MOIRE_STRENGTH;
            }

            // =================================================================
            // LAYER 4: ACIDIC LISA FRANK COLOR MAPPING
            // =================================================================
            vec3 getLisaFrankAcid(float val, float t) {
                // Base spectral shift
                vec3 col = 0.5 + 0.5 * cos(6.28318 * (val * 1.5 + t * 0.3 + vec3(0.0, 0.33, 0.67)));
                
                // Inject highly aggressive, saturated neon bursts based on value thresholds
                // Hot Pink
                col = mix(col, vec3(1.0, 0.0, 0.8), smoothstep(0.6, 1.0, sin(val * 12.0))); 
                // Electric Cyan
                col = mix(col, vec3(0.0, 1.0, 0.9), smoothstep(0.6, 1.0, sin(val * 15.0 + 1.0))); 
                // Radioactive Yellow
                col = mix(col, vec3(0.9, 1.0, 0.0), smoothstep(0.6, 1.0, sin(val * 19.0 + 2.0))); 
                // Deep Bruised Purple
                col = mix(col, vec3(0.5, 0.0, 1.0), smoothstep(0.6, 1.0, sin(val * 24.0 + 3.0))); 
                
                return col;
            }

            vec3 rgbChannelDrift(vec2 uv, float t) {
                // Chromatic misregistration (CRT convergence error / analog bleed)
                float driftAmount = RGB_SEPARATION * (1.0 + sin(t * 2.0) * 0.5);
                
                vec2 rUv = uv + vec2(driftAmount, 0.0);
                vec2 gUv = uv + vec2(driftAmount * cos(t), driftAmount * sin(t));
                vec2 bUv = uv - vec2(driftAmount, 0.0);

                float rVal = moireInterference(rUv, t);
                float gVal = moireInterference(gUv, t);
                float bVal = moireInterference(bUv, t);

                // Map each separated channel through the acid palette, slightly time-offset
                vec3 rCol = getLisaFrankAcid(rVal, t);
                vec3 gCol = getLisaFrankAcid(gVal, t + 0.1);
                vec3 bCol = getLisaFrankAcid(bVal, t + 0.2);

                // Recombine
                vec3 finalCol = vec3(rCol.r, gCol.g, bCol.b);
                
                // Analog color bleed (smearing colors horizontally)
                float bleed = valueNoise(uv * vec2(10.0, 2.0) + t) * COLOR_BLEED;
                finalCol += bleed * vec3(0.8, 0.2, 0.5); // Add a bruised magenta bleed
                
                return finalCol;
            }

            // =================================================================
            // LAYER 5: FILM DAMAGE (SCRATCHES & BURNS)
            // =================================================================
            vec3 filmScratchLayer(vec2 uv, float t) {
                // Vertical emulsion scratches
                float scratchNoise = hashNoise(vec2(uv.x * 150.0, floor(t * 12.0)));
                float isScratch = step(0.993, scratchNoise) * step(0.4, hashNoise(vec2(t)));
                
                // Photochemical burns (amber/white overexposed blobs)
                float burnNoise = valueNoise(uv * 3.0 - vec2(0.0, t * 1.5));
                float isBurn = smoothstep(0.65, 0.9, burnNoise) * step(0.92, hashNoise(vec2(floor(t * 3.0))));
                vec3 burnCol = vec3(1.0, 0.6, 0.1) * isBurn * 2.5; // Amber blowout

                return vec3(isScratch * 0.8) + burnCol;
            }

            // =================================================================
            // LAYER 6: CRT DISPLAY SUBSTRATE
            // =================================================================
            float crtScanlines(vec2 uv, vec2 res) {
                // Horizontal scanlines
                float scanline = sin(uv.y * res.y * 3.14159) * 0.12 * CRT_SCANLINES;
                // Vertical phosphor triad grid
                float grid = sin(uv.x * res.x * 3.14159) * 0.08 * CRT_SCANLINES;
                return 1.0 - scanline - grid;
            }

            // =================================================================
            // MAIN COMPOSITE
            // =================================================================
            void main() {
                vec2 uv = vUv;
                
                // 1. CRT Barrel Distortion
                vec2 crtUv = uv * 2.0 - 1.0;
                float dist = dot(crtUv, crtUv);
                crtUv *= 1.0 + dist * 0.15; // Warp edges outwards
                uv = crtUv * 0.5 + 0.5;

                // Black out areas outside the curved screen
                if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                    // Occasional sync dropout flashing on the borders
                    float borderFlash = step(0.98, hashNoise(vec2(u_time * 10.0))) * 0.2;
                    fragColor = vec4(vec3(borderFlash), 1.0);
                    return;
                }

                // 2. Structural Damage (VHS + Digital Blocks)
                vec2 warpedUv = vhsTrackingWarp(uv, u_time);
                warpedUv = digitalBlockDamage(warpedUv, u_time);

                // 3. Core Signal (Op-Art Moiré + Acid RGB Drift)
                vec3 color = rgbChannelDrift(warpedUv, u_time);

                // 4. Physical Media Damage (Film)
                color += filmScratchLayer(warpedUv, u_time);

                // 5. Analog Snow / Gain Noise
                float grain = (hashNoise(uv * u_time * 10.0) - 0.5) * 0.3 * FILM_GRAIN * NOISE_DENSITY;
                color += grain;

                // 6. Display Hardware (Scanlines & Vignette)
                color *= crtScanlines(uv, u_resolution);
                float vignette = 1.0 - smoothstep(0.4, 1.8, dist);
                color *= vignette;

                // 7. Phosphor Bloom & Signal Crush
                color = pow(color, vec3(0.85)); // Gamma curve adjustment for CRT glow
                color += vec3(0.0, 0.03, 0.02); // Sickly green/cyan CRT baseline darkness

                // Intermittent black crush (flickering exposure failure)
                float luma = dot(color, vec3(0.299, 0.587, 0.114));
                if (hashNoise(vec2(u_time * 2.0)) > 0.92) {
                    // Crush shadows violently
                    color = mix(color, vec3(0.0), step(luma, 0.35)); 
                }
                
                // Signal dropout burst (rare, violent white-out)
                if (hashNoise(vec2(u_time * 0.5)) > 0.99) {
                    color = mix(color, vec3(0.9, 0.9, 1.0), 0.8);
                }

                fragColor = vec4(color, 1.0);
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
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);