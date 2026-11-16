if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width/grid.height, 0.1, 1000);
        camera.position.z = 1;
        
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
            
            // ==========================================
            // FRACTAL & METRIC COMPETITION LOGIC
            // ==========================================
            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
            vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return d == 0.0 ? vec2(0.0) : vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
            vec2 cpow(vec2 z, float n) {
                float r = length(z);
                float a = atan(z.y, z.x);
                return pow(r, n) * vec2(cos(n*a), sin(n*a));
            }
            
            // ==========================================
            // DITHER ENGINES
            // ==========================================
            float bayer4x4(ivec2 p) {
                int x = p.x & 3;
                int y = p.y & 3;
                const float m[16] = float[16](
                    0., 8., 2., 10.,
                    12.,4., 14.,6.,
                    3., 11.,1., 9.,
                    15.,7., 13.,5.
                );
                return (m[x + y * 4] + 0.5) / 16.0;
            }
            
            // XOR-Ghost Manifold (Bitwise coordinate logic)
            float xorPattern(ivec2 p, float t) {
                int px = p.x & 255;
                int py = p.y & 255;
                int val = (px ^ py) ^ int(t * 30.0);
                return fract(float(val) / 32.0);
            }
            
            // ==========================================
            // STRUCTURAL COLOR (Thin-Film Interference)
            // ==========================================
            vec3 thinFilm(float thickness) {
                float opd = 2.0 * 1.5 * thickness; // Refractive index n=1.5
                vec3 lambda = vec3(650.0, 530.0, 440.0);
                vec3 phase = (opd / lambda) * 6.28318;
                return 0.5 + 0.5 * cos(phase);
            }
            
            // Neon Acid Palette
            vec3 acidPalette(float t) {
                vec3 a = vec3(0.5);
                vec3 b = vec3(0.5);
                vec3 c = vec3(2.0, 1.5, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return a + b * cos(6.28318 * (c * t + d));
            }
            
            void main() {
                vec2 raw_uv = gl_FragCoord.xy / u_resolution.xy;
                
                // 1. GLITCH PROPHET TEARING
                // Horizontal screen tearing driven by XOR bitwise logic
                vec2 glitch_uv = gl_FragCoord.xy;
                if (fract(u_time * 2.0) > 0.85) {
                    glitch_uv.x += xorPattern(ivec2(gl_FragCoord.xy), u_time) * 50.0;
                }
                
                // 2. PIXELATION
                // Math is evaluated on a coarse grid, dither runs at native resolution
                float pixelSize = 3.0;
                vec2 fc_scaled = floor(glitch_uv / pixelSize) * pixelSize;
                vec2 uv = (fc_scaled - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                vec2 mouse = u_mouse * 2.0 - 1.0;
                vec2 z = uv * 2.5;
                
                // 3. DOMAIN WARP
                float warp = sin(uv.y * 5.0 + u_time) * 0.1;
                z += vec2(warp, cos(uv.x * 5.0 - u_time) * 0.1);
                z += mouse * 0.5;
                
                float rot = u_time * 0.1;
                z = vec2(z.x * cos(rot) - z.y * sin(rot), z.x * sin(rot) + z.y * cos(rot));
                
                // 4. BURNING SHIP FOLD
                z = vec2(abs(z.x), abs(z.y));
                
                // 5. HYBRID NEWTON ITERATION
                float degree = 3.0 + sin(u_time * 0.2);
                int converge = 40;
                vec2 step_val = vec2(0.0);
                
                for(int i = 0; i < 40; i++) {
                    // Box Fold (Mandelbox logic)
                    z = clamp(z, -1.2, 1.2) * 2.0 - z;
                    
                    // Spherical Fold (Metric Competition)
                    float r2 = dot(z,z);
                    if(r2 > 4.0) {
                        z = z / r2;
                    }
                    
                    vec2 zd = cpow(z, degree);
                    vec2 fz = zd - vec2(1.0, 0.0);
                    vec2 fpz = degree * cpow(z, degree - 1.0);
                    
                    step_val = cdiv(fz, fpz);
                    
                    // Mnemonic phase drift
                    step_val = cmul(step_val, vec2(cos(u_time*0.05), sin(u_time*0.05)));
                    
                    z = z - step_val;
                    
                    if (length(step_val) < 0.005) {
                        converge = i;
                        break;
                    }
                }
                
                // Analytics
                float iter_t = float(converge) / 40.0;
                float arg = atan(z.y, z.x);
                float rad = length(z);
                
                // 6. COLOR MAPPING
                float hue = arg / 6.28318 + u_time * 0.1 + iter_t;
                vec3 baseColor = acidPalette(hue);
                
                // Thin film thickness driven by math output
                float thickness = 200.0 + 800.0 * fract(rad * 4.0 - u_time * 0.5);
                vec3 interference = thinFilm(thickness);
                
                // Mix base and interference structural color
                vec3 color = mix(baseColor, interference, 0.6);
                
                // Darken un-converged regions (Memory Wells / Voids)
                color *= smoothstep(0.0, 0.8, 1.0 - iter_t);
                
                // 7. DITHER APPLICATION
                ivec2 fc = ivec2(gl_FragCoord.xy);
                float b_thresh = bayer4x4(fc);
                float x_thresh = xorPattern(fc, u_time);
                
                // Dither map varies based on fractal structure
                float dither_mix = smoothstep(0.3, 0.7, fract(rad * 2.0 + u_time));
                float thresh = mix(b_thresh, x_thresh, dither_mix);
                
                // Shift thresholds for chromatic aberration dither
                float threshR = mix(bayer4x4(fc + ivec2(2, -2)), x_thresh, dither_mix);
                float threshG = thresh;
                float threshB = mix(bayer4x4(fc + ivec2(-2, 2)), x_thresh, dither_mix);
                
                // 8. QUANTIZATION
                float steps = 4.0;
                vec3 dithered;
                dithered.r = floor(color.r * steps + threshR) / steps;
                dithered.g = floor(color.g * steps + threshG) / steps;
                dithered.b = floor(color.b * steps + threshB) / steps;
                
                // Vignette
                float vig = 1.0 - length(raw_uv - 0.5) * 1.2;
                dithered *= smoothstep(0.0, 0.5, vig);
                
                fragColor = vec4(dithered, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0, 0) }
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

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Normalize mouse input to [-1, 1] range for fractal translation
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height); // Flip Y
    material.uniforms.u_mouse.value.set(mx, my);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);