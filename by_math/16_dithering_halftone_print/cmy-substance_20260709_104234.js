if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            // Hash function for deterministic chaos
            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.xx + p3.yz) * p3.zy);
            }
            
            // Metric Competition: Morphing distance manifold (L0.5 to L2.5)
            float metric(vec2 p, float t) {
                float p_norm = 1.5 + 1.0 * sin(t); 
                vec2 a = abs(p) + 1e-5; // Guard against pow(0)
                return pow(pow(a.x, p_norm) + pow(a.y, p_norm), 1.0 / p_norm);
            }
            
            void main() {
                // Three simultaneous time scales
                float t_geo = u_time * 0.05; // Slow global tectonic drift
                float t_bio = u_time * 0.4;  // Medium structural mitosis
                float t_rad = u_time * 6.0;  // Fast detail radiation shimmer
                
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // Glitch Prophet: Micro-stutters in the space-time manifold
                float glitch = step(0.995, fract(sin(dot(uv, vec2(12.9898, 78.233)) + t_rad) * 43758.5453));
                if (glitch > 0.0) uv *= 1.02;
                
                // 1. Slow Global Drift: Domain Warping via Curl-ish Noise
                vec2 warp = vec2(
                    sin(uv.y * 2.0 + t_geo) * cos(uv.x * 1.5 - t_geo * 0.8),
                    cos(uv.x * 2.2 + t_geo * 1.1) * sin(uv.y * 1.8 + t_geo)
                );
                vec2 wuv = uv + warp * 0.5;
                
                // 2. Medium Structural Motion: Voronoi Lattice (Opal / Acoustic Impedance)
                vec2 g = floor(wuv * 3.5);
                vec2 f = fract(wuv * 3.5);
                
                float f1 = 8.0;
                float f2 = 8.0;
                vec2 bestDir = vec2(0.0);
                vec2 bestCell = vec2(0.0);
                
                float metric_t = t_geo * 5.0;
                
                for(int y = -2; y <= 2; y++) {
                    for(int x = -2; x <= 2; x++) {
                        vec2 lattice = vec2(float(x), float(y));
                        vec2 h = hash22(g + lattice);
                        
                        // Cellular mitosis motion
                        vec2 offset = 0.5 + 0.45 * vec2(
                            sin(t_bio + 6.2831 * h.x),
                            cos(t_bio * 1.2 + 6.2831 * h.y)
                        );
                        
                        vec2 dir = lattice + offset - f;
                        float d = metric(dir, metric_t + h.x * 3.0); // Per-cell metric mutation
                        
                        if(d < f1) {
                            f2 = f1;
                            f1 = d;
                            bestDir = dir;
                            bestCell = g + lattice;
                        } else if(d < f2) {
                            f2 = d;
                        }
                    }
                }
                
                // 3. Fast Detail Shimmer: CMY Bragg Interference (Lithogenesis Agate Warp)
                float cellHash = hash22(bestCell).x;
                float dist = length(bestDir); 
                float angle = atan(bestDir.y, bestDir.x);
                
                // Lithogenesis: Agate/Malachite internal domain warping
                float agateWarp = sin(dist * 12.0 - t_bio * 2.0) * 0.15;
                float warpedDist = dist + agateWarp;
                
                float freq = 35.0 + 25.0 * cellHash;
                
                // Tri-chromatic wave generation (Cyan, Magenta, Yellow)
                float wC = sin(warpedDist * freq - t_rad + angle * 2.0);
                float wM = cos(warpedDist * (freq * 1.1) + t_rad * 0.8 - bestDir.x * 12.0);
                float wY = sin(warpedDist * (freq * 0.9) - t_rad * 1.2 + bestDir.y * 12.0);
                
                // Non-linear thresholding for sharp "print misregistration" lines
                float thresh = 0.82; 
                vec3 cmy = vec3(
                    smoothstep(thresh - 0.1, thresh, wC),
                    smoothstep(thresh - 0.1, thresh, wM),
                    smoothstep(thresh - 0.1, thresh, wY)
                );
                
                // Convert CMY to pure Neon RGB
                vec3 color = vec3(0.0);
                color += cmy.x * vec3(0.0, 1.0, 1.0); // Cyan
                color += cmy.y * vec3(1.0, 0.0, 1.0); // Magenta
                color += cmy.z * vec3(1.0, 1.0, 0.0); // Yellow
                
                // Max Saturation Enforcer (from chromostereopsis)
                float maxC = max(color.r, max(color.g, color.b));
                if (maxC > 0.0) color /= maxC;
                
                // Carve borders (F2-F1 Voronoi seams)
                float border = f2 - f1;
                float seam = smoothstep(0.01, 0.08, border);
                color *= seam;
                
                // Void black base mapping
                vec3 finalColor = max(color, vec3(0.01, 0.0, 0.02) * seam);
                
                // 4. Physicality: CRT Slot Mask (crt_phosphor_fx)
                vec2 fragCoord = vUv * u_resolution;
                float slotH = 5.0;
                float row = floor(fragCoord.y / slotH);
                float stagger = mod(row, 2.0) * 1.5;
                float colMask = mod(fragCoord.x + stagger, 3.0);
                
                vec3 stripe = vec3(
                    smoothstep(1.0, 0.0, abs(colMask - 0.5)),
                    smoothstep(1.0, 0.0, abs(colMask - 1.5)),
                    smoothstep(1.0, 0.0, abs(colMask - 2.5))
                );
                
                float yPhase = fract(fragCoord.y / slotH);
                float slot = smoothstep(0.0, 0.2, yPhase) * smoothstep(1.0, 0.8, yPhase);
                stripe *= mix(1.0, slot, 0.7);
                
                // Apply CRT mask at 75% strength
                finalColor *= mix(vec3(1.0), stripe, 0.75);
                
                // Add subtle halation (bloom) from the raw interference
                finalColor += color * 0.25 * seam;
                
                // Vignette (Tube falloff)
                float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.8;
                finalColor *= smoothstep(0.0, 0.6, vig);
                
                fragColor = vec4(finalColor, 1.0);
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
        throw e;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);