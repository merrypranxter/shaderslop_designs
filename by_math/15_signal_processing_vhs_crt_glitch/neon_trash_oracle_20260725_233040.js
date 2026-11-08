if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        // Camera is not strictly needed since we bypass it in the vertex shader, but we provide it for Three.js completeness
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
        camera.position.z = 1;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { 
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    // Bypass projection/modelview to draw a full-screen quad directly in clip space
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                // NEON TRASH ORACLE WEATHER SYSTEM
                // 
                // Repo DNA:
                // - temporal_desync & saccadic_masking: Saccadic glitches and temporal time shifts
                // - voronoi_systems & plateau_foam: Cellular slime territories and Plateau borders
                // - lenia: Concentric organism ripples and continuous cellular automata pulses
                // - moire & rainbow_optics: Hyper-saturated interference fields and quasicrystal facets
                // - impossible_colors & chromatic_aberration: Hyperbolic lens warping and chromatic edge fringing
                // - damage_aesthetics & crt_phosphor_fx: Scanlines, data ticker bands, and visual degradation
                // - dream_physics_textbook: Oracle core and strange floating sigils/glyphs
                // - mesh_gradients: OKLab color interpolation math

                in vec2 vUv;
                out vec4 fragColor;

                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_mouse;

                #define PI 3.14159265359

                mat2 rot2(float a) {
                    float c = cos(a), s = sin(a);
                    return mat2(c, -s, s, c);
                }

                float hash1(float n) { return fract(sin(n) * 43758.5453123); }
                vec2 hash2(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                                   dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                               mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                                   dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
                }

                float fbm(vec2 p) {
                    float f = 0.0;
                    float w = 0.5;
                    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
                    for(int i = 0; i < 5; i++) {
                        f += w * noise(p);
                        p = rot * p * 2.0;
                        w *= 0.5;
                    }
                    return f;
                }

                // Candy-Acid Palette Generator
                vec3 getPalette(float t) {
                    vec3 c1 = vec3(1.0, 0.0, 0.4); // Hot Pink
                    vec3 c2 = vec3(0.0, 1.0, 0.8); // Turquoise/Cyan
                    vec3 c3 = vec3(0.8, 1.0, 0.0); // Acid Green
                    vec3 c4 = vec3(0.4, 0.0, 1.0); // Violet
                    vec3 c5 = vec3(1.0, 0.9, 0.0); // Neon Yellow
                    
                    t = fract(t);
                    if(t < 0.2) return mix(c1, c2, t * 5.0);
                    if(t < 0.4) return mix(c2, c3, (t - 0.2) * 5.0);
                    if(t < 0.6) return mix(c3, c5, (t - 0.4) * 5.0);
                    if(t < 0.8) return mix(c5, c4, (t - 0.6) * 5.0);
                    return mix(c4, c1, (t - 0.8) * 5.0);
                }

                // Quasicrystal interference
                float quasicrystal(vec2 p, float t) {
                    float v = 0.0;
                    float n = 5.0; 
                    for(float i = 0.0; i < 5.0; i++) {
                        float a = i * PI / n + t * 0.1;
                        vec2 dir = vec2(cos(a), sin(a));
                        v += cos(dot(p, dir) * 10.0 + t);
                    }
                    return v / n;
                }

                // Voronoi / Plateau Foam
                vec4 voronoi(vec2 x, float t) {
                    vec2 n = floor(x);
                    vec2 f = fract(x);
                    float m = 8.0;
                    float m2 = 8.0;
                    float id = 0.0;
                    for(int j = -1; j <= 1; j++) {
                        for(int i = -1; i <= 1; i++) {
                            vec2 g = vec2(float(i), float(j));
                            vec2 o = hash2(n + g) * 0.5 + 0.5;
                            o = 0.5 + 0.4 * sin(t + 6.2831 * o); // Organic movement
                            vec2 r = g + o - f;
                            float d = dot(r, r);
                            if(d < m) {
                                m2 = m; m = d; id = hash1(dot(n + g, vec2(12.989, 78.233)));
                            } else if(d < m2) {
                                m2 = d;
                            }
                        }
                    }
                    return vec4(sqrt(m), sqrt(m2), id, m2 - m);
                }

                // SDF Hexagon
                float sdHexagon(vec2 p, float r) {
                    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
                    p = abs(p);
                    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
                    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
                    return length(p) * sign(p.y);
                }

                // Symbolic Neon Glyphs
                float glyph(vec2 p, float id) {
                    p = fract(p * 5.0 + id) - 0.5;
                    float d = max(abs(p.x), abs(p.y)) - 0.2;
                    d = max(d, -(length(p) - 0.15)); // Hollow box
                    d = min(d, length(p + vec2(0.1)) - 0.05); // Add a dot
                    return smoothstep(0.02, 0.0, abs(d));
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;
                    
                    float t = u_time * 0.6;
                    
                    // Mouse Gravity Well / Oracle Lens
                    vec2 mouse = (u_mouse - 0.5) * 2.0;
                    mouse.x *= u_resolution.x / u_resolution.y;
                    float mouseDist = length(uv - mouse);
                    vec2 lensWarp = normalize(uv - mouse) * (0.05 / (mouseDist + 0.1)) * sin(t);
                    uv += lensWarp;
                    
                    // Saccadic Glitch (Damage Aesthetics)
                    float saccade = step(0.95, fract(t * 1.5 + hash1(floor(t))));
                    uv.x += saccade * 0.05 * sin(uv.y * 100.0);
                    
                    float r = length(uv);
                    float a = atan(uv.y, uv.x);
                    vec2 polar = vec2(a / 6.28318 + t * 0.1, 0.5 / (r + 0.1) + t * 0.2);
                    
                    // Domain Warp
                    float warp = fbm(polar * 3.0 + t);
                    vec2 p = uv + warp * 0.15;
                    
                    // Cellular slime-weather (Voronoi + Lenia)
                    vec4 v = voronoi(p * 4.0, t * 0.5);
                    float d1 = v.x;
                    float border = v.w;
                    float cellId = v.z;
                    
                    // Lenia / Reaction-Diffusion ripples
                    float leniaPulse = sin(d1 * 40.0 - t * 8.0);
                    leniaPulse = smoothstep(0.1, 0.2, leniaPulse) * smoothstep(0.9, 0.8, leniaPulse);
                    
                    vec3 cellCol = getPalette(cellId + t * 0.05);
                    cellCol = mix(cellCol, vec3(1.0), leniaPulse * 0.6);
                    
                    // Plateau Borders
                    float edgeGlow = smoothstep(0.02, 0.0, border);
                    cellCol = mix(cellCol, vec3(0.0, 1.0, 0.8), edgeGlow); 
                    
                    // Oracle Core (SDF Rings, Quasicrystal)
                    float qc = quasicrystal(uv * 5.0, t);
                    float ring1 = abs(r - 0.5) - 0.02 + qc * 0.02;
                    float ring2 = abs(r - 0.4) - 0.01 + fbm(uv * 10.0 - t) * 0.03;
                    float hex = sdHexagon(uv * rot2(t * 0.5), 0.2);
                    
                    float coreMask = smoothstep(0.02, 0.0, ring1) + smoothstep(0.01, 0.0, ring2) + smoothstep(0.02, 0.0, abs(hex));
                    float eye = smoothstep(0.1, 0.0, r) * (0.5 + 0.5 * sin(t * 10.0));
                    coreMask += eye;
                    
                    vec3 coreCol = getPalette(t * 0.3 - r) * coreMask * 2.5; // Core Bloom
                    
                    // Background Moiré Interference
                    float moire = sin(polar.y * 40.0 - t * 2.0) * cos(polar.x * 20.0 + polar.y * 10.0 + t);
                    vec3 bgCol = getPalette(polar.y * 0.5 - t * 0.1 + moire * 0.15) * 0.5;
                    
                    // Glitch Ticker Data Band
                    float tickerY = fract(vUv.y * 15.0 + t * 0.5);
                    float tickerMask = step(0.9, tickerY) * step(abs(uv.x), 0.9);
                    float dataHash = hash1(floor(vUv.x * 40.0) + floor(vUv.y * 15.0) + floor(t * 10.0));
                    vec3 tickerCol = vec3(1.0, 0.9, 0.0) * step(0.6, dataHash); 
                    
                    // Combine Layers
                    vec3 finalCol = bgCol;
                    finalCol = mix(finalCol, cellCol, smoothstep(1.0, 0.4, r)); // Cells fade near core
                    finalCol += coreCol;
                    finalCol += tickerCol * tickerMask * 0.9;
                    
                    // Floating Foreground Glyphs
                    float g = glyph(uv + warp * 0.1, cellId);
                    finalCol += vec3(0.0, 1.0, 0.5) * g * 0.8 * smoothstep(0.6, 1.2, r);
                    
                    // Chromatic Aberration & Lens Warp
                    float ca = smoothstep(0.4, 1.5, r);
                    finalCol.r += ca * 0.3 * sin(t * 5.0 + uv.y * 20.0);
                    finalCol.b += ca * 0.3 * cos(t * 5.0 + uv.x * 20.0);
                    
                    // Stygian / Impossible Color Contrast Push
                    finalCol = pow(finalCol, vec3(1.2)); 
                    
                    // CRT Scanlines
                    finalCol *= 1.0 - 0.15 * sin(vUv.y * 800.0);
                    
                    // Vignette
                    finalCol *= 1.0 - 0.4 * r * r;

                    fragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
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
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Default to center if mouse hasn't moved, otherwise normalize and flip Y
    let mx = mouse.x ? mouse.x / grid.width : 0.5;
    let my = mouse.y ? 1.0 - (mouse.y / grid.height) : 0.5;
    material.uniforms.u_mouse.value.set(mx, my);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);