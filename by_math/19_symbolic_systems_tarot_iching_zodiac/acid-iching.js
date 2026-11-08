// THE WEIRD CODE GUY - KIYOSHI-ABSORBER-V1 MODULE
// [ALCHEMICAL SCRIPTURE W-10]: XOR-Ghost Manifold applied to Fungal Bureaucracy
// 
// DIRECTIVE: Procedural Material. No character grids.
// MECHANISM: I-Ching FBM. The 64 hexagrams are not symbols; they are 6-dimensional 
// spatial frequencies evaluating at every pixel to create a topographic, gummy, 
// iridescent "candy" resin. Moving lines (transitions) trigger photon starvation
// and holographic thin-film interference.

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available. The wet engine requires hardware acceleration.");
        
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

            // [LITHOGENESIS MODULE]: 3D Simplex Noise for organic base
            vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
            vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
            float snoise(vec3 v){ 
                const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
                vec3 i  = floor(v + dot(v, C.yyy) );
                vec3 x0 = v - i + dot(i, C.xxx) ;
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min( g.xyz, l.zxy );
                vec3 i2 = max( g.xyz, l.zxy );
                vec3 x1 = x0 - i1 + 1.0 * C.xxx;
                vec3 x2 = x0 - i2 + 2.0 * C.xxx;
                vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
                i = mod(i, 289.0 ); 
                vec4 p = permute( permute( permute( 
                           i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                         + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                         + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                float n_ = 1.0/7.0;
                vec3  ns = n_ * D.wyz - D.xzx;
                vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_ );
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                vec4 b0 = vec4( x.xy, y.xy );
                vec4 b1 = vec4( x.zw, y.zw );
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
                vec3 p0 = vec3(a0.xy,h.x);
                vec3 p1 = vec3(a0.zw,h.y);
                vec3 p2 = vec3(a1.xy,h.z);
                vec3 p3 = vec3(a1.zw,h.w);
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                              dot(p2,x2), dot(p3,x3) ) );
            }

            // [ACIDIC CANDY POP PALETTE]
            // Extracts raw neon values mapped to the 64 hexagram states
            vec3 getAcidCandyColor(float hex_norm) {
                // Base Cosine Palette (Neon Acid)
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.3, 0.2, 0.8);
                vec3 col = a + b * cos(6.28318 * (c * hex_norm + d));
                
                // Inject extreme acidic colors based on specific hexagram resonance frequencies
                float pink_mask = smoothstep(0.85, 1.0, sin(hex_norm * 3.14159 * 4.0));
                col = mix(col, vec3(1.0, 0.08, 0.58), pink_mask); // Hot Pink
                
                float lime_mask = smoothstep(0.85, 1.0, sin(hex_norm * 3.14159 * 7.0 + 1.0));
                col = mix(col, vec3(0.74, 0.95, 0.05), lime_mask); // Toxic Lime
                
                float cyan_mask = smoothstep(0.85, 1.0, sin(hex_norm * 3.14159 * 5.0 + 2.0));
                col = mix(col, vec3(0.05, 0.95, 0.86), cyan_mask); // Electric Cyan
                
                float yellow_mask = smoothstep(0.85, 1.0, sin(hex_norm * 3.14159 * 3.0 + 3.0));
                col = mix(col, vec3(0.95, 0.95, 0.05), yellow_mask); // Sour Yellow
                
                return col;
            }

            // [FUNGAL BUREAUCRACY MODULE]
            // Evaluates the 6 bits of an I-Ching hexagram at a spatial coordinate,
            // returning the physical height, the hexagram ID (0-63), and the "changing line" intensity.
            void evaluateHexagramField(vec2 p, out float height, out float hex_id, out float changing) {
                vec2 q = p;
                height = 0.0;
                hex_id = 0.0;
                changing = 0.0;
                
                float amp = 1.0;
                float freq = 1.0;
                
                for(int i = 0; i < 6; i++) {
                    // Evaluate Yao (line) state
                    float n = snoise(vec3(q * freq, u_time * 0.15 + float(i) * 11.3));
                    
                    // Bureaucratic Quantization: blend organic fluid with stepped terraces
                    float terraced = mix(n, floor(n * 3.0 + 0.5) / 3.0, 0.6);
                    height += terraced * amp;
                    
                    // Binary thresholding (Yin vs Yang)
                    float bit = smoothstep(-0.05, 0.05, n);
                    hex_id += bit * exp2(float(i));
                    
                    // Changing Lines (Old Yin 6 / Old Yang 9) occur when noise approaches threshold (0.0)
                    float c_line = smoothstep(0.3, 0.0, abs(n));
                    changing += c_line * exp2(float(i)) / 63.0;
                    
                    // [XOR-Ghost Manifold]: The current bit warps the spatial domain for the next bit
                    float warp_angle = bit * 3.14159265 + (mod(hex_id, 8.0) / 8.0) * 6.28318 + u_time * 0.1;
                    q += vec2(cos(warp_angle), sin(warp_angle)) * 0.25 * amp;
                    
                    freq *= 1.5;
                    amp *= 0.55;
                }
            }

            void main() {
                // Normalize and scale UV
                vec2 uv = (vUv - 0.5) * (u_resolution.xy / min(u_resolution.x, u_resolution.y)) * 3.0;
                
                // Drift
                uv += vec2(u_time * 0.05, u_time * 0.02);

                float h, hex_id, changing;
                evaluateHexagramField(uv, h, hex_id, changing);
                
                // [TENSOR BIAS]: Compute Sobel-like gradients for surface normals
                float eps = 0.01;
                float hX, tmp1, tmp2;
                evaluateHexagramField(uv + vec2(eps, 0.0), hX, tmp1, tmp2);
                float hY, tmp3, tmp4;
                evaluateHexagramField(uv + vec2(0.0, eps), hY, tmp3, tmp4);
                
                // Normal vector of the gummy surface
                vec3 N = normalize(vec3(h - hX, h - hY, eps * 3.0));
                vec3 V = vec3(0.0, 0.0, 1.0);
                
                // Dynamic environmental lighting
                vec3 L1 = normalize(vec3(sin(u_time * 0.5), cos(u_time * 0.5), 1.2));
                vec3 L2 = normalize(vec3(-cos(u_time * 0.3), sin(u_time * 0.3), 0.8));
                
                // Base Material Color mapped from the 6-bit Hexagram identity
                vec3 baseColor = getAcidCandyColor(hex_id / 63.0);
                
                // [PBR LIGHTING APPROXIMATION]
                float diff1 = max(dot(N, L1), 0.0);
                float diff2 = max(dot(N, L2), 0.0);
                
                vec3 H1 = normalize(L1 + V);
                vec3 H2 = normalize(L2 + V);
                
                // Glossy wet candy specular
                float spec1 = pow(max(dot(N, H1), 0.0), 64.0);
                float spec2 = pow(max(dot(N, H2), 0.0), 32.0);
                
                // [OPTICAL PHENOMENA]: Thin-film interference on changing lines
                float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
                vec3 interference = 0.5 + 0.5 * cos(6.28318 * (fresnel * 2.5 + changing * 4.0 + vec3(0.0, 0.33, 0.67)));
                
                // Combine Lighting
                vec3 color = baseColor * (diff1 * 0.7 + diff2 * 0.3 + 0.3); // Ambient + Diffuse
                color += (spec1 + spec2 * 0.5) * vec3(1.0); // Specular
                
                // Apply Holographic Iridescence where I-Ching lines are transitioning
                color = mix(color, interference * 1.5, fresnel * 0.7 + changing * 0.6);
                
                // [GLITCH PROPHET]: High-frequency stochastic sparkle on highly volatile nodes
                float sparkle_hash = fract(sin(dot(uv * 150.0, vec2(12.9898, 78.233))) * 43758.5453);
                float sparkle = smoothstep(0.92, 1.0, sparkle_hash) * changing;
                color += sparkle * vec3(1.0, 0.9, 1.0) * 3.0; 
                
                // Subsurface scattering glow in the valleys
                float valleys = smoothstep(0.4, -0.4, h);
                color += baseColor * valleys * 0.6;

                // Tonemapping (ACES-like soft curve) & Gamma
                color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
                color = pow(color, vec3(1.0 / 2.2));
                
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
            fragmentShader
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("Wet Engine Boot Failure:", e);
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