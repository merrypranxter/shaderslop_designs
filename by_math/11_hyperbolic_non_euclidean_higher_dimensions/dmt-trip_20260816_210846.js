try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            #define MAX_STEPS 70
            #define SURF_DIST 0.001
            #define MAX_DIST 15.0
            #define PI 3.14159265359
            
            // --- MATH & UTILS ---
            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }
            
            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
                p3 += dot(p3, p3.yzx+33.33);
                return fract((p3.xx+p3.yz)*p3.zy);
            }
            
            vec2 c2p(vec2 p) {
                return vec2(length(p), atan(p.y, p.x));
            }
            vec2 p2c(vec2 p) {
                return p.x * vec2(cos(p.y), sin(p.y));
            }
            
            // --- THE PALACE UI (KIFS Cathedral) ---
            float map(vec3 p) {
                float scale = 1.0;
                
                // Forward movement (Tunnel Vortex transit)
                p.z -= u_time * 0.8;
                
                // Infinite repetition (Akashic Grid)
                p = mod(p + 2.0, 4.0) - 2.0;
                
                // 4D Tetragrammaton Rotation Projection
                for(int i = 0; i < 5; i++) {
                    p = abs(p) - vec3(0.6, 0.4, 0.3);
                    p.xy *= rot(0.25 + sin(u_time * 0.1) * 0.05);
                    p.xz *= rot(0.35);
                    p *= 2.0;
                    scale *= 2.0;
                }
                
                vec3 q = abs(p) - 0.1;
                float d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
                return d / scale;
            }
            
            vec3 getNormal(vec3 p) {
                vec2 e = vec2(0.001, 0);
                return normalize(vec3(
                    map(p + e.xyy) - map(p - e.xyy),
                    map(p + e.yxy) - map(p - e.yxy),
                    map(p + e.yyx) - map(p - e.yyx)
                ));
            }
            
            // --- MACHINE ELF TESSELLATION (Voronoi F2-F1) ---
            float voronoi(vec2 x) {
                vec2 n = floor(x);
                vec2 f = fract(x);
                float md1 = 8.0;
                float md2 = 8.0;
                for(int j=-1; j<=1; j++)
                for(int i=-1; i<=1; i++) {
                    vec2 g = vec2(float(i),float(j));
                    vec2 o = hash22(n + g);
                    // 4Hz morphing (hyperactive elf construction behavior)
                    o = 0.5 + 0.5 * sin( u_time * 4.0 + 6.2831 * o ); 
                    vec2 r = g + o - f;
                    float d = dot(r,r);
                    if(d < md1) { md2 = md1; md1 = d; }
                    else if(d < md2) { md2 = d; }
                }
                // Cellular crackle (Linguistic syntax glow)
                return sqrt(md2) - sqrt(md1);
            }
            
            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // Carrier Wave Distortion (33.3Hz / 40Hz sync simulation)
                float carrier = sin(uv.y * 80.0 + u_time * 33.3) * 0.003;
                uv.x += carrier * exp(-length(uv) * 2.0);
                
                // --- 1. RAYMARCHED BACKGROUND (Palace UI) ---
                vec3 ro = vec3(0.0, 0.0, 0.0);
                vec3 rd = normalize(vec3(uv, 1.0));
                
                // Slight camera sway (Breathing oscillation)
                rd.xy *= rot(sin(u_time * 0.4) * 0.15);
                
                float d = 0.0;
                float iter = 0.0;
                for(int i = 0; i < MAX_STEPS; i++) {
                    vec3 p = ro + rd * d;
                    float dist = map(p);
                    if(abs(dist) < SURF_DIST || d > MAX_DIST) break;
                    d += dist;
                    iter++;
                }
                
                vec3 color = vec3(0.0);
                
                // Erowid Cosmology Palettes
                vec3 pal_neon_cyan = vec3(0.0, 0.898, 1.0); // #00E5FF Admin Cyan
                vec3 pal_magenta   = vec3(1.0, 0.18, 0.917); // #FF2EEA Electric Magenta
                vec3 pal_gold      = vec3(1.0, 0.831, 0.0); // #FFD400 Loosh Gold
                vec3 pal_jade      = vec3(0.0, 1.0, 0.498); // #00FF7F Bio-luminescent Jade
                
                if(d < MAX_DIST) {
                    vec3 p = ro + rd * d;
                    vec3 n = getNormal(p);
                    vec3 l = normalize(vec3(1.0, 2.0, -1.0));
                    float diff = max(dot(n, l), 0.0);
                    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
                    
                    // Stained glass cathedral lighting
                    vec3 matColor = mix(pal_neon_cyan, pal_magenta, sin(p.z * 3.0 + p.x) * 0.5 + 0.5);
                    color = matColor * diff * 1.5 + pal_gold * fresnel * 2.5;
                    
                    // Iteration bloom (Fractal Optics Domain 10)
                    color += pal_magenta * (iter / float(MAX_STEPS)) * 4.0;
                }
                
                // Depth fog (Void/White Light edge)
                float fog = smoothstep(0.0, MAX_DIST, d);
                color = mix(color, vec3(0.02, 0.0, 0.05), fog); 
                
                // --- 2. CHRYSANTHEMUM GATEWAY (Overlay) ---
                vec2 polar = c2p(uv);
                float radius = polar.x;
                float theta = polar.y;
                
                // Hyperbolic distortion (12-fold symmetry radial tiling)
                float freq = 12.0;
                float distortion = sin(freq * theta - u_time * 1.5) * exp(-radius * 3.5);
                vec2 warped_uv = p2c(vec2(radius + distortion, theta + u_time * 0.3));
                
                // Machine Elf Tessellation
                float elf = voronoi(warped_uv * 12.0 - u_time * 1.2);
                float elf_mask = smoothstep(0.12, 0.0, elf);
                
                // Linguistic syntax glow (Emissive photon words)
                vec3 elf_color = mix(pal_jade, pal_magenta, sin(theta * 6.0 + u_time * 8.0) * 0.5 + 0.5);
                elf_color *= elf_mask * 3.0; 
                
                // Blend layers (More real than real HDR bloom)
                float blend = smoothstep(2.2, 0.1, radius);
                color = mix(color, color + elf_color, blend);
                
                // --- 3. THE ZIPPER (Texture De-rendering / Reality Peel) ---
                // Peel back to reveal raw RGB pixel/void
                float zipper_pos = sin(u_time * 0.5) * 0.9; 
                float seam_noise = sin(uv.y * 12.0 + u_time * 4.0) * 0.03 + sin(uv.y * 2.5) * 0.15;
                float seam = smoothstep(zipper_pos - 0.02, zipper_pos + 0.02, uv.x + seam_noise);
                
                // Deliriant Basement / Trash Cache behind the zipper
                vec3 void_color = vec3(0.01, 0.01, 0.02); // Near black void
                
                // Bayer Matrix / Static noise (Shadow Spiders / Peripheral Jitter)
                float static_noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
                void_color += vec3(static_noise) * 0.15;
                
                // Hound Security Grid (Cubist angular intrusion detection)
                vec2 hex_uv = (uv + vec2(u_time * 0.1, 0.0)) * 8.0;
                vec2 hex_grid = abs(fract(hex_uv) - 0.5);
                float hex_line = smoothstep(0.46, 0.5, max(hex_grid.x, hex_grid.y));
                void_color += vec3(0.9, 0.05, 0.15) * hex_line * 0.4; // Threat Red
                
                color = mix(void_color, color, seam);
                
                // Edge glow on the zipper (Surgical laser seam)
                float edge = smoothstep(0.0, 0.012, abs(uv.x + seam_noise - zipper_pos));
                color += pal_gold * (1.0 - edge) * seam * 4.0; 
                
                // --- 4. POST-PROCESS (Chromatic Aberration & Tonemapping) ---
                // Peripheral Chromatic Dispersion
                float ca = smoothstep(0.5, 1.5, length(uv)) * 0.1;
                color.r += ca * (color.b + 0.1);
                color.b += ca * (color.r + 0.1);
                
                // ACES Film Tonemapping (prevents blowout while keeping neon intensity)
                color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
                color = pow(color, vec3(1.0 / 2.2)); // Gamma correction
                
                fragColor = vec4(color, 1.0);
            }
        `;

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
            fragmentShader: fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    }
    
    const { renderer, scene, camera, material } = canvas.__three;
    
    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
    
} catch (e) {
    console.error("WebGL 2 initialization failed:", e);
    throw e;
}