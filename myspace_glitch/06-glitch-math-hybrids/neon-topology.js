if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
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
            uniform vec2 u_mouse;
            
            #define PI 3.14159265359
            
            // ─────────────────────────────────────────────────────────────────
            // PALETTES (From Merry's Visual Bible & Retrofuturism)
            // ─────────────────────────────────────────────────────────────────
            vec3 palTetra(float t) {
                return vec3(0.5, 0.4, 0.1) + vec3(0.5, 0.4, 0.1) * cos(6.28318 * (vec3(1.0, 0.7, 0.4) * t + vec3(0.0, 0.15, 0.20)));
            }
            vec3 palWhirring(float t) {
                return vec3(0.2, 0.5, 0.6) + vec3(0.2, 0.4, 0.4) * cos(6.28318 * (vec3(2.0, 1.0, 1.0) * t + vec3(0.0, 0.25, 0.5)));
            }
            vec3 palOcean(float t) {
                return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(1.0, 0.7, 0.4) * t + vec3(0.0, 0.15, 0.25)));
            }
            vec3 palMycelium(float t) {
                return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(1.0) * t + vec3(0.4, 0.8, 0.9))); // Y2K Techno-Pop Neon
            }
            
            // ─────────────────────────────────────────────────────────────────
            // MATH & NOISE UTILS
            // ─────────────────────────────────────────────────────────────────
            mat2 rot(float a) {
                float c = cos(a), s = sin(a);
                return mat2(c, -s, s, c);
            }
            
            vec2 radial(vec2 p, float n) {
                float a = atan(p.y, p.x);
                float r = length(p);
                float an = PI * 2.0 / n;
                a = mod(a + an / 2.0, an) - an / 2.0;
                return r * vec2(cos(a), sin(a));
            }
            
            float hash13(vec3 p3) {
                p3  = fract(p3 * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }
            
            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(mix(hash13(p + vec3(0.0, 0.0, 0.0)), hash13(p + vec3(1.0, 0.0, 0.0)), f.x),
                               mix(hash13(p + vec3(0.0, 1.0, 0.0)), hash13(p + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                           mix(mix(hash13(p + vec3(0.0, 0.0, 1.0)), hash13(p + vec3(1.0, 0.0, 1.0)), f.x),
                               mix(hash13(p + vec3(0.0, 1.0, 1.0)), hash13(p + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
            }
            
            float fbm(vec3 p) {
                float f = 0.0; float a = 0.5;
                for(int i=0; i<4; i++) {
                    f += a * noise(p);
                    p *= 2.0; a *= 0.5;
                }
                return f;
            }
            
            // ─────────────────────────────────────────────────────────────────
            // PRIMITIVES & SDFs
            // ─────────────────────────────────────────────────────────────────
            float sdBox(vec3 p, vec3 b) {
                vec3 q = abs(p) - b;
                return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
            }
            
            float sdTorus(vec3 p, vec2 t) {
                vec2 q = vec2(length(p.xz) - t.x, p.y);
                return length(q) - t.y;
            }
            
            float smin(float a, float b, float k) {
                float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
                return mix(b, a, h) - k * h * (1.0 - h);
            }
            
            // Structural Color Thin-Film Interference (from structural_color repo)
            vec3 thinFilm(float cosTheta, float thickness) {
                float n = 1.33; 
                float pathDiff = 2.0 * n * thickness * sqrt(1.0 - pow(sin(acos(cosTheta)) / n, 2.0));
                vec3 phase = vec3(0.0, 0.33, 0.67);
                return 0.5 + 0.5 * cos(6.28318 * (pathDiff * vec3(1.0, 0.8, 0.6) + phase)); 
            }
            
            // ─────────────────────────────────────────────────────────────────
            // SCENE MAPPING
            // ─────────────────────────────────────────────────────────────────
            float g_dTetra, g_dWhir, g_dLace, g_dOcean;
            
            vec2 map(vec3 p) {
                vec2 res = vec2(1000.0, 0.0);
                
                // 1. The Tetragrammaton (Sacred Mathematical Core)
                vec3 pt = p;
                pt.xz = radial(pt.xz, 4.0);
                pt.xz *= rot(u_time * 0.3);
                float dTetraInner = smin(length(pt) - 0.4 - 0.05 * sin(u_time * 0.7), sdBox(pt, vec3(0.35)), 0.15);
                
                vec3 pt2 = p;
                pt2.xz = radial(pt2.xz, 4.0);
                pt2.xz *= rot(-u_time * 0.5);
                float dTetraOuter = sdBox(pt2, vec3(0.7, 0.02, 0.7));
                
                g_dTetra = smin(dTetraInner, dTetraOuter, 0.05);
                
                // 2. The Whirring (Interference Rings)
                vec3 pw1 = p; pw1.xz *= rot(u_time * 1.2);
                float dW1 = sdTorus(pw1, vec2(1.2, 0.02));
                
                vec3 pw2 = p; pw2.yz *= rot(u_time * 0.5); pw2.xy *= rot(-u_time * 0.7);
                float dW2 = sdTorus(pw2, vec2(1.6, 0.015));
                
                vec3 pw3 = p; pw3.xy *= rot(u_time * 0.4);
                float dW3 = sdTorus(pw3, vec2(2.1, 0.01));
                
                g_dWhir = smin(dW1, smin(dW2, dW3, 0.05), 0.05);
                
                // 3. Mycelial Lace (Anastomosis Gyroid Network)
                float gy = dot(sin(p * 2.0 + u_time), cos(p.zxy * 2.0)) * 0.25;
                g_dLace = abs(length(p) - 3.5) - 0.1 + gy;
                
                // 4. The Ocean / Math (FBM Warped Infinite Plane)
                g_dOcean = p.y + 2.5 - fbm(p * 0.5 + vec3(u_time * 0.1)) * 1.5;
                
                // Scene Union
                if(g_dTetra < res.x) res = vec2(g_dTetra, 1.0);
                if(g_dWhir < res.x)  res = vec2(g_dWhir, 2.0);
                if(g_dLace < res.x)  res = vec2(g_dLace, 3.0);
                if(g_dOcean < res.x) res = vec2(g_dOcean, 4.0);
                
                return res;
            }
            
            vec3 getNormal(vec3 p) {
                vec2 e = vec2(0.005, 0.0);
                return normalize(vec3(
                    map(p + e.xyy).x - map(p - e.xyy).x,
                    map(p + e.yxy).x - map(p - e.yxy).x,
                    map(p + e.yyx).x - map(p - e.yyx).x
                ));
            }
            
            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                vec2 m = (u_mouse - 0.5) * 2.0;
                
                // Camera Setup
                vec3 ro = vec3(0.0, 1.5, -6.0);
                ro.xz *= rot(u_time * 0.05 + m.x * 2.0);
                ro.y += m.y * 2.0;
                
                vec3 ww = normalize(vec3(0.0, 0.0, 0.0) - ro);
                vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
                vec3 vv = normalize(cross(ww, uu));
                vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.2 * ww);
                
                float t = 0.0;
                vec2 res = vec2(0.0);
                
                // Glow Accumulators
                float tetraGlow = 0.0;
                float whirGlow = 0.0;
                float myceliumGlow = 0.0;
                
                // Raymarching Loop
                for(int i = 0; i < 90; i++) {
                    vec3 p = ro + rd * t;
                    res = map(p);
                    
                    // Accumulate Phosphor / Node Glows
                    tetraGlow += 0.005 / (0.01 + g_dTetra * g_dTetra);
                    whirGlow += 0.005 / (0.01 + g_dWhir * g_dWhir);
                    myceliumGlow += 0.005 / (0.05 + g_dLace * g_dLace);
                    
                    if(res.x < 0.002 || t > 25.0) break;
                    t += res.x * 0.6; // Step scale for safety with gyroids
                }
                
                // The Void Rule (Background is always near-black void)
                vec3 col = vec3(0.02, 0.0, 0.05); 
                
                if(t < 25.0) {
                    vec3 p = ro + rd * t;
                    vec3 n = getNormal(p);
                    vec3 v = -rd;
                    
                    if(res.y == 1.0) { 
                        // Tetragrammaton: Self-luminous gold/white
                        col = palTetra(length(p) + u_time * 0.5) * 1.5;
                        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
                        col += vec3(1.0, 0.95, 0.8) * rim * 2.0;
                    } 
                    else if(res.y == 2.0) { 
                        // The Whirring: Self-luminous cyan
                        col = palWhirring(length(p) - u_time) * 1.8;
                    }
                    else if(res.y == 3.0) { 
                        // Mycelial Lace: Structural Color + White Rot Bleaching
                        float cosTheta = max(dot(n, v), 0.0);
                        col = thinFilm(cosTheta, 0.8 + 0.2 * sin(u_time));
                        
                        float bleach = fbm(p * 4.0 + vec3(u_time));
                        col = mix(col, vec3(0.9, 0.95, 1.0), bleach * 0.6); // Lignin peroxidase bleach
                        col *= palMycelium(length(p) * 0.5 - u_time);       // Atompunk / Neon injection
                    }
                    else if(res.y == 4.0) { 
                        // The Ocean / Math: Lit from below
                        col = palOcean(p.y * 0.5 + u_time * 0.04);
                        vec3 lightPos = vec3(3.0 * sin(u_time * 0.1), -5.0, 3.0 * cos(u_time * 0.1));
                        vec3 l = normalize(lightPos - p);
                        float sss = pow(clamp(dot(v, -l), 0.0, 1.0), 4.0);
                        col += vec3(0.8, 0.9, 1.0) * sss * 1.5;
                    }
                    
                    // The Ship Rule: Heavy Fog
                    col = mix(col, vec3(0.02, 0.0, 0.05), 1.0 - exp(-0.015 * t * t));
                }
                
                // Apply Glows (CRT Phosphor Bloom / Anastomosis nodes)
                col += palTetra(u_time) * tetraGlow * 0.08;
                col += palWhirring(u_time) * whirGlow * 0.08;
                col += palMycelium(u_time) * myceliumGlow * 0.04;
                
                // ─────────────────────────────────────────────────────────────
                // DAMAGE AESTHETICS (Post-Processing)
                // ─────────────────────────────────────────────────────────────
                
                // 1. CRT Scanlines (Raster Structure)
                float scanline = sin(gl_FragCoord.y * 2.0) * 0.05;
                col -= scanline;
                
                // 2. Film Grain (Particulate Texture)
                float grain = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453) * 0.06;
                col += grain;
                
                // 3. Dirty Lens / Vaseline Smear (Optical Contamination)
                float lensSmear = fbm(vec3(vUv * 5.0, u_time * 0.1)) * 0.15;
                float vignette = length(vUv - 0.5);
                col += lensSmear * vignette * vec3(0.4, 0.6, 0.8) * 2.0; 
                
                // 4. Datamosh / Interframe Smear (Simulated Chroma Split)
                float datamosh = noise(vec3(vUv * 10.0, u_time)) * 0.02;
                col.r += datamosh * 0.5;
                col.b -= datamosh * 0.5;
                
                // Edge Vignette
                col *= smoothstep(0.8, 0.2, vignette);
                
                // Tonemapping (ACES-like approximation)
                col = col / (1.0 + col);
                col = pow(col, vec3(1.0 / 2.2)); // Gamma correction
                
                fragColor = vec4(col, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader,
            fragmentShader
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
    
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    
    if (material.uniforms.u_mouse) {
        let mx = grid.width > 0 ? mouse.x / grid.width : 0.5;
        let my = grid.height > 0 ? 1.0 - (mouse.y / grid.height) : 0.5;
        material.uniforms.u_mouse.value.x += (mx - material.uniforms.u_mouse.value.x) * 0.1;
        material.uniforms.u_mouse.value.y += (my - material.uniforms.u_mouse.value.y) * 0.1;
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);