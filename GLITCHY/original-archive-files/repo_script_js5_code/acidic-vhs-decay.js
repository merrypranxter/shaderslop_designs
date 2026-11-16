/*
 * THE ACID-ROT MOIRÉ ENGINE
 * 
 * [ARCHITECTURE & LAYER EXPLANATION]
 * 1. Base Op-Art Moiré (opArtField): Uses concentric rings and spiral phantoms (from the Moire repo) 
 *    that are domain-warped by noise to create unstable "zebra waves" and "pattern passageways".
 * 2. Digital Block Damage (digitalBlockDamage): Quantizes UVs into a grid to simulate H.264 macroblocking 
 *    and datamosh-style prediction residue.
 * 3. VHS Tracking (vhsTrackingWarp): Applies rolling horizontal tears, head-switching noise at the 
 *    bottom of the frame, and general magnetic tape wobble.
 * 4. RGB Channel Drift (rgbChannelDrift): Samples the Op-Art field three times with offset UVs, 
 *    simulating analog chroma bleed and misregistration.
 * 5. Lisa Frank Acid Palette (lisaFrankAcid): Maps the monochromatic op-art signal into a toxic, 
 *    highly saturated neon color space (hot magenta, electric cyan, toxic lime), then mixes it 
 *    with "bruised" analog rot colors (dead black, faded amber).
 * 6. Film Damage (filmScratchLayer & burns): Injects vertical abrasive scratches and overexposed 
 *    luminous amber burns (halation/bloom).
 * 7. CRT Raster (crtScanlines): Multiplies the final signal by a high-frequency sine wave (scanlines) 
 *    and a horizontal phosphor triad mask, finished with analog snow and edge vignette.
 * 
 * [TWEAK NOTES]
 * - 1. MORE VHS: Increase VHS_TRACKING (e.g., 2.0). Lower the frequency in the tracking sine waves to make it roll slower.
 * - 2. MORE CRT: Increase CRT_STRENGTH (e.g., 1.5). Multiply the `triad` frequency by a higher number.
 * - 3. MORE DIGITAL GLITCH: Increase GLITCH_INTENSITY and change the `blockT` multiplier from 12.0 to 4.0 for slower, chunkier datamoshing.
 * - 4. MORE FILM DAMAGE: Increase the multiplier on `burn` in the composite section. Add more vertical scratches by lowering the hash threshold in `filmScratchLayer`.
 * - 5. MORE OP-ART / MOIRÉ: Increase MOIRE_STRENGTH. Change the `stripes` multiplier in `opArtField` to 100.0 for tighter, more aggressive interference.
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: true });
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
            uniform float u_time;
            uniform vec2 u_resolution;
            in vec2 vUv;
            out vec4 fragColor;

            // --- CONTROLS ---
            #define GLITCH_INTENSITY 1.2
            #define VHS_TRACKING 1.5
            #define CRT_STRENGTH 0.8
            #define RGB_SEPARATION 0.04
            #define MOIRE_STRENGTH 1.0

            // --- PRNG & NOISE ---
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            // --- DIGITAL BLOCK DAMAGE ---
            vec2 digitalBlockDamage(vec2 uv, float t) {
                // Simulate datamosh / macroblock sticking
                float blockT = floor(t * 8.0); 
                vec2 gridUV = floor(uv * vec2(20.0, 15.0));
                float n = hash(gridUV + blockT);
                
                if (n > 0.85) { 
                    uv.x += (hash(gridUV) - 0.5) * 0.15 * GLITCH_INTENSITY;
                    // Temporal freeze simulation (borrows UVs from nearby blocks)
                    uv.y += (hash(gridUV + 13.37) - 0.5) * 0.1 * GLITCH_INTENSITY;
                }
                return uv;
            }

            // --- VHS TRACKING & HORIZONTAL TEAR ---
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                float y = uv.y * u_resolution.y;
                
                // Rolling sync tear
                float tearPhase = t * 1.5;
                float tearY = fract(tearPhase);
                float tearDist = abs(uv.y - tearY);
                if (tearDist < 0.08) {
                    uv.x += sin(y * 0.05) * (0.08 - tearDist) * 3.0 * VHS_TRACKING;
                }
                
                // Head switching noise (bottom of screen)
                if (uv.y < 0.1) {
                    uv.x += (hash(vec2(uv.y * 50.0, t)) - 0.5) * 0.1 * VHS_TRACKING;
                }
                
                // Tape wobble / skew
                uv.x += sin(uv.y * 8.0 + t * 4.0) * 0.003 * VHS_TRACKING;
                uv.x += noise(vec2(uv.y * 2.0, t)) * 0.005 * VHS_TRACKING;
                
                return uv;
            }

            // --- OP-ART / MOIRE FIELD ---
            float opArtField(vec2 uv, float t) {
                vec2 p = uv * 2.0 - 1.0;
                p.x *= u_resolution.x / u_resolution.y;
                
                // Domain warp to create "zebra waves"
                float warp = noise(p * 2.0 - t * 0.5);
                p += warp * 0.25;
                
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Spiral phantom moiré (intersecting angular frequencies)
                float spiral1 = sin(20.0 * r + a * 5.0 - t * 3.0);
                float spiral2 = sin(22.0 * r - a * 3.0 + t * 2.0);
                
                // Concentric checker funnel interference
                float stripes = sin(uv.y * 60.0 + warp * 15.0);
                
                float interference = (spiral1 * spiral2 + stripes) * 0.5 * MOIRE_STRENGTH;
                return smoothstep(0.3, 0.7, interference + 0.5);
            }

            // --- FILM SCRATCH LAYER ---
            float filmScratchLayer(vec2 uv, float t) {
                float scratch = 0.0;
                float xLine = uv.x * 150.0 + hash(vec2(floor(t * 15.0))) * 20.0;
                if (hash(vec2(floor(xLine))) > 0.97) {
                    scratch += hash(vec2(uv.y * 20.0, t)) * 0.6;
                }
                return scratch;
            }

            // --- LISA FRANK ACID COLOR MAPPING ---
            vec3 lisaFrankAcid(float v, vec2 uv, float t) {
                // Toxic Neon Palette
                vec3 hotPink = vec3(1.0, 0.0, 0.4);
                vec3 electricCyan = vec3(0.0, 1.0, 0.9);
                vec3 toxicLime = vec3(0.6, 1.0, 0.0);
                vec3 uvPurple = vec3(0.5, 0.0, 1.0);
                
                // Bruised Analog Rot
                vec3 deadBlack = vec3(0.1, 0.05, 0.1);
                vec3 washedAmber = vec3(0.9, 0.7, 0.3);
                
                // Phase shifted color cycling
                float mixVal = fract(v * 2.5 + uv.y * 1.5 - t * 0.8);
                
                vec3 acid;
                if (mixVal < 0.25) acid = mix(hotPink, electricCyan, mixVal * 4.0);
                else if (mixVal < 0.5) acid = mix(electricCyan, toxicLime, (mixVal - 0.25) * 4.0);
                else if (mixVal < 0.75) acid = mix(toxicLime, uvPurple, (mixVal - 0.5) * 4.0);
                else acid = mix(uvPurple, hotPink, (mixVal - 0.75) * 4.0);
                
                // Contaminate the acid with rot based on noise
                float rotFactor = noise(uv * 8.0 + t * 1.2);
                return mix(acid, mix(deadBlack, washedAmber, v), rotFactor * 0.5);
            }

            // --- COMPOSITE ---
            void main() {
                vec2 uv = vUv;
                float t = u_time;
                
                // 1. Structural Damage (Digital & Analog)
                uv = digitalBlockDamage(uv, t);
                uv = vhsTrackingWarp(uv, t);
                
                // 2. RGB Channel Drift (Chroma Bleed)
                // Offset varies based on y-position to simulate analog bandwidth limits
                float dynamicOffset = RGB_SEPARATION * (1.0 + sin(uv.y * 10.0 + t) * 0.5);
                vec2 uvR = uv + vec2(dynamicOffset, 0.0);
                vec2 uvG = uv;
                vec2 uvB = uv - vec2(dynamicOffset * 0.5, dynamicOffset * 0.2); // Asymmetric drift
                
                // Sample the Op-Art Moiré engine
                float valR = opArtField(uvR, t);
                float valG = opArtField(uvG, t + 0.05); // Temporal phase lag
                float valB = opArtField(uvB, t + 0.1);
                
                // 3. Apply Toxic Palette
                vec3 colorR = lisaFrankAcid(valR, uvR, t);
                vec3 colorG = lisaFrankAcid(valG, uvG, t);
                vec3 colorB = lisaFrankAcid(valB, uvB, t);
                
                // Subtractive/Additive dirty mixing
                vec3 finalColor = vec3(colorR.r, colorG.g, colorB.b);
                finalColor += vec3(colorB.r * 0.3, colorR.g * 0.1, colorG.b * 0.3); // Chromatic cross-talk
                
                // 4. Light/Exposure Failure (Overexposed Film Burns)
                float burn = noise(uv * 3.0 - t * 0.5) * noise(uv * 6.0 + t);
                burn = smoothstep(0.55, 0.9, burn);
                finalColor += vec3(1.0, 0.9, 0.5) * burn * 2.0; // Glowing amber/white burn
                
                // Scratches
                finalColor += filmScratchLayer(uv, t) * vec3(0.9, 0.9, 1.0);
                
                // 5. CRT Display Physics
                // Scanlines
                float scanline = sin(uv.y * u_resolution.y * 1.5);
                scanline = scanline * 0.5 + 0.5;
                finalColor *= mix(1.0, scanline, CRT_STRENGTH * 0.4);
                
                // Phosphor Triad Mask
                float triad = sin(uv.x * u_resolution.x * 2.0);
                finalColor *= mix(1.0, triad * 0.5 + 0.5, CRT_STRENGTH * 0.25);
                
                // 6. Analog Snow / Sensor Noise
                float snow = hash(uv * 100.0 + fract(t));
                finalColor += (snow - 0.5) * 0.2;
                
                // 7. Vignette & Edge Darkening
                float vignette = length(vUv - 0.5);
                finalColor *= smoothstep(0.85, 0.35, vignette);
                
                // Frame Flicker
                finalColor *= mix(0.9, 1.0, hash(vec2(t * 10.0)));

                fragColor = vec4(finalColor, 1.0);
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);