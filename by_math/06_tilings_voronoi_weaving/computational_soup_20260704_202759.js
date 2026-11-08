if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        // Orthographic camera covers exactly the -1 to 1 plane
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { 
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                
                // ─── Mathematical Primitives & Hashing ─────────────────────────────
                vec3 hash32(vec2 p) {
                    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
                    p3 += dot(p3, p3.yxz+33.33);
                    return fract((p3.xxy+p3.yzz)*p3.zyx);
                }

                float hash12(vec2 p) {
                    vec3 p3  = fract(vec3(p.xyx) * .1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f*f*(3.0-2.0*f);
                    float a = hash12(i);
                    float b = hash12(i + vec2(1.0, 0.0));
                    float c = hash12(i + vec2(0.0, 1.0));
                    float d = hash12(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                // Domain warping via FBM (Acoustic Impedance / Lenia flow)
                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
                    for(int i=0; i<3; i++) {
                        v += a * noise(p);
                        p = r * p * 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                // ─── Topological Structures ────────────────────────────────────────
                // Plateau Foam / Voronoi Cellular Automata
                vec4 cellular(vec2 p) {
                    vec2 n = floor(p);
                    vec2 f = fract(p);
                    float d1 = 1e9, d2 = 1e9;
                    vec2 id1 = vec2(0.0);
                    float hz = 0.0;
                    for(int j=-1; j<=1; j++) {
                        for(int i=-1; i<=1; i++) {
                            vec2 g = vec2(float(i), float(j));
                            vec3 h = hash32(n + g);
                            // Dynamic curving films based on Lenia pulse
                            vec2 r = g - f + (0.5 + 0.4 * sin(u_time * 1.2 + 6.28318 * h.xy));
                            float d = length(r) - h.z * 0.35; // Additive weight
                            if(d < d1) {
                                d2 = d1;
                                d1 = d;
                                id1 = h.xy;
                                hz = h.z;
                            } else if(d < d2) {
                                d2 = d;
                            }
                        }
                    }
                    return vec4(d1, d2, id1.x, hz);
                }

                // ─── Color Systems: Maximalist Candy-Acid Palette ──────────────────
                vec3 acidPalette(float t) {
                    t = fract(t);
                    vec3 col;
                    // Exact OKLab-inspired hue stops for hyper-saturation
                    if(t < 0.16) col = mix(vec3(1.0, 0.0, 0.6), vec3(1.0, 1.0, 0.0), smoothstep(0.0, 0.16, t));
                    else if(t < 0.33) col = mix(vec3(1.0, 1.0, 0.0), vec3(0.2, 1.0, 0.0), smoothstep(0.16, 0.33, t));
                    else if(t < 0.50) col = mix(vec3(0.2, 1.0, 0.0), vec3(0.0, 1.0, 1.0), smoothstep(0.33, 0.50, t));
                    else if(t < 0.66) col = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 0.3, 1.0), smoothstep(0.50, 0.66, t));
                    else if(t < 0.83) col = mix(vec3(0.0, 0.3, 1.0), vec3(0.6, 0.0, 1.0), smoothstep(0.66, 0.83, t));
                    else col = mix(vec3(0.6, 0.0, 1.0), vec3(1.0, 0.0, 0.6), smoothstep(0.83, 1.0, t));
                    return col;
                }

                // ─── The Retardance Field (The Engine) ─────────────────────────────
                float getThickness(vec2 p, float z) {
                    // Acoustic Impedance warp
                    float n1 = fbm(p + u_time * 0.1 + z);
                    float n2 = fbm(p + vec2(5.2, 1.3) - u_time * 0.12 + z);
                    p += vec2(n1, n2) * 1.5;
                    
                    vec4 cell = cellular(p * 2.0);
                    float film = cell.y - cell.x; // Plateau foam thickness
                    
                    // Chladni vibration nodes
                    float chladni = cos(p.x * 5.0) * cos(p.y * 5.0) - cos(p.x * 8.0) * cos(p.y * 8.0);
                    
                    // Moiré radial interference
                    float r = length(p);
                    float moire = sin(r * 25.0 - u_time * 2.0) * sin(r * 28.0 + u_time * 1.5);
                    
                    float retardance = film * 2.5 + chladni * 0.3 + moire * 0.15 + cell.z * 1.0;
                    
                    // Abelian Sandpile quantization / Bureaucratic Failure
                    if(cell.w > 0.4 + z * 0.3) {
                        retardance = floor(retardance * 5.0) / 5.0; // Crystallization
                        retardance += step(0.95, fract(u_time * 1.5 + cell.z)) * 0.15; // Machine hesitation
                    }
                    
                    return retardance;
                }

                // ─── Volumetric Scattering & Dispersion ────────────────────────────
                vec3 renderVolumetric(vec2 uv) {
                    vec3 col = vec3(0.0);
                    float accumAlpha = 0.0;
                    
                    for(int i=0; i<6; i++) {
                        float z = float(i) / 6.0;
                        float scale = mix(1.0, 2.5, z);
                        float angle = z * 1.2 + u_time * 0.08;
                        float s = sin(angle), c = cos(angle);
                        mat2 rotM = mat2(c, -s, s, c);
                        vec2 p = rotM * uv * scale;
                        
                        // Prism Dispersion: Per-wavelength chromatic aberration offsets
                        vec2 off = vec2(0.02, 0.01) * (1.0 - z);
                        
                        float tR = getThickness(p + off, z);
                        float tG = getThickness(p, z);
                        float tB = getThickness(p - off, z);
                        
                        // Michel-Lévy interference mapping
                        vec3 layerCol;
                        layerCol.r = acidPalette(tR + z - u_time * 0.2).r;
                        layerCol.g = acidPalette(tG + z - u_time * 0.2).g;
                        layerCol.b = acidPalette(tB + z - u_time * 0.2).b;
                        
                        // Lenia-style growth density (Activator/Inhibitor thresholds)
                        float density = smoothstep(0.1, 0.9, tG);
                        float alpha = density * (1.0 - z) * 0.8;
                        
                        col += layerCol * alpha * (1.0 - accumAlpha);
                        accumAlpha += alpha * 0.65;
                        if(accumAlpha > 1.0) break;
                    }
                    return col;
                }

                void main() {
                    vec2 uv = vUv;
                    vec2 centered = uv * 2.0 - 1.0;
                    centered.x *= u_resolution.x / u_resolution.y;
                    
                    vec3 col = renderVolumetric(centered);
                    
                    float lum = dot(col, vec3(0.299, 0.587, 0.114));
                    
                    // ─── Impossible Colors ─────────────────────────────────────────
                    // Stygian Blue (Darker than black, yet blue)
                    vec3 stygian = vec3(0.0, 0.05, 0.4) * smoothstep(0.3, 0.0, lum);
                    col = max(col, stygian); 
                    
                    // Self-Luminous Red (Glows brighter than white)
                    vec3 luminous = vec3(1.0, 0.1, 0.4) * smoothstep(0.7, 1.0, lum) * 1.5;
                    col += luminous;
                    
                    // ─── Shoegaze Finish ───────────────────────────────────────────
                    // Halation Bloom
                    vec3 bloom = vec3(1.0, 0.9, 0.4) * smoothstep(0.85, 1.2, lum);
                    col += bloom;
                    
                    // Film Grain Clumps
                    float grain = hash12(vUv * 1000.0 + u_time * 50.0);
                    col += (grain - 0.5) * 0.15;
                    
                    // Gentle Vignette
                    float vignette = 1.0 - dot(centered, centered) * 0.15;
                    col *= vignette;
                    
                    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
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