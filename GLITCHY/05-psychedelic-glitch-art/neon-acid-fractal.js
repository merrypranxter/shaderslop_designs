try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1.0);
        
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
            precision highp float;
            in vec2 vUv;
            out vec4 fragColor;
            uniform float u_time;
            uniform vec2 u_resolution;

            // [THE-LISTS / Domain 8: Digital Folklore] - Glitch & Data Rot
            float hash1(float n) { return fract(sin(n) * 43758.5453123); }
            vec2 hash2(vec2 p) {
                p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
                return -1.0 + 2.0*fract(sin(p)*43758.5453123);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                vec2 u = f*f*(3.0-2.0*f);
                return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)),
                               dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x),
                           mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)),
                               dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);
            }
            
            float fbm(vec2 p) {
                float f = 0.0; float a = 0.5;
                for(int i=0; i<5; i++) { f += a*noise(p); p*=2.01; a*=0.5; }
                return f;
            }

            // [color_fields / neon_acid] - Psychedelic Pop Candy Groovy Palette
            vec3 acidPalette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.33);
                vec3 c = vec3(2.0, 1.0, 1.0);
                vec3 d = vec3(0.50, 0.20, 0.25);
                vec3 col = a + b * cos(6.28318 * (c * t + d));
                // Overclock the saturation for acidic burn
                return clamp(col * 1.5 - 0.15, 0.0, 1.0);
            }

            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*a.x - a.y*a.y, 2.0*a.x*a.y); }

            void main() {
                vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                // [THE-LISTS / Glitch] - Frame dropping & spatial tearing
                float glitch = step(0.99, hash1(u_time * 5.0 + uv.y * 10.0));
                uv.x += glitch * 0.1 * sin(u_time * 50.0);

                // [mycelial_networks / enzymatic_patterns] - Hyphal substrate warp
                float hypha_warp = fbm(uv * 2.0 + u_time * 0.15);
                vec2 c = uv * 2.5 + vec2(-0.5, 0.0);
                
                // [psychedelic_pop_style / curvilinear motion] - Flowing coordinate space
                c += vec2(sin(c.y * 3.0 + u_time), cos(c.x * 3.0 - u_time)) * 0.15 * hypha_warp;

                vec2 z = c;
                float iter = 0.0;
                float max_iter = 128.0;
                float trap = 1e10;
                float digested = 0.0;
                
                vec2 dz = vec2(1.0, 0.0);

                for(int i = 0; i < 128; i++) {
                    // [mycelial_networks / anastomosis] - Fungal Digestion
                    // The deterministic fractal math is interrupted if the local enzymatic concentration is too high
                    float enzyme = fbm(z * 3.0 - u_time * 0.4);
                    if (enzyme > 0.85 && length(z) < 2.0) {
                        digested = 1.0;
                        iter = float(i);
                        break;
                    }

                    // Distance estimator derivative tracking
                    dz = 2.0 * cmul(z, dz) + vec2(1.0, 0.0);
                    
                    z = cmul(z, z) + c;
                    
                    // [psychedelic_pop_style / eyes] - Orbit trap looking for "eyes" in the void
                    float eye_dist = abs(length(z - vec2(0.5, 0.0)) - 0.5);
                    trap = min(trap, eye_dist);

                    if(dot(z,z) > 256.0) {
                        float log_zn = log(dot(z,z)) * 0.5;
                        float nu = log(log_zn / 0.693147) / 0.693147;
                        iter = float(i) + 1.0 - nu;
                        break;
                    }
                }

                vec3 color = vec3(0.0);

                if (digested > 0.5) {
                    // [mycelial_networks / laccase_stain] - Toxic fungal takeover
                    float stain = fract(iter * 0.1 - u_time * 2.0);
                    color = mix(vec3(0.8, 1.0, 0.0), vec3(1.0, 0.0, 1.0), stain);
                } else if (iter < max_iter) {
                    // [psychedelic_pop_style / fill-and-flatness-rules] - Flat graphic bands
                    float bands = 8.0;
                    float quantized_iter = floor(iter * 0.3 * bands) / bands;
                    
                    color = acidPalette(quantized_iter * 0.3 - u_time * 0.2);
                    
                    // [structural_color / thin-film] - Edge iridescence
                    float de = sqrt(dot(z,z)/dot(dz,dz)) * log(dot(z,z)) * 0.5;
                    float rim = smoothstep(0.01, 0.0, de);
                    color = mix(color, vec3(0.0, 1.0, 1.0), rim); // Cyan outlines
                    
                } else {
                    // Interior: The Void / The Host
                    float eye_ring = smoothstep(0.05, 0.06, trap) - smoothstep(0.1, 0.11, trap);
                    float pupil = 1.0 - smoothstep(0.01, 0.02, trap);
                    
                    color = vec3(0.05, 0.0, 0.1); 
                    color = mix(color, vec3(1.0, 0.2, 0.6), eye_ring); 
                    color = mix(color, vec3(0.0, 1.0, 1.0), pupil); 
                    
                    // [retrofuturism / Vaporwave] - Structural Grid
                    float gridX = step(0.95, fract(uv.x * 30.0 + u_time));
                    float gridY = step(0.95, fract(uv.y * 30.0 - u_time));
                    color += max(gridX, gridY) * vec3(0.5, 0.0, 1.0) * 0.3;
                }

                // Add film grain / digital silt
                color += (hash1(uv.x * 133.0 + uv.y * 311.0 + u_time) - 0.5) * 0.15;
                
                fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: vertexShader,
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
    console.error("Feral WebGL Architecture Failure:", e);
}