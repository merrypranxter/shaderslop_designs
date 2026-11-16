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
            uniform float u_time;
            uniform vec2 u_resolution;
            in vec2 vUv;
            out vec4 fragColor;
            
            // --- CORE NOISE FUNCTIONS ---
            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            
            // --- STRICT COLOR PALETTE MAPPING ---
            // Forces all color math into the allowed high-saturation glitchcore palette
            vec3 getPalette(float t) {
                t = abs(fract(t));
                float stepT = t * 7.0;
                float i = floor(stepT);
                float f = smoothstep(0.45, 0.55, fract(stepT)); // Sharp steps to prevent muddy colors
                
                vec3 c1 = vec3(1.0, 0.1, 0.6); // Hot Pink
                vec3 c2 = vec3(1.0, 0.7, 0.8); // Pastel Pink
                vec3 c3 = vec3(0.0, 0.9, 0.8); // Bright Teal
                vec3 c4 = vec3(1.0, 1.0, 0.0); // Electric Yellow
                vec3 c5 = vec3(0.6, 0.0, 1.0); // Saturated Purple
                vec3 c6 = vec3(0.2, 1.0, 0.0); // Neon Green
                vec3 c7 = vec3(1.0, 1.0, 1.0); // White
                
                vec3 c = c1;
                if(i == 0.0) c = mix(c1, c2, f);
                else if(i == 1.0) c = mix(c2, c3, f);
                else if(i == 2.0) c = mix(c3, c4, f);
                else if(i == 3.0) c = mix(c4, c5, f);
                else if(i == 4.0) c = mix(c5, c6, f);
                else if(i == 5.0) c = mix(c6, c7, f);
                else if(i == 6.0) c = mix(c7, c1, f);
                return c;
            }
            
            // --- OP-ART / MOIRE SIGNAL GENERATOR ---
            float pattern(vec2 uv, float time, float w_opa) {
                vec2 p = uv * 2.0 - 1.0;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                float target = sin(r * (30.0 + w_opa * 40.0) - time * 5.0);
                float wave = sin(p.x * 25.0 + sin(p.y * 20.0 + time * 3.0));
                float checker = sin(a * 12.0) * sin(r * 40.0 - time * 6.0);
                
                float mix1 = smoothstep(-0.5, 0.5, sin(time * 0.8));
                float base = mix(wave, target, mix1);
                base = mix(base, checker, w_opa * smoothstep(-0.5, 0.5, cos(time * 1.3)));
                
                float n = noise(uv * 10.0 + time);
                return base * 0.7 + n * 0.3;
            }
            
            void main() {
                vec2 uv = vUv;
                float time = u_time;
                
                // --- GLITCH STATE CONTROLLER ---
                // Shifts dominance between media damage families over time
                float tSlow = time * 0.15;
                float w_vhs = smoothstep(0.3, 0.7, sin(tSlow * 2.1) * 0.5 + 0.5 + noise(vec2(tSlow, 1.0)) * 0.5);
                float w_crt = smoothstep(0.3, 0.7, sin(tSlow * 1.7 + 2.0) * 0.5 + 0.5 + noise(vec2(tSlow, 2.0)) * 0.5);
                float w_dig = smoothstep(0.3, 0.7, sin(tSlow * 2.3 + 4.0) * 0.5 + 0.5 + noise(vec2(tSlow, 3.0)) * 0.5);
                float w_flm = smoothstep(0.3, 0.7, sin(tSlow * 1.9 + 1.0) * 0.5 + 0.5 + noise(vec2(tSlow, 4.0)) * 0.5);
                float w_opa = smoothstep(0.3, 0.7, sin(tSlow * 2.5 + 3.0) * 0.5 + 0.5 + noise(vec2(tSlow, 5.0)) * 0.5);
                
                // Exaggerate dominance to prevent mud
                w_vhs = pow(w_vhs, 2.0);
                w_crt = pow(w_crt, 2.0);
                w_dig = pow(w_dig, 2.0);
                w_flm = pow(w_flm, 2.0);
                w_opa = pow(w_opa, 2.0);
                
                // Normalize weights
                float totalW = w_vhs + w_crt + w_dig + w_flm + w_opa + 0.1;
                w_vhs /= totalW;
                w_crt /= totalW;
                w_dig /= totalW;
                w_flm /= totalW;
                w_opa /= totalW;
                
                // Corruption spikes
                float burst = step(0.95, hash(vec2(floor(time * 8.0), 0.0)));
                w_dig += burst * 0.5;
                w_vhs += step(0.98, hash(vec2(floor(time * 5.0), 1.0))) * 0.5;
                
                vec2 modUV = uv;
                
                // --- UV DISTORTIONS ---
                
                // 1. Digital Datamosh / Block Smear
                if (w_dig > 0.05) {
                    float blockSize = 10.0 + floor(hash(vec2(floor(time * 2.0), 0.0)) * 30.0);
                    vec2 grid = floor(modUV * blockSize) / blockSize;
                    if (hash(grid + floor(time * 4.0)) > 0.7) {
                        vec2 motionVec = vec2(hash(grid + 1.0), hash(grid + 2.0)) - 0.5;
                        modUV += motionVec * 0.4 * w_dig;
                    }
                    if (hash(vec2(floor(time * 3.0), 1.0)) > 0.8) {
                        modUV = mix(modUV, grid, w_dig);
                    }
                }
                
                // 2. VHS Tracking & Magnetic Warp
                if (w_vhs > 0.05) {
                    float tear = step(0.8, sin(modUV.y * 12.0 + time * 3.0)) * sin(time * 15.0);
                    modUV.x += tear * 0.15 * w_vhs;
                    float roll = fract(time * 0.4);
                    if (abs(modUV.y - roll) < 0.05) {
                        modUV.x += sin(modUV.y * 300.0) * 0.05 * w_vhs;
                        modUV.y += sin(modUV.x * 20.0 + time * 10.0) * 0.02 * w_vhs;
                    }
                    modUV.y += (hash(vec2(time * 10.0, 0.0)) - 0.5) * 0.02 * w_vhs;
                }
                
                // 3. Film Gate Weave
                if (w_flm > 0.05) {
                    modUV.y += (noise(vec2(time * 5.0, 0.0)) - 0.5) * 0.03 * w_flm;
                    if (hash(vec2(floor(time * 8.0), 2.0)) > 0.9) {
                        modUV.y += 0.2 * w_flm;
                    }
                }
                
                // 4. Op-Art Phase Moiré
                if (w_opa > 0.05) {
                    vec2 p = modUV * 2.0 - 1.0;
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    float phase = sin(r * 30.0 - time * 3.0) * sin(a * 10.0 + time * 2.0);
                    modUV += p * phase * 0.08 * w_opa;
                    float funnel = 1.0 / (r + 0.05);
                    modUV += p * sin(funnel * 4.0 - time * 4.0) * 0.03 * w_opa;
                }
                
                // --- SIGNAL COMPOSITE & CHANNEL DRIFT ---
                float driftAmt = (w_vhs * 0.05 + w_crt * 0.02 + burst * 0.1);
                vec2 offset1 = vec2(driftAmt, 0.0);
                vec2 offset2 = vec2(-driftAmt * 0.5, driftAmt * 0.8);
                
                float s1 = pattern(modUV, time, w_opa);
                float s2 = pattern(modUV + offset1, time, w_opa);
                float s3 = pattern(modUV + offset2, time, w_opa);
                
                float palIndex = s1 + s2 * 0.6 + s3 * 0.3 + time * 0.2;
                vec3 color = getPalette(palIndex);
                
                // --- DAMAGE OVERLAYS ---
                
                // Film Scratches, Dust & Burns
                if (w_flm > 0.05) {
                    float x = modUV.x * 10.0;
                    float scratch = step(0.98, hash(vec2(floor(x), floor(time * 6.0))));
                    if (scratch > 0.0 && hash(vec2(time)) > 0.2) {
                        color = mix(color, getPalette(hash(vec2(x)) * 7.0), w_flm);
                    }
                    float dust = step(0.998, hash(modUV * 300.0 + time));
                    if (dust > 0.0) color = vec3(1.0);
                    
                    float leakX = sin(modUV.x * 5.0 + time * 2.0);
                    float leakY = cos(modUV.y * 4.0 - time * 1.5);
                    float leak = smoothstep(0.5, 1.0, leakX * leakY);
                    if (leak > 0.0) {
                        vec3 leakColor = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.7, 0.8), leak);
                        color = mix(color, leakColor, leak * w_flm);
                    }
                }
                
                // Digital Packet Loss & Banding
                if (w_dig > 0.05) {
                    vec2 grid = floor(modUV * 15.0) / 15.0;
                    if (hash(grid + floor(time * 6.0)) > 0.95) {
                        color = getPalette(hash(grid) * 7.0);
                    }
                    if (w_dig > 0.5) {
                        color = floor(color * 4.0) / 4.0;
                        float luma = dot(color, vec3(0.33));
                        color = getPalette(luma * 7.0);
                    }
                }
                
                // VHS Snow & Chroma Drag
                if (w_vhs > 0.05) {
                    float snow = hash(modUV * 500.0 + time);
                    vec3 snowColor = getPalette(snow * 7.0);
                    float snowBand = sin(modUV.y * 40.0 + time * 15.0) * 0.5 + 0.5;
                    color = mix(color, snowColor, w_vhs * 0.5 * snow * snowBand);
                    float bleed = pattern(modUV + vec2(0.03, 0.0), time, w_opa);
                    color = mix(color, getPalette(bleed * 7.0 + 1.0), w_vhs * 0.4);
                }
                
                // CRT Scanlines & Phosphor Mask
                if (w_crt > 0.05) {
                    float scan = sin(gl_FragCoord.y * 2.0) * 0.5 + 0.5;
                    vec3 scanDark = vec3(0.6, 0.0, 1.0); // Use purple instead of black
                    color = mix(color, mix(scanDark, color, scan), w_crt * 0.8);
                    
                    float px = mod(floor(gl_FragCoord.x), 3.0);
                    vec3 mask = vec3(1.0);
                    if (px < 1.0) mask = vec3(1.0, 0.1, 0.6);
                    else if (px < 2.0) mask = vec3(0.0, 0.9, 0.8);
                    else mask = vec3(1.0, 1.0, 0.0);
                    
                    color = mix(color, color * mask * 2.0, w_crt * 0.7);
                    
                    vec2 curveUV = uv * 2.0 - 1.0;
                    float curve = dot(curveUV, curveUV);
                    if (curve > 1.0) {
                        color = mix(color, vec3(0.2, 1.0, 0.0), (curve - 1.0) * w_crt * 0.5);
                    }
                }
                
                // Rupture Burst
                if (burst > 0.0) {
                    color = getPalette(dot(color, vec3(0.33)) * 7.0 + 3.5);
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
if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);

/*
 * SHADER ARCHITECTURE NOTES:
 * 
 * 1. STATE CONTROLLER: Uses slow noise (`tSlow`) to crossfade weights between 5 distinct glitch 
 *    families (VHS, CRT, Digital, Film, Op-Art). Exaggerated via `pow()` so one family dominates 
 *    at any given time.
 * 2. COLOR MAPPING: `getPalette()` strictly enforces the requested neon/candy colors. It uses 
 *    sharp threshold steps (`smoothstep(0.45, 0.55)`) to prevent muddy intermediate colors.
 * 3. UV DISTORTIONS: Before sampling the signal, UVs are warped by the active damage family 
 *    (e.g., Datamosh block smearing, VHS tracking roll, Op-Art lens funneling).
 * 4. MULTI-SAMPLING: The base signal is sampled 3 times with offsets to simulate chromatic drift. 
 *    These scalars are summed to index the restricted color palette, creating pure glitch artifacts.
 * 5. OVERLAYS: Post-process damage is applied based on active weights (CRT phosphor triads, Film 
 *    scratches/light leaks, VHS snow, Digital packet loss).
 * 
 * TWEAK NOTES:
 * - More VHS: Increase `w_vhs` multiplier or lower `tSlow` threshold for VHS.
 * - More CRT: Boost `w_crt`. Adjust `gl_FragCoord.y * 2.0` to change scanline thickness.
 * - More Digital: Increase `w_dig` or trigger `burst` more frequently.
 * - More Film: Increase `w_flm` and `dust`/`scratch` probability thresholds.
 * - More Op-Art: Increase `w_opa` base multiplier to keep the moiré phase active.
 * - Faster Mode Switching: Multiply `tSlow` by a larger constant (e.g., `time * 0.5`).
 */