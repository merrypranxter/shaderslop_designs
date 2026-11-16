/*
================================================================================
THE WEIRD CODE GUY - FERAL DESIGN-BRAIN PROTOCOL
================================================================================
EXPLANATION OF LAYERS:
1. opArtField & moireInterference: The structural foundation. Instead of a clean 
   grid, it's a warped, phase-shifted sine field that creates physical tension.
2. vhsTrackingWarp: Horizontal tearing, bottom-feed noise, and unstable sync roll 
   that physically displaces the UV coordinates.
3. digitalBlockDamage: Macroblock quantization that occasionally stutters and 
   datamoshes the UVs, simulating packet loss and codec failure.
4. rgbChannelDrift: Samples the distorted UVs three separate times with chromatic 
   offsets to simulate electron gun misalignment and lens aberration.
5. filmScratchLayer & filmGrain: Physical emulsion damage, dust, and particulate 
   noise that sits "on top" of the signal.
6. crtScanlines: The final display medium. Phosphor triads, horizontal scanlines, 
   and vignette that ground the chaotic signal in a physical CRT monitor.

TWEAK NOTES (Adjust the #define values in the shader):
1. MORE VHS: Increase VHS_TRACKING (e.g., 2.5) and lower DAMAGE_FREQ to make the 
   tape wobble more violently.
2. MORE CRT: Increase CRT_STRENGTH (e.g., 1.5) and adjust the triad mask mix.
3. MORE DIGITAL GLITCH: Increase BLOCK_DAMAGE (e.g., 2.0) and set DAMAGE_FREQ higher.
4. MORE FILM DAMAGE: Increase FILM_GRAIN (e.g., 1.0) and lower the scratch threshold.
5. MORE OP-ART: Increase MOIRE_STRENGTH and uncomment the binary thresholding in 
   the opArtField function for harsher, high-contrast Bridget Riley stripes.
================================================================================
*/

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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

            // =================================================================
            // CONTROLS & CONSTANTS
            // =================================================================
            #define GLITCH_INTENSITY 1.2
            #define VHS_TRACKING 1.5
            #define CRT_STRENGTH 0.8
            #define RGB_SEPARATION 0.015
            #define FILM_GRAIN 0.6
            #define MOIRE_STRENGTH 1.2
            #define BLOCK_DAMAGE 1.0
            #define DAMAGE_FREQ 1.5

            // =================================================================
            // CORE UTILITIES
            // =================================================================
            float hashNoise(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * .1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hashNoise(i + vec2(0.0,0.0)), hashNoise(i + vec2(1.0,0.0)), u.x),
                           mix(hashNoise(i + vec2(0.0,1.0)), hashNoise(i + vec2(1.0,1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < 5; ++i) {
                    v += a * noise(p);
                    p = rot * p * 2.0 + vec2(100.0);
                    a *= 0.5;
                }
                return v;
            }

            // =================================================================
            // LAYER 1: OP-ART & MOIRÉ INTERFERENCE
            // =================================================================
            float opArtField(vec2 uv) {
                vec2 p = uv * 2.0 - 1.0;
                p.x *= u_resolution.x / u_resolution.y;
                
                // Domain warping to make the stripes feel fleshy and unstable
                float warp = fbm(p * 3.0 + u_time * 0.2);
                p += 0.2 * vec2(fbm(p * 2.0 - u_time * 0.4), warp);
                
                // Radiating concentric distortion
                float d = length(p);
                float angle = atan(p.y, p.x);
                
                // Bridget Riley meets bad acid: warped stripes
                float stripes = sin(d * 30.0 - u_time * 2.0 + sin(angle * 10.0 + warp * 5.0) * 2.0);
                
                // Soft analog edges instead of pure binary, mimicking generation loss
                return smoothstep(-0.4, 0.4, stripes);
            }

            float moireInterference(vec2 uv, float t) {
                vec2 p1 = uv;
                vec2 p2 = uv + vec2(sin(t * 0.3), cos(t * 0.2)) * 0.02;
                
                p1 += 0.05 * vec2(fbm(p1 * 10.0 + t), fbm(p1 * 10.0 - t));
                p2 += 0.05 * vec2(fbm(p2 * 12.0 - t), fbm(p2 * 12.0 + t));
                
                float field1 = opArtField(p1 * 1.5);
                float field2 = opArtField(p2 * 1.6);
                
                return mix(field1, field1 * field2 * MOIRE_STRENGTH, 0.5);
            }

            // =================================================================
            // LAYER 2: DIGITAL COMPRESSION & DATAMOSHING
            // =================================================================
            vec2 digitalBlockDamage(vec2 uv, float t) {
                float glitchSpike = step(0.9, hashNoise(vec2(floor(t * 5.0 * DAMAGE_FREQ), 0.0)));
                
                if (glitchSpike > 0.0) {
                    vec2 grid = vec2(32.0, 24.0); // Macroblock size
                    vec2 blockUv = floor(uv * grid) / grid;
                    float blockNoise = hashNoise(blockUv + floor(t * 10.0));
                    
                    if (blockNoise > 0.7) {
                        // Datamosh smear: drag pixels horizontally or vertically
                        vec2 smear = vec2(hashNoise(blockUv.yy) - 0.5, hashNoise(blockUv.xx) - 0.5);
                        uv += smear * 0.2 * BLOCK_DAMAGE * GLITCH_INTENSITY;
                    }
                }
                return uv;
            }

            // =================================================================
            // LAYER 3: VHS TRACKING & HORIZONTAL TEAR
            // =================================================================
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                // Violent horizontal jump
                float jump = step(0.98, hashNoise(vec2(t, 1.0))) * (hashNoise(vec2(t, 2.0)) - 0.5) * 0.5;
                uv.x += jump * GLITCH_INTENSITY;
                
                // Rolling sync tear
                float tearY = fract(t * 0.15);
                float tearDist = abs(uv.y - tearY);
                float tear = smoothstep(0.08, 0.0, tearDist) * sin(uv.y * 60.0 + t * 30.0);
                uv.x += tear * 0.1 * VHS_TRACKING;
                
                // Bottom tracking noise band
                float trackingZone = smoothstep(0.15, 0.0, uv.y);
                float trackingNoise = hashNoise(vec2(floor(uv.y * 200.0), floor(t * 60.0))) - 0.5;
                uv.x += trackingNoise * 0.15 * trackingZone * VHS_TRACKING;
                
                // General magnetic tape wobble
                uv.x += sin(uv.y * 15.0 + t * 2.0) * 0.003 * VHS_TRACKING;
                
                return uv;
            }

            // =================================================================
            // LAYER 4: FILM DAMAGE (SCRATCHES, DUST, BURN)
            // =================================================================
            float filmScratchLayer(vec2 uv, float t) {
                // Vertical scratches
                float scratchNoise = hashNoise(vec2(floor(uv.x * 400.0), floor(t * 5.0)));
                float scratch = smoothstep(0.992, 1.0, scratchNoise);
                scratch *= 0.5 + 0.5 * sin(t * 10.0 + uv.x * 100.0);
                return scratch;
            }

            float filmGrain(vec2 uv, float t) {
                return (hashNoise(uv * 1000.0 + fract(t)) - 0.5) * 0.2 * FILM_GRAIN;
            }

            float filmBurn(vec2 uv, float t) {
                // Sweeping amber overexposure burn
                float burnNoise = fbm(uv * 2.0 + vec2(t * 0.5, 0.0));
                float sweep = sin(uv.x * 3.0 - t * 1.5 + burnNoise * 2.0);
                return smoothstep(0.8, 1.0, sweep) * (hashNoise(uv + t) * 0.5 + 0.5);
            }

            // =================================================================
            // LAYER 5: CRT PHOSPHOR & SCANLINES
            // =================================================================
            vec3 crtScanlines(vec2 uv, vec3 color) {
                // Heavy horizontal scanlines
                float scanline = sin(uv.y * u_resolution.y * 1.2) * 0.04;
                color -= scanline * CRT_STRENGTH;
                
                // Phosphor triad mask (RGB pixel grid)
                float mask = mod(gl_FragCoord.x, 3.0);
                vec3 triad = vec3(
                    step(mask, 1.0),
                    step(1.0, mask) * step(mask, 2.0),
                    step(2.0, mask)
                );
                
                // Soften the triad so it doesn't completely destroy the image
                vec3 phosphorColor = mix(color, color * triad * 2.0, 0.25 * CRT_STRENGTH);
                
                // CRT Tube Curvature Vignette
                vec2 crtUv = uv * 2.0 - 1.0;
                float vig = dot(crtUv, crtUv);
                phosphorColor *= 1.0 - vig * 0.2;
                
                return phosphorColor;
            }

            // =================================================================
            // MAIN SIGNAL COMPOSITE
            // =================================================================
            void main() {
                vec2 uv = vUv;
                float t = u_time * 0.5;
                
                // 1. Digital & Analog UV Warping
                vec2 warpedUv = digitalBlockDamage(uv, t);
                warpedUv = vhsTrackingWarp(warpedUv, t);
                
                // 2. Chromatic Aberration & RGB Drift
                // Unstable drift that pulses randomly
                float driftAmount = RGB_SEPARATION * GLITCH_INTENSITY * (1.0 + step(0.95, hashNoise(vec2(t, 3.0))) * 5.0);
                vec2 drift = vec2(driftAmount * sin(t * 3.0), driftAmount * cos(t * 2.0));
                
                float r = moireInterference(warpedUv + drift, t);
                float g = moireInterference(warpedUv, t);
                float b = moireInterference(warpedUv - drift, t);
                
                // 3. Dirty Analog Color Palette
                // Base colors: Dead black, oxidized blue, faded red, bruised magenta
                vec3 darkBase = vec3(0.04, 0.05, 0.06);
                vec3 lightBase = vec3(0.85, 0.8, 0.75);
                
                vec3 col;
                col.r = mix(darkBase.r, lightBase.r, r) + 0.15 * g; // Bleed green into red
                col.g = mix(darkBase.g, lightBase.g, g);
                col.b = mix(darkBase.b, lightBase.b, b) + 0.1 * r; // Bleed red into blue
                
                // Rolling color contamination band
                col.g -= 0.05 * sin(uv.y * 5.0 - t * 2.0);
                col.r += 0.05 * sin(uv.y * 8.0 + t);
                
                // 4. Additive Damage (Scratches, Grain, Burn)
                col += filmScratchLayer(warpedUv, t) * vec3(0.9, 0.8, 0.6); // Amber scratches
                col += filmGrain(uv, t);
                
                float burn = filmBurn(uv, t);
                col += burn * vec3(1.0, 0.5, 0.1); // Sickly orange/yellow burn
                
                // 5. Final CRT Display Pass
                col = crtScanlines(uv, col); // Use unwarped UV for screen-space effects
                
                // Flicker and black crush
                float flicker = 1.0 - step(0.98, hashNoise(vec2(t * 10.0, 4.0))) * 0.3;
                col *= flicker;
                
                // Contrast punch
                col = smoothstep(vec3(0.05), vec3(0.95), col);
                
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