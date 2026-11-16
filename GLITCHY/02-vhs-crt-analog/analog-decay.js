/*
 * THE FERAL SIGNAL: OP-ART DECAY SHADER
 * -------------------------------------
 * This shader combines the governance of retinal Op-Art (Moiré, warped concentric fields)
 * with the catastrophic failure of analog and digital media. The signal breathes, rots,
 * and slips through multiple layers of simulated degradation.
 *
 * MAJOR LAYERS:
 * 1. digitalBlockDamage: Quantizes UVs into blocks, creating datamosh/compression chew.
 * 2. vhsTrackingWarp: Adds sine-wave rolling sync errors and sharp horizontal tears.
 * 3. opArtField & moireInterference: The base image. A warped log-polar target intersecting
 *    with zebra stripes. Two fields are multiplied with a phase shift to create Moiré.
 * 4. rgbChannelDrift: Samples the Moiré field 3 times with offset UVs for chromatic aberration.
 * 5. colorizeSignal: Maps grayscale Op-Art to a dirty analog palette (bruised magenta, cyan).
 * 6. crtScanlines: Multiplies a high-frequency sine wave based on screen resolution.
 * 7. filmScratchLayer & Grain: Procedural noise for physical media dirt.
 *
 * TWEAK NOTES (Modify the #defines in the fragment shader):
 * - More VHS: Increase VHS_TRACKING_DAMAGE to 2.0 or 3.0.
 * - More CRT: Increase CRT_SCANLINES_STRENGTH to 0.8.
 * - More Digital Glitch: Increase BLOCK_DAMAGE_FREQ to 0.5.
 * - More Film Damage: Increase FILM_GRAIN_AMOUNT to 0.3.
 * - More Op-Art/Moiré: Increase MOIRE_STRENGTH to 1.0 and lower GLITCH_INTENSITY to 0.5.
 */

if (!canvas.__three) {
    try {
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

            // --- CONTROLS ---
            #define GLITCH_INTENSITY 1.2
            #define VHS_TRACKING_DAMAGE 1.5
            #define CRT_SCANLINES_STRENGTH 0.4
            #define RGB_SEPARATION 0.03
            #define FILM_GRAIN_AMOUNT 0.12
            #define MOIRE_STRENGTH 0.85
            #define BLOCK_DAMAGE_FREQ 0.15
            #define OVERALL_CONTRAST 1.3
            
            // --- HASH & NOISE ---
            float hash12(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * .1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }
            
            float hash21(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f*f*(3.0-2.0*f);
                return mix(mix(hash21(i + vec2(0.0,0.0)), hash21(i + vec2(1.0,0.0)), u.x),
                           mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0,1.0)), u.x), u.y);
            }

            // --- DIGITAL BLOCK CORRUPTION ---
            vec2 digitalBlockDamage(vec2 uv, float t) {
                vec2 blockUV = floor(uv * vec2(24.0, 18.0)) / vec2(24.0, 18.0);
                float glitchTrigger = hash21(blockUV + floor(t * 12.0));
                
                if (glitchTrigger > (1.0 - BLOCK_DAMAGE_FREQ * GLITCH_INTENSITY)) {
                    // Datamosh smear: hold previous UV or displace
                    float dir = hash21(blockUV) > 0.5 ? 1.0 : -1.0;
                    return uv + vec2(hash21(blockUV * 1.5) * 0.1 * dir, 0.0);
                }
                
                // Occasional full-row displacement
                float rowTrigger = hash21(vec2(floor(uv.y * 10.0), floor(t * 4.0)));
                if (rowTrigger > 0.95) {
                    return uv + vec2(sin(t * 10.0) * 0.2, 0.0);
                }
                
                return uv;
            }

            // --- VHS TRACKING & TEARING ---
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                float y = uv.y;
                // Slow rolling wave (sync error)
                float roll = sin(y * 4.0 + t * 2.0) * 0.005 * VHS_TRACKING_DAMAGE;
                
                // Head switching noise at bottom of tape
                float headSwitch = step(0.92, y) * (hash21(vec2(y * 100.0, t)) - 0.5) * 0.15 * VHS_TRACKING_DAMAGE;
                
                // Horizontal tearing (tape stretch/damage)
                float tearFreq = sin(t * 0.3) * 15.0 + 25.0;
                float tearEnvelope = step(0.98, sin(y * tearFreq + t * 8.0));
                float tearOffset = (hash21(vec2(y, floor(t * 15.0))) - 0.5) * 0.3 * VHS_TRACKING_DAMAGE;
                
                return uv + vec2(roll + headSwitch + (tearEnvelope * tearOffset), 0.0);
            }

            // --- OP-ART / MOIRÉ BASE ---
            float opArtField(vec2 uv, float offset) {
                // Log-polar morphing space
                vec2 p = uv - 0.5;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Warping the space to create tension
                float w = sin(r * 15.0 - u_time * 1.5 + a * 3.0) * 0.04;
                r += w;
                
                // Zebra stripes intersecting with concentric targets
                float stripes = sin(r * 120.0 + offset) * sin(uv.x * 80.0 + a * 5.0 + offset);
                return smoothstep(-0.1, 0.1, stripes);
            }

            float moireInterference(vec2 uv) {
                float field1 = opArtField(uv, 0.0);
                
                // Rotate and scale slightly for phase-shifted interference
                float t = u_time * 0.2;
                float s = sin(t * 0.1) * 0.02; 
                float c = cos(t * 0.1) * 0.02 + 0.98;
                vec2 uv2 = mat2(c, -s, s, c) * (uv - 0.5) + 0.5;
                
                float field2 = opArtField(uv2, 1.57); // offset phase
                
                // Multiplicative/Additive hybrid for moire
                return mix(field1, field1 * field2 + (1.0 - field1) * (1.0 - field2), MOIRE_STRENGTH);
            }

            // --- COLORIZATION ---
            vec3 colorizeSignal(float sig, vec2 uv) {
                // Dirty analog palette: dead black, muddy shadow, bruised magenta, sickly cyan, washed white
                vec3 dark = vec3(0.04, 0.05, 0.06); 
                vec3 shadow = vec3(0.1, 0.2, 0.25); // oxidized blue/cyan
                vec3 mid = vec3(0.7, 0.3, 0.5); // bruised magenta
                vec3 light = vec3(0.95, 0.9, 0.8); // off-white / yellowed
                
                vec3 col = mix(dark, shadow, smoothstep(0.0, 0.3, sig));
                col = mix(col, mid, smoothstep(0.3, 0.7, sig));
                col = mix(col, light, smoothstep(0.7, 1.0, sig));
                return col;
            }

            // --- MAIN COMPOSITE ---
            void main() {
                vec2 uv = vUv;
                float t = u_time;
                
                // 1. Digital Block Corruption
                vec2 blockUV = digitalBlockDamage(uv, t);
                
                // 2. VHS Tracking Warp
                vec2 warpUV = vhsTrackingWarp(blockUV, t);
                
                // 3. RGB Channel Drift & Moiré Evaluation
                // Chromatic misregistration
                float drift = RGB_SEPARATION * GLITCH_INTENSITY * (1.0 + sin(t * 3.0) * 0.5);
                vec2 uvR = warpUV + vec2(drift, 0.002);
                vec2 uvG = warpUV;
                vec2 uvB = warpUV - vec2(drift * 1.2, -0.002);
                
                float sigR = moireInterference(uvR);
                float sigG = moireInterference(uvG);
                float sigB = moireInterference(uvB);
                
                // Map to dirty color palette
                vec3 colR = colorizeSignal(sigR, uvR);
                vec3 colG = colorizeSignal(sigG, uvG);
                vec3 colB = colorizeSignal(sigB, uvB);
                
                // Construct composite color with channel bleed
                vec3 col = vec3(colR.r, colG.g, colB.b);
                // Add some dirty cyan bleed from the green/blue intersection
                col.gb += colG.b * 0.2; 
                col.r += colB.r * 0.1;

                // 4. CRT Scanlines & Phosphor Bloom
                float scanline = 1.0 - CRT_SCANLINES_STRENGTH * (0.5 + 0.5 * sin(uv.y * u_resolution.y * 1.5));
                col *= scanline;
                
                // Phosphor triad mask
                float triad = 1.0 - (CRT_SCANLINES_STRENGTH * 0.3) * (0.5 + 0.5 * sin(uv.x * u_resolution.x * 2.0));
                col *= triad;
                
                // 5. Film Grain & Scratches
                float grain = hash12(uv * t);
                col += (grain - 0.5) * FILM_GRAIN_AMOUNT;
                
                // Vertical scratches
                float scratchTrigger = hash21(vec2(floor(uv.x * u_resolution.x * 0.1), floor(t * 8.0)));
                if (scratchTrigger > 0.99) {
                    float scratchIntensity = hash12(vec2(uv.y, t));
                    col += vec3(0.8, 0.7, 0.5) * scratchIntensity * 0.4; // amber scratch
                }
                
                // 6. Overexposed Film Burns / Signal Dropout
                float burnTrigger = hash21(vec2(floor(uv.y * 5.0), floor(t * 3.0)));
                if (burnTrigger > 0.96) {
                    // Flash of blown-out white/yellow
                    col = mix(col, vec3(1.0, 0.95, 0.8), 0.6);
                } else if (burnTrigger < 0.02) {
                    // Black crush dropout
                    col = mix(col, vec3(0.0), 0.8);
                }

                // 7. Final Contrast & Vignette
                col = pow(abs(col), vec3(1.0 / OVERALL_CONTRAST));
                float vignette = 1.0 - smoothstep(0.5, 1.5, length(vUv - 0.5));
                col *= vignette;

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
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);