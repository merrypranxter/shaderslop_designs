try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        
        // Orthographic camera for flat shader plane
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

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

            // --- Ashima 3D Simplex Noise ---
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
                float n_ = 1.42857142857 - 0.5;
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
                return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
            }

            // --- FBM & Curl ---
            float fbm(vec2 p) {
                float sum = 0.0;
                float amp = 1.0;
                float freq = 1.0;
                for(int i = 0; i < 4; i++) {
                    sum += snoise(vec3(p * freq, u_time * 0.08)) * amp;
                    freq *= 2.0;
                    amp *= 0.5;
                }
                return sum;
            }

            vec2 curl(vec2 p) {
                float e = 0.05;
                float dx = (fbm(p + vec2(e, 0.0)) - fbm(p - vec2(e, 0.0))) / (2.0 * e);
                float dy = (fbm(p + vec2(0.0, e)) - fbm(p - vec2(0.0, e))) / (2.0 * e);
                return vec2(dy, -dx);
            }

            // --- Merry's Interference Palette ---
            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return a + b * cos(6.28318 * (c * t + d));
            }

            void main() {
                // Centered, aspect-corrected coordinates
                vec2 uv = (vUv - 0.5) * (u_resolution.x / u_resolution.y);

                // 1. Curl-Warped Advection Field
                vec2 cWarp = curl(uv * 1.8 + u_time * 0.05);
                vec2 advected_uv = uv + cWarp * 0.25;

                // 2. Slow Wave Field (Height)
                float h = fbm(advected_uv * 2.5 - u_time * 0.1);

                // 3. Curvature via Laplacian (to find crests)
                float e = 0.02;
                float hx = fbm((advected_uv + vec2(e, 0.0)) * 2.5 - u_time * 0.1);
                float hX = fbm((advected_uv - vec2(e, 0.0)) * 2.5 - u_time * 0.1);
                float hy = fbm((advected_uv + vec2(0.0, e)) * 2.5 - u_time * 0.1);
                float hY = fbm((advected_uv - vec2(0.0, e)) * 2.5 - u_time * 0.1);
                
                // Laplacian: negative values indicate concave down (crests)
                float laplacian = (hx + hX + hy + hY - 4.0 * h) / (e * e);
                
                // Isolate high-curvature crests
                float crest = smoothstep(-15.0, -45.0, laplacian);

                // 4. Deep Violet Body Color (The Ship aesthetic)
                vec3 voidColor = vec3(0.02, 0.01, 0.04);
                vec3 deepPurple = vec3(0.12, 0.0, 0.25);
                vec3 bodyCol = mix(voidColor, deepPurple, h * 0.5 + 0.5);

                // 5. Thin-Film Rainbow (Interference)
                // Phase is driven by height, shear (curl magnitude), and time
                float phase = h * 2.5 + length(cWarp) * 1.5 - u_time * 0.3;
                vec3 filmCol = palette(phase);
                
                // Apply rainbow ONLY at the crests, multiply to make it luminous/neon
                filmCol *= crest * 2.5;

                // 6. Sparse Star Dust (Advected)
                // Evaluate high-frequency noise at the advected coordinates so it flows with the fluid
                float dustNoise = snoise(vec3(advected_uv * 60.0, u_time * 0.2));
                
                // Extreme power function creates sparse points from continuous noise
                float dust = pow(max(0.0, dustNoise), 45.0) * 30.0;
                
                // Twinkle modulation
                float twinkle = pow(max(0.0, sin(u_time * 4.0 + dustNoise * 100.0)), 2.0);
                vec3 starCol = vec3(0.9, 0.95, 1.0) * dust * twinkle;

                // 7. Composition
                vec3 finalCol = bodyCol + filmCol + starCol;

                // Crush the darks slightly for depth
                finalCol = pow(max(finalCol, 0.0), vec3(1.15));

                fragColor = vec4(finalCol, 1.0);
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
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral WebGL Error:", e);
}