try {
    if (!canvas.__three) {
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
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;

            // --- HASH & NOISE ---
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            vec2 hash22(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return fract(sin(p) * 43758.5453);
            }

            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy));
                vec2 x0 = v - i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = mod(((i.y + vec3(0.0, i1.y, 1.0)) * 34.0 + 10.0) * (i.y + vec3(0.0, i1.y, 1.0)), 289.0);
                p = mod(((p + i.x + vec3(0.0, i1.x, 1.0)) * 34.0 + 10.0) * (p + i.x + vec3(0.0, i1.x, 1.0)), 289.0);
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m*m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 a0 = x - floor(x + 0.5);
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                return 130.0 * dot(m, vec3(a0.x*x0.x+h.x*x0.y, a0.y*x12.x+h.y*x12.y, a0.z*x12.z+h.z*x12.w));
            }

            float worley(vec2 p) {
                vec2 n = floor(p);
                vec2 f = fract(p);
                float md = 8.0;
                for(int j=-1; j<=1; j++) {
                    for(int i=-1; i<=1; i++) {
                        vec2 g = vec2(float(i), float(j));
                        vec2 o = hash22(n + g);
                        // Animate crystal lattice
                        o = 0.5 + 0.5 * sin(u_time * 0.8 + 6.2831 * o);
                        vec2 r = g + o - f;
                        md = min(md, dot(r,r));
                    }
                }
                return sqrt(md);
            }

            // --- CHLADNI VIBRATION ---
            float chladni(vec2 uv, float m, float n) {
                float pi = 3.14159265359;
                return sin(n * pi * uv.x) * sin(m * pi * uv.y) - sin(m * pi * uv.x) * sin(n * pi * uv.y);
            }

            // --- KALEIDOSCOPE DISTORTION ---
            vec2 kaleidoscope(vec2 uv, float folds) {
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                float sector = 6.2831853 / folds;
                angle = mod(angle, sector);
                if(angle > sector / 2.0) angle = sector - angle;
                return vec2(cos(angle), sin(angle)) * radius;
            }

            // --- HALFTONE ARTIFACT ---
            float halftone(vec2 uv, float freq, float angle, float luma) {
                float rad = radians(angle);
                mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                vec2 grid = rot * uv * freq;
                vec2 cell = fract(grid) - 0.5;
                float dist = length(cell);
                // Exaggerated dot scaling for Lisa Frank punch
                float radius = sqrt(luma) * 0.85; 
                return smoothstep(radius + 0.05, radius - 0.05, dist);
            }

            // --- NEON ACID PALETTE ---
            vec3 neonAcid(float t) {
                vec3 a = vec3(0.5);
                vec3 b = vec3(0.5, 0.5, 0.33);
                vec3 c = vec3(2.0, 1.0, 1.0);
                vec3 d = vec3(0.5, 0.2, 0.25);
                return a + b * cos(6.2831853 * (c * t + d));
            }

            // --- SPARKLES ---
            float star(vec2 p) {
                vec2 absP = abs(p);
                float cross = smoothstep(0.06, 0.0, absP.x * absP.y) * smoothstep(0.6, 0.0, length(p));
                float core = smoothstep(0.15, 0.0, length(p));
                return max(cross, core);
            }

            // --- SCENE GENERATOR ---
            vec3 renderScene(vec2 uv) {
                // 1. Kaleidoscope Base
                vec2 kUv = kaleidoscope(uv, 8.0);
                
                // 2. Chladni-driven Domain Warp
                float ch_m = 3.0 + sin(u_time * 0.2) * 2.0;
                float ch_n = 4.0 + cos(u_time * 0.3) * 2.0;
                float ch = chladni(kUv * 2.0, ch_m, ch_n);
                
                vec2 wUv = kUv + snoise(kUv * 5.0 - u_time * 0.3) * 0.15 * ch;
                
                // 3. Crystal Lattice (Quantized Worley)
                float w = worley(wUv * 8.0);
                float facet = floor(w * 8.0) / 8.0; 
                
                // 4. Leopard Spots (Lisa Frank aesthetic via F2-F1 analog)
                float leopard = worley(wUv * 16.0);
                float spots = smoothstep(0.12, 0.25, leopard) - smoothstep(0.3, 0.45, leopard);
                float spotMask = snoise(wUv * 4.0 + u_time * 0.15);
                spots *= smoothstep(0.0, 0.3, spotMask); // Cluster the spots
                
                // 5. Combine Luminance
                float luma = facet * 0.5 + ch * 0.25 + spots * 0.6;
                
                // 6. Map to Palette
                vec3 color = neonAcid(luma * 2.5 - u_time * 0.2 + wUv.x * 0.3);
                
                // 7. Halftone Screen Pass
                float ht = halftone(uv, 100.0, 45.0, luma);
                color = mix(vec3(0.03, 0.0, 0.08), color, ht); // Cosmic void dark ink
                
                // 8. Maximalist Stars
                vec2 gv = fract(wUv * 10.0) - 0.5;
                vec2 id = floor(wUv * 10.0);
                float s = star(gv - hash22(id)*0.5 + 0.25);
                float starGlow = s * step(0.85, hash(id));
                color += starGlow * vec3(1.0, 0.8, 1.0) * (0.5 + 0.5 * sin(u_time * 8.0 + hash(id) * 20.0));
                
                return color;
            }

            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Global rotation 
                float a = u_time * 0.05;
                mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
                uv = rot * uv;

                // Mouse interaction warp
                vec2 muv = (u_mouse / u_resolution) * 2.0 - 1.0;
                muv.x *= u_resolution.x / u_resolution.y;
                float mouseDist = length(uv - muv);
                uv += normalize(uv - muv) * smoothstep(0.5, 0.0, mouseDist) * 0.1;

                // CMYK Misregistration / Chromatic Aberration
                float offset = 0.02 * snoise(uv * 4.0 + u_time);
                vec2 dir = normalize(uv);
                
                // Multi-pass simulation
                float r = renderScene(uv + dir * offset).r;
                float g = renderScene(uv).g;
                float b = renderScene(uv - dir * offset).b;
                vec3 col = vec3(r, g, b);
                
                // Xerox Artifacts / Film Grain
                float grain = hash(vUv * 100.0 + u_time);
                col = mix(col, vec3(grain), 0.08); // Subtle blend
                
                // Heavy Vignette for focus
                float dist = length(vUv - 0.5) * 2.0;
                col *= 1.0 - smoothstep(0.7, 1.4, dist);
                
                fragColor = vec4(col, 1.0);
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
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        material.uniforms.u_mouse.value.set(mouse.x, mouse.y);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral WebGL Initialization Failed:", e);
}