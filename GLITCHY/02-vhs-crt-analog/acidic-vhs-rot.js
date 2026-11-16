/**
 * LISA FRANK ACID ROT // OP-ART SIGNAL DECAY
 * 
 * A feral shader system combining rigorous optical interference (moiré) 
 * with catastrophic analog/digital media failure, all drenched in a 
 * hyper-saturated, bruised, neon-acidic "Lisa Frank" color palette.
 * 
 * TWEAK NOTES (Find these constants in the GLSL code):
 * 1. MORE VHS: Increase TRACKING_DAMAGE, SYNC_JITTER, and CHROMA_BLEED.
 * 2. MORE CRT: Increase SCANLINE_STRENGTH, PHOSPHOR_STRENGTH, and CRT_CURVATURE.
 * 3. MORE DIGITAL GLITCH: Increase BLOCK_DAMAGE and DATAMOSH_SMEAR.
 * 4. MORE FILM DAMAGE: Increase SCRATCH_STRENGTH, BURN_INTENSITY, and FILM_GRAIN.
 * 5. MORE OP-ART: Increase MOIRE_SCALE and MOIRE_CONTRAST.
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("Context not provided");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
        
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

            // --- TWEAKABLE CONSTANTS ---
            #define GLITCH_INTENSITY 1.0
            
            // VHS / Analog
            #define TRACKING_DAMAGE 0.6
            #define SYNC_JITTER 0.3
            #define CHROMA_BLEED 0.015
            
            // CRT
            #define CRT_CURVATURE 0.15
            #define SCANLINE_STRENGTH 0.6
            #define PHOSPHOR_STRENGTH 0.5
            
            // Digital / Block
            #define BLOCK_DAMAGE 0.4
            #define DATAMOSH_SMEAR 0.5
            
            // Film
            #define FILM_GRAIN 0.15
            #define SCRATCH_STRENGTH 0.4
            #define BURN_INTENSITY 0.7
            
            // Op-Art / Moiré
            #define MOIRE_SCALE 45.0
            #define MOIRE_CONTRAST 2.0

            // --- HASH & NOISE UTILS ---
            float hash11(float p) {
                p = fract(p * .1031);
                p *= p + 33.33;
                p *= p + p;
                return fract(p);
            }

            float hash12(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * .1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            vec2 hash21(float p) {
                vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.xx+p3.yz)*p3.zy);
            }

            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
                p3 += dot(p3, p3.yzx+33.33);
                return fract((p3.xx+p3.yz)*p3.zy);
            }

            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash12(i + vec2(0.0,0.0)), hash12(i + vec2(1.0,0.0)), u.x),
                           mix(hash12(i + vec2(0.0,1.0)), hash12(i + vec2(1.0,1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                vec2 shift = vec2(100.0);
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < 4; ++i) {
                    v += a * valueNoise(p);
                    p = rot * p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            // --- LAYER FUNCTIONS ---

            // 1. Base Op-Art Moiré Pattern (The Signal)
            // Generates rigorous concentric interference patterns.
            float opArtField(vec2 uv, float t) {
                // Warped radial distance 1
                vec2 c1 = vec2(sin(t*0.4)*0.3, cos(t*0.3)*0.3);
                float d1 = length(uv - c1);
                float r1 = abs(fract(d1 * MOIRE_SCALE) - 0.5) * 2.0;
                r1 = smoothstep(0.4, 0.6, r1);

                // Warped radial distance 2
                vec2 c2 = vec2(cos(t*0.5)*0.4, sin(t*0.2)*0.2);
                float d2 = length(uv + c2);
                float r2 = abs(fract(d2 * (MOIRE_SCALE * 1.05)) - 0.5) * 2.0;
                r2 = smoothstep(0.4, 0.6, r2);

                // Spiral interference
                float angle = atan(uv.y, uv.x);
                float spiral = sin(angle * 6.0 + length(uv) * 10.0 - t);
                spiral = smoothstep(-0.2, 0.2, spiral);

                // Combine for moiré beats
                float moire = mix(r1 * r2, r1 + r2 - r1*r2, spiral);
                return pow(moire, MOIRE_CONTRAST);
            }

            // 2. Lisa Frank Acid Palette Mapper
            // Translates raw signal values into hyper-saturated neon rot.
            vec3 lisaFrankPalette(float v, vec2 uv, float t) {
                // Base neon colors
                vec3 hotPink = vec3(1.0, 0.0, 0.6);
                vec3 cyan = vec3(0.0, 1.0, 0.9);
                vec3 lime = vec3(0.6, 1.0, 0.0);
                vec3 electricPurple = vec3(0.5, 0.0, 1.0);
                vec3 yellow = vec3(1.0, 0.9, 0.0);

                // Spatially and temporally shifting color map
                float phase = v + fbm(uv * 2.0 + t * 0.5) * 2.0;
                
                vec3 col = mix(hotPink, cyan, sin(phase * 3.14) * 0.5 + 0.5);
                col = mix(col, electricPurple, sin(phase * 5.0 + t) * 0.5 + 0.5);
                col = mix(col, lime, smoothstep(0.7, 1.0, sin(phase * 7.0)));
                col = mix(col, yellow, smoothstep(0.8, 1.0, v)); // Highlights are sickly yellow

                // Bruise the shadows
                col = mix(vec3(0.1, 0.0, 0.2), col, smoothstep(0.0, 0.3, v));
                return col;
            }

            // 3. VHS Tracking & Sync Jitter
            vec2 vhsTrackingWarp(vec2 uv, float t) {
                vec2 warpedUv = uv;
                
                // Continuous rolling sync instability
                float sync = sin(uv.y * 10.0 + t * 2.0) * sin(uv.y * 3.0 - t * 4.0);
                warpedUv.x += sync * 0.01 * SYNC_JITTER * GLITCH_INTENSITY;

                // Violent horizontal tracking tears
                float tearBand = valueNoise(vec2(t * 10.0, uv.y * 5.0));
                float tearTrigger = step(0.85, valueNoise(vec2(t * 2.0, 0.0)));
                warpedUv.x += smoothstep(0.6, 0.9, tearBand) * 0.15 * tearTrigger * TRACKING_DAMAGE * GLITCH_INTENSITY;

                // Tape wobble (slow bend)
                warpedUv.x += sin(uv.y * 2.0 + t) * 0.02 * TRACKING_DAMAGE;

                return warpedUv;
            }

            // 4. Digital Block Corruption (Datamoshing)
            vec2 digitalBlockDamage(vec2 uv, float t) {
                vec2 blockUv = uv;
                // Grid quantization
                vec2 grid = floor(uv * vec2(24.0, 18.0));
                
                // Trigger blocks based on noise
                float blockNoise = valueNoise(grid + floor(t * 8.0));
                float trigger = step(1.0 - (0.3 * BLOCK_DAMAGE * GLITCH_INTENSITY), blockNoise);
                
                // Smear UVs along previous motion vectors (simulated)
                vec2 smearOffset = hash22(grid) - 0.5;
                blockUv += smearOffset * 0.1 * trigger * DATAMOSH_SMEAR;

                return blockUv;
            }

            // 5. Film Scratches & Dust
            float filmScratchLayer(vec2 uv, float t) {
                // Vertical scratches moving horizontally
                float scratchX = uv.x * 2.0 + valueNoise(vec2(t * 0.5, 0.0));
                float scratch = fract(scratchX * 10.0);
                float scratchIntensity = valueNoise(vec2(floor(scratchX * 10.0), floor(t * 10.0)));
                
                float line = smoothstep(0.02, 0.0, abs(scratch - 0.5));
                return line * step(0.8, scratchIntensity) * SCRATCH_STRENGTH;
            }

            // 6. Overexposed Film Burn / Chemical Melt
            vec3 filmBurnLayer(vec2 uv, float t) {
                float n = fbm(uv * 3.0 - vec2(0.0, t * 0.5));
                float burnMask = smoothstep(0.5, 0.8, n + sin(t)*0.1);
                
                // Acidic burn colors: oxidized blue melting into radioactive yellow
                vec3 burnColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 1.0, 0.0), smoothstep(0.6, 0.8, n));
                burnColor = mix(burnColor, vec3(1.0, 0.0, 0.5), smoothstep(0.7, 0.9, n)); // Edge magenta
                
                return burnColor * burnMask * BURN_INTENSITY;
            }

            // 7. CRT Phosphor Mask & Scanlines
            vec3 crtMask(vec2 uv, vec2 res) {
                // Scanlines
                float scan = sin(uv.y * res.y * 1.5) * 0.5 + 0.5;
                scan = mix(1.0, scan, SCANLINE_STRENGTH);

                // RGB Phosphor Triad
                float maskX = uv.x * res.x * 1.5;
                vec3 triad = vec3(
                    sin(maskX) * 0.5 + 0.5,
                    sin(maskX + 2.094) * 0.5 + 0.5, // +120 deg
                    sin(maskX + 4.188) * 0.5 + 0.5  // +240 deg
                );
                triad = mix(vec3(1.0), triad, PHOSPHOR_STRENGTH);

                return vec3(scan) * triad;
            }

            // --- MAIN COMPOSITE ---
            void main() {
                // Normalize UV (-1 to 1) and fix aspect ratio
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // 1. CRT Curvature Warp
                float r = dot(uv, uv);
                uv *= 1.0 + r * CRT_CURVATURE;
                
                // Check bounds after curvature (vignette/border)
                float border = smoothstep(0.95, 1.0, max(abs(uv.x / (u_resolution.x/u_resolution.y)), abs(uv.y)));
                if (border > 0.99) {
                    fragColor = vec4(0.05, 0.02, 0.05, 1.0); // Dirty black border
                    return;
                }

                // Map back to 0-1 for texture math
                uv = uv * 0.5 + 0.5;

                // 2. Apply Temporal & Spatial Damage to UVs
                float t = u_time * 0.5;
                vec2 uv_vhs = vhsTrackingWarp(uv, t);
                vec2 uv_final = digitalBlockDamage(uv_vhs, t);

                // 3. RGB Channel Drift & Op-Art Signal Extraction
                // Separate UVs for chromatic aberration
                float driftAmount = CHROMA_BLEED * GLITCH_INTENSITY;
                // Add noise to drift for "sickly" color splitting
                driftAmount *= 1.0 + valueNoise(vec2(t * 5.0, uv.y * 10.0)) * 2.0; 

                vec2 uvR = uv_final + vec2(driftAmount, 0.0);
                vec2 uvG = uv_final;
                vec2 uvB = uv_final - vec2(driftAmount * 0.5, driftAmount * 0.2);

                // Sample the op-art field
                float sigR = opArtField(uvR, t);
                float sigG = opArtField(uvG, t + 0.05); // Temporal phase shift for color beats
                float sigB = opArtField(uvB, t + 0.1);

                // 4. Map Signal to Lisa Frank Acid Palette
                vec3 colR = lisaFrankPalette(sigR, uvR, t);
                vec3 colG = lisaFrankPalette(sigG, uvG, t);
                vec3 colB = lisaFrankPalette(sigB, uvB, t);
                
                // Composite the drifted channels
                vec3 signal = vec3(colR.r, colG.g, colB.b);

                // Boost saturation and contrast to make it feral
                signal = mix(vec3(dot(signal, vec3(0.333))), signal, 1.5);
                signal = smoothstep(0.1, 0.9, signal);

                // 5. Apply Film Damage (Scratches & Burns)
                float scratch = filmScratchLayer(uv_final, t);
                signal = mix(signal, vec3(0.8, 0.9, 1.0), scratch); // Bright white/cyan scratches
                
                vec3 burn = filmBurnLayer(uv, t);
                signal += burn; // Additive burn

                // 6. Analog Snow / Sensor Noise
                float noise = hash12(uv * u_resolution + t);
                signal += (noise - 0.5) * FILM_GRAIN;

                // 7. CRT Overlay
                vec3 crt = crtMask(vUv, u_resolution);
                signal *= crt;

                // 8. Flickering Black Crush (Power Instability)
                float flicker = valueNoise(vec2(t * 15.0, 0.0));
                flicker = smoothstep(0.3, 0.8, flicker);
                signal *= mix(0.7, 1.0, flicker);

                // Vignette
                signal *= 1.0 - border;

                fragColor = vec4(signal, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            depthWrite: false,
            depthTest: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        // Fallback drawing if WebGL fails
        if (ctx && ctx.fillStyle) {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, grid.width, grid.height);
            ctx.fillStyle = '#ff00ff';
            ctx.font = '20px monospace';
            ctx.fillText("SIGNAL LOST // WEBGL REQUIRED", 20, 40);
        }
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    
    // Check if resolution changed
    if (material.uniforms.u_resolution.value.x !== grid.width || 
        material.uniforms.u_resolution.value.y !== grid.height) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        renderer.setSize(grid.width, grid.height, false);
    }
}

renderer.render(scene, camera);