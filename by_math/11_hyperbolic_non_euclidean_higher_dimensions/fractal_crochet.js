const initWebGL = () => {
    if (!canvas.__three) {
        try {
            if (!ctx) throw new Error("WebGL 2 context not available");
            
            const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
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

                // 2D Rotation Matrix
                mat2 rot(float a) {
                    float s = sin(a), c = cos(a);
                    return mat2(c, -s, s, c);
                }

                // Psychedelic Neon Acid / Oklab inspired Cosine Palette
                vec3 palette(float t) {
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.5);
                    vec3 c = vec3(2.0, 1.0, 1.0);
                    vec3 d = vec3(0.50, 0.20, 0.25);
                    return a + b * cos(6.2831853 * (c * t + d));
                }

                // Mathematical Crochet & Fractal Lace SDF
                float map(vec3 p) {
                    // Hyperbolic Plane Warp (Pseudosphere projection)
                    float r = length(p.xy);
                    float a = atan(p.y, p.x);
                    
                    // Exponential ruffling (Hyperbolic Crochet / Coral Math)
                    a += sin(r * 5.0 - u_time * 0.5) * 0.15; 
                    p.xy = r * vec2(cos(a), sin(a));

                    // Confine to a 2D slab to create the "fabric"
                    float slab = abs(p.z) - 0.08 + (sin(p.x * 10.0) * cos(p.y * 10.0)) * 0.01;

                    // 3D Apollonian Gasket / Kaleidoscopic IFS for the Lace Network
                    vec3 q = p * 1.5;
                    q.xy *= rot(u_time * 0.1);
                    
                    float scale = 1.0;
                    for(int i = 0; i < 7; i++) {
                        // Modulo folding (Periodic Mesh Ground)
                        q = -1.0 + 2.0 * fract(0.5 * q + 0.5);
                        
                        float r2 = dot(q, q);
                        // Spherical inversion (creates the fractal voids)
                        float k = 1.25 / max(r2, 0.05);
                        q *= k;
                        scale *= k;
                        
                        // Chiral twist
                        q.xy *= rot(0.2);
                        q.yz *= rot(0.15);
                    }
                    
                    // Tubular network
                    float fractal = (length(q.xy) - 0.2) / scale;
                    
                    // Boucle / Yarn Fuzz Microstructure (Textile Surface FX)
                    float yarn = sin(p.x * 200.0) * sin(p.y * 200.0) * sin(p.z * 200.0) * 0.0015;
                    
                    // Intersection of slab and fractal network creates the lace fabric
                    return max(slab, fractal) + yarn;
                }

                // Normal estimation
                vec3 calcNormal(vec3 p) {
                    vec2 e = vec2(0.001, 0.0);
                    return normalize(vec3(
                        map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)
                    ));
                }

                void main() {
                    // Resolution normalized UVs
                    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
                    
                    // Ray setup
                    vec3 ro = vec3(0.0, 0.0, 1.2);
                    vec3 rd = normalize(vec3(uv, -1.0));
                    
                    // Pan & tilt camera slightly
                    ro.xy += vec2(sin(u_time * 0.2), cos(u_time * 0.15)) * 0.2;
                    rd.xy *= rot(sin(u_time * 0.1) * 0.1);
                    
                    // Raymarching
                    float t = 0.0;
                    float d = 0.0;
                    vec3 p;
                    int i;
                    for(i = 0; i < 150; i++) {
                        p = ro + rd * t;
                        d = map(p);
                        if(d < 0.0005 || t > 3.0) break;
                        t += d;
                    }

                    // Cosmic Void Background
                    vec3 col = vec3(0.02, 0.0, 0.05); 

                    // Surface hit
                    if(d < 0.001) {
                        vec3 n = calcNormal(p);
                        vec3 v = -rd;
                        
                        // Lighting
                        vec3 l1 = normalize(vec3(1.0, 1.0, 1.0));
                        vec3 l2 = normalize(vec3(-1.0, -1.0, 0.5));
                        
                        float dif1 = max(0.0, dot(n, l1));
                        float dif2 = max(0.0, dot(n, l2));
                        float viewAngle = max(0.0, dot(n, v));
                        
                        // Structural Color / Thin-Film Interference (Repo 7)
                        // Iridescence based on viewing angle and spatial frequency
                        vec3 iridescence = palette(viewAngle * 3.0 + u_time * 0.25 + length(p.xy) * 2.0);
                        
                        // Velvet Anisotropic BRDF (Repo 4)
                        float velvet = pow(1.0 - viewAngle, 3.5);
                        
                        // Base Yarn Color (Psychedelic Math)
                        vec3 baseCol = palette(length(p.xy) * 0.8 - u_time * 0.15);
                        
                        // Combine lighting and material properties
                        col = baseCol * (dif1 * 0.6 + dif2 * 0.3 + 0.15);
                        col += iridescence * velvet * 1.2; // Shimmering edges
                        col += vec3(1.0) * pow(dif1, 32.0) * 0.4; // Specular glints
                        
                        // Ambient Occlusion from raymarching steps
                        float ao = clamp(1.0 - float(i) / 150.0, 0.0, 1.0);
                        col *= ao * ao * 1.5;
                        
                        // Depth fog (Deep Ocean Palette transition)
                        col = mix(col, vec3(0.02, 0.0, 0.05), smoothstep(0.8, 2.5, t));
                    }
                    
                    // Post-Processing
                    col = pow(col, vec3(0.85)); // Gamma correction
                    col *= 1.0 - dot(uv, uv) * 0.5; // Vignette
                    
                    // Add subtle film grain
                    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
                    col += (grain - 0.5) * 0.04;
                    
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
};

initWebGL();

if (canvas.__three) {
    const { renderer, scene, camera, material } = canvas.__three;
    
    if (material && material.uniforms) {
        if (material.uniforms.u_time) material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
        }
    }
    
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
}