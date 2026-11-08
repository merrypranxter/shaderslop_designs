try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL2 context required for Feral Lithogenesis engine.");
        
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
            precision highp float;

            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;

            // Feral Math: Hash functions
            vec2 hash2(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
            }

            vec2 hash2p(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return fract(sin(p) * 43758.5453123);
            }

            // Continuous Gradient Noise
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                float a = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
                float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
                float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
                float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            // Slow Time: Domain Warping FBM (The Fungal Membrane)
            const mat2 m2 = mat2(0.8, -0.6, 0.6, 0.8);
            float fbm(vec2 p) {
                float f = 0.0;
                float amp = 0.5;
                for(int i = 0; i < 5; i++) {
                    f += amp * noise(p);
                    p = m2 * p * 2.0;
                    amp *= 0.5;
                }
                return f;
            }

            // Structural: Voronoi Edge Distance (The Bismuth Armor)
            vec3 voronoiEdge(vec2 x) {
                vec2 n = floor(x);
                vec2 f = fract(x);
                vec2 mg, mr;
                float md = 8.0;
                
                for(int j = -1; j <= 1; j++) {
                    for(int i = -1; i <= 1; i++) {
                        vec2 g = vec2(float(i), float(j));
                        vec2 o = hash2p(n + g);
                        // Medium Time: Cellular breathing
                        o = 0.5 + 0.5 * sin(u_time * 0.2 + 6.28318 * o);
                        vec2 r = g + o - f;
                        float d = dot(r, r);
                        if(d < md) { md = d; mr = r; mg = g; }
                    }
                }
                
                md = 8.0;
                for(int j = -2; j <= 2; j++) {
                    for(int i = -2; i <= 2; i++) {
                        vec2 g = mg + vec2(float(i), float(j));
                        vec2 o = hash2p(n + g);
                        o = 0.5 + 0.5 * sin(u_time * 0.2 + 6.28318 * o);
                        vec2 r = g + o - f;
                        if(dot(mr - r, mr - r) > 0.00001) {
                            md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
                        }
                    }
                }
                return vec3(md, mr);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * 4.0;

                // LAYER 1: Deep Morphogenesis Drift
                vec2 q = vec2(fbm(uv + u_time * 0.03), fbm(uv + vec2(5.2, 1.3) - u_time * 0.025));
                vec2 r_warp = vec2(fbm(uv + 3.0 * q + vec2(1.7, 9.2)), fbm(uv + 3.0 * q + vec2(8.3, 2.8)));
                float n_warp = fbm(uv + 4.0 * r_warp);

                // LAYER 2: Crystalline Mineralization
                vec3 vData = voronoiEdge(uv * 1.2 + r_warp * 0.6);
                float edge = vData.x;
                vec2 cellDir = vData.yz; 

                float crack = smoothstep(0.015, 0.08, edge);
                float facetLight = smoothstep(-0.5, 0.5, dot(cellDir, normalize(vec2(1.0, 1.0))));

                // Refract UVs inside the crystal cells to break the moiré
                vec2 moireUV = uv + cellDir * 0.15 + r_warp * 0.05;

                // LAYER 3: CMY Separation Moiré (The Print Ghost)
                // Offset angles to force chromatic beats (C=15°, M=75°, Y=0°)
                float aC = 0.2618;
                float aM = 1.3090;
                float aY = 0.0;

                mat2 rotC = mat2(cos(aC), -sin(aC), sin(aC), cos(aC));
                mat2 rotM = mat2(cos(aM), -sin(aM), sin(aM), cos(aM));
                mat2 rotY = mat2(cos(aY), -sin(aY), sin(aY), cos(aY));

                vec2 uvC = rotC * moireUV;
                vec2 uvM = rotM * moireUV;
                vec2 uvY = rotY * moireUV;

                // Desynced frequencies for spatial color interference
                float freqC = 35.0;
                float freqM = 35.5;
                float freqY = 36.0;

                // Liquid Sinusoidal interference
                float c = sin(uvC.x * freqC + u_time * 0.8) * sin(uvC.y * freqC - u_time * 0.3);
                float m = sin(uvM.x * freqM - u_time * 0.7) * sin(uvM.y * freqM + u_time * 0.4);
                float y = sin(uvY.x * freqY + u_time * 0.6) * sin(uvY.y * freqY - u_time * 0.5);

                c = smoothstep(0.1, 0.9, c);
                m = smoothstep(0.1, 0.9, m);
                y = smoothstep(0.1, 0.9, y);

                // LAYER 4: Fast Stochastic Sparkle & Glitch (The Anxious Photons)
                float sparkleHash = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                float shimmer = sin(u_time * 25.0 + sparkleHash * 6.28318);
                float glitter = smoothstep(0.98, 1.0, sparkleHash) * max(0.0, shimmer);

                float tear = step(0.995, fract(sin(u_time * 13.37) * 432.1)) * sin(vUv.y * 100.0);
                c += tear * 0.8;
                m -= tear * 0.4;

                // COMPOSITING: The Void & The Neon
                vec3 color = vec3(0.0);

                // Additive CMY light interference
                color += vec3(0.0, 1.0, 1.0) * c; // Cyan
                color += vec3(1.0, 0.0, 1.0) * m; // Magenta
                color += vec3(1.0, 1.0, 0.0) * y; // Yellow

                // Restrict neon to the crystalline tissue (revealing the void in cracks)
                color *= crack;

                // Add facet volume and deep biological glow
                color += vec3(0.0, 0.2, 0.4) * facetLight * crack * n_warp;

                // Add stochastic glitter constrained to crystal ridges
                float ridge = smoothstep(0.06, 0.0, abs(edge - 0.06));
                color += vec3(0.8, 1.0, 1.0) * glitter * (ridge + 0.1) * crack;

                // Deepen the void at the edges (vignette)
                float vignette = 1.0 - length(vUv - 0.5) * 1.3;
                color *= smoothstep(0.0, 0.6, vignette);

                // Final clamp to prevent burn-out while maintaining intense neon
                fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms && material.uniforms.u_time) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (err) {
    console.error("Feral Lithogenesis Engine Failed:", err);
}