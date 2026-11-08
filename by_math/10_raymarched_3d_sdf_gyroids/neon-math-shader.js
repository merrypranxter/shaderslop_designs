try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            precision highp float;
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_isPressed;

            #define MAX_STEPS 90
            #define MAX_DIST 15.0
            #define SURF_DIST 0.002

            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                float n = p.x + p.y * 157.0 + 113.0 * p.z;
                return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                               mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
                           mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                               mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
            }

            float fbm(vec3 p) {
                float f = 0.0;
                float amp = 0.5;
                for(int i = 0; i < 4; i++) {
                    f += amp * noise(p);
                    p *= 2.0;
                    amp *= 0.5;
                }
                return f;
            }

            // Tetragrammaton 4-fold Symmetry
            vec3 opSym(vec3 p) {
                float a = atan(p.z, p.x);
                float r = length(p.xz);
                float n = 1.5707963; // PI/2
                a = mod(a + n/2.0, n) - n/2.0;
                p.x = r * cos(a);
                p.z = r * sin(a);
                return p;
            }

            float sdTorus(vec3 p, vec2 t) {
                vec2 q = vec2(length(p.xz)-t.x, p.y);
                return length(q)-t.y;
            }

            float sdGyroid(vec3 p, float scale) {
                p *= scale;
                return abs(dot(sin(p), cos(p.zxy))) / scale;
            }

            float sdBox(vec3 p, vec3 b) {
                vec3 q = abs(p) - b;
                return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
            }

            vec2 map(vec3 p) {
                vec2 res = vec2(MAX_DIST, 0.0);
                
                // The Ocean / Math (Substrate)
                float warp = fbm(p * 0.4 + u_time * 0.1);
                float oceanH = fbm(vec3(p.x, warp, p.z) * 1.5) * 1.2;
                float ocean = p.y + 2.5 - oceanH;
                if (ocean < res.x) res = vec2(ocean, 1.0);
                
                vec3 q = p;
                q.y -= 0.5;
                
                q.xy *= rot(u_time * 0.05);
                q = opSym(q);
                
                // The Whirring (Central Rotors)
                vec3 q1 = q; q1.xy *= rot(u_time * 0.4);
                float ring1 = sdTorus(q1, vec2(1.4, 0.08));
                
                vec3 q2 = q; q2.yz *= rot(-u_time * 0.3);
                float ring2 = sdTorus(q2, vec2(0.9, 0.04));
                
                float whirring = min(ring1, ring2);
                
                // Mycelial Network (Enzymatic Decay)
                float mycelium = sdGyroid(p + vec3(0.0, u_time*0.2, 0.0), 3.0) - 0.08;
                
                // Brown Rot Cubical Cracking
                vec3 cell = fract(p * 3.0) - 0.5;
                float cubes = sdBox(cell, vec3(0.2));
                
                // Mycelial subtraction mapping
                float structure = max(whirring, -mycelium);
                
                // Interaction: Pressure triggers brown rot macroblocking
                structure = max(structure, -cubes * u_isPressed);
                
                if (structure < res.x) res = vec2(structure * 0.8, 2.0); 
                
                return res;
            }

            vec3 getNormal(vec3 p) {
                vec2 e = vec2(0.002, 0.0);
                return normalize(vec3(
                    map(p+e.xyy).x - map(p-e.xyy).x,
                    map(p+e.yxy).x - map(p-e.yxy).x,
                    map(p+e.yyx).x - map(p-e.yyx).x
                ));
            }

            // Structural Color Interference
            vec3 thinFilm(float cosTheta, float thickness) {
                float n = 1.4; 
                float pathDiff = 2.0 * n * thickness * sqrt(max(0.0, 1.0 - pow(sin(acos(cosTheta))/n, 2.0)));
                vec3 phase = vec3(0.0, 0.33, 0.67);
                return 0.5 + 0.5 * cos(6.28318 * (pathDiff + phase));
            }

            // Codec & VHS Damage Protocol
            vec2 damageUV(vec2 uv) {
                float blockNoise = noise(vec3(uv * 10.0, u_time));
                float block = step(0.85, blockNoise);
                vec2 block_uv = floor(uv * 20.0) / 20.0;
                uv = mix(uv, block_uv, block * 0.4);
                
                float tear = step(0.96, sin(uv.y * 40.0 + u_time * 8.0)) * 
                             sin(uv.y * 15.0 + u_time * 20.0) * 0.04;
                uv.x += tear;
                
                return uv;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                uv = damageUV(uv);
                
                vec3 ro = vec3(0.0, 1.5, -4.5);
                
                float rotX = -(u_mouse.x - 0.5) * 6.28 + u_time * 0.05;
                float rotY = clamp(-(u_mouse.y - 0.5) * 3.14 + 0.2, -1.2, 1.2);
                
                ro.yz *= rot(rotY);
                ro.xz *= rot(rotX);
                
                vec3 f = normalize(-ro);
                vec3 r = normalize(cross(vec3(0,1,0), f));
                vec3 u = cross(f, r);
                vec3 rd = normalize(f * 1.0 + uv.x * r + uv.y * u);
                
                float dO = 0.0;
                vec2 hit = vec2(0.0);
                float glow = 0.0;
                
                for(int i = 0; i < MAX_STEPS; i++) {
                    vec3 p = ro + rd * dO;
                    hit = map(p);
                    dO += hit.x;
                    
                    // Phosphor bloom / Foxfire accumulation
                    if (hit.y == 2.0) glow += exp(-hit.x * 12.0) * 0.015;
                    if(hit.x < SURF_DIST || dO > MAX_DIST) break;
                }
                
                vec3 col = vec3(0.0);
                
                if(dO < MAX_DIST) {
                    vec3 p = ro + rd * dO;
                    vec3 n = getNormal(p);
                    vec3 v = normalize(ro - p);
                    float cosTheta = max(dot(n, v), 0.0);
                    
                    if (hit.y == 1.0) {
                        // The Ocean: Lit from below
                        vec3 lightPos = vec3(sin(u_time)*3.0, -1.0, cos(u_time)*3.0);
                        vec3 l = normalize(lightPos - p);
                        float dif = max(dot(n, l), 0.0) * 0.6 + 0.4;
                        
                        float t = p.x * 0.2 + p.z * 0.2 + u_time * 0.1;
                        vec3 base = 0.5 + 0.5 * cos(6.28318 * (vec3(1.0, 0.7, 0.4) * t + vec3(0.0, 0.15, 0.25)));
                        col = base * dif;
                        
                    } else if (hit.y == 2.0) {
                        // Structural Color Film
                        float thickness = 1.0 + fbm(p * 5.0) * 2.0;
                        col = thinFilm(cosTheta, thickness);
                        
                        // Foxfire Bioluminescence (520nm peak)
                        float rim = pow(1.0 - cosTheta, 4.0);
                        col += vec3(0.02, 0.95, 0.48) * rim * 1.2; 
                    }
                    
                    // The Ship: Dense Fog Obscuration
                    float fogDensity = mix(0.03, 0.12, u_isPressed);
                    col = mix(col, vec3(0.05, 0.01, 0.08), 1.0 - exp(-fogDensity * dO * dO));
                } else {
                    col = vec3(0.02, 0.01, 0.03); // The Void Rule
                }
                
                col += vec3(0.8, 0.2, 0.9) * glow; 
                
                // VHS Chroma Bleed
                float bleed = hash(vUv.y + u_time) * 0.04;
                col.r += bleed * (1.0 + glow);
                col.b -= bleed;
                
                // CRT Scanlines
                float scanline = sin(vUv.y * u_resolution.y * 1.5) * 0.05;
                col -= scanline;
                
                // Sensor Noise
                col += (hash(vUv + u_time) - 0.5) * 0.08;
                
                // Vignette
                vec2 c = vUv - 0.5;
                col *= 1.0 - dot(c, c) * 1.2;
                
                // Tone mapping
                col = col / (1.0 + col);
                col = pow(col, vec3(1.0 / 2.2));
                
                fragColor = vec4(col, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_isPressed: { value: 0.0 }
            },
            vertexShader,
            fragmentShader
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    }
    
    const { renderer, scene, camera, material } = canvas.__three;
    
    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        
        if (!canvas.__targetMouse) canvas.__targetMouse = new THREE.Vector2(0.5, 0.5);
        canvas.__targetMouse.set(mouse.x / grid.width, mouse.y / grid.height);
        material.uniforms.u_mouse.value.lerp(canvas.__targetMouse, 0.08);
        
        material.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
    }
    
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
    
} catch (e) {
    console.error("The Bioluminescent Mycelial Ocean failed to initialize:", e);
}