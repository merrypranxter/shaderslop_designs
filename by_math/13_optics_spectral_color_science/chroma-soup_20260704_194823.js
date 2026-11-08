try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: ctx,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

            #define PI 3.14159265359
            #define GOLDEN_ANGLE 2.39996322973

            // --- REPO: spectral_color & chromostereopsis ---
            // Wyman, Sloan & Shirley 2013 multi-lobe CMF fit
            float lobe(float l, float alpha, float mu, float sL, float sR) {
                float t = (l - mu) / (l < mu ? sL : sR);
                return alpha * exp(-0.5 * t * t);
            }

            float cmfX(float l) {
                return lobe(l, 1.056, 599.8, 37.9, 31.0) + 
                       lobe(l, 0.362, 442.0, 16.0, 26.7) + 
                       lobe(l, -0.065, 501.1, 20.4, 26.2);
            }
            float cmfY(float l) {
                return lobe(l, 0.821, 568.8, 46.9, 40.5) + 
                       lobe(l, 0.286, 530.9, 16.3, 31.1);
            }
            float cmfZ(float l) {
                return lobe(l, 1.217, 437.0, 11.8, 36.0) + 
                       lobe(l, 0.681, 459.0, 26.0, 13.8);
            }

            vec3 xyzToLinearRGB(float x, float y, float z) {
                return vec3(
                     3.2406 * x - 1.5372 * y - 0.4986 * z,
                    -0.9689 * x + 1.8758 * y + 0.0415 * z,
                     0.0557 * x - 0.2040 * y + 1.0570 * z
                );
            }

            vec3 enforceMaxSaturation(vec3 rgb) {
                float lift = min(min(rgb.r, rgb.g), min(rgb.b, 0.0));
                rgb -= lift;
                float mx = max(max(rgb.r, rgb.g), max(rgb.b, 1e-6));
                return rgb / mx;
            }

            vec3 wavelengthToCandyRGB(float lambda) {
                vec3 rgb = xyzToLinearRGB(cmfX(lambda), cmfY(lambda), cmfZ(lambda));
                rgb = enforceMaxSaturation(rgb);
                // Acid gamma boost
                return pow(clamp(rgb, 0.0, 1.0), vec3(0.6));
            }

            // --- REPO: color_systems & plateau_foam ---
            mat2 rot(float a) {
                float c = cos(a), s = sin(a);
                return mat2(c, -s, s, c);
            }

            float hash(vec2 p) {
                p = fract(p * vec2(127.1, 311.7));
                p += dot(p, p + 43.21);
                return fract(p.x * p.y);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
            }

            // --- REPO: mycelial_networks & vascular_branching ---
            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                mat2 r = rot(GOLDEN_ANGLE);
                for(int i = 0; i < 5; i++) {
                    v += a * noise(p);
                    p = r * p * 2.0 + u_time * 0.05;
                    a *= 0.5;
                }
                return v;
            }

            // --- REPO: lenia ---
            float leniaGrowth(float u, float mu, float sig) {
                float d = u - mu;
                return exp(-(d * d) / (2.0 * sig * sig));
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // Base scalar field (The "Soup" substrate)
                vec2 q = vec2(fbm(uv + u_time * 0.1), fbm(uv + vec2(5.2, 1.3) - u_time * 0.12));
                vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2)), fbm(uv + 4.0 * q + vec2(8.3, 2.8)));
                
                vec3 finalColor = vec3(0.0);
                float totalWeight = 0.0;
                
                // --- REPO: chromatic_aberration & metamerism ---
                // Decompose into 7 spectral bands (400nm to 700nm)
                const int BANDS = 7;
                for(int i = 0; i < BANDS; i++) {
                    float t = float(i) / float(BANDS - 1); // 0.0 to 1.0
                    float lambda = mix(400.0, 700.0, t);
                    
                    // Dispersion factor: blue (-1) to red (+1)
                    float disp = (t - 0.5) * 2.0; 
                    
                    // --- REPO: chromostereopsis ---
                    // Red advances (scales up), blue recedes (scales down)
                    float depthScale = 1.0 - disp * 0.08 * sin(u_time * 0.2 + length(uv));
                    vec2 suv = uv * depthScale;
                    
                    // --- REPO: acoustic_impedance_tessellation ---
                    // Lateral chromatic shift guided by the vector field 'r' (Refraction)
                    vec2 shiftUV = suv + r * disp * 0.15;
                    
                    // Sample the field
                    float field = fbm(shiftUV * 2.5 + u_time * 0.15);
                    
                    // --- REPO: lenia ---
                    // Apply growth function to create cellular membranes
                    float membrane = leniaGrowth(field, 0.5 + 0.1 * sin(u_time), 0.15);
                    
                    // --- REPO: abelian_sandpile ---
                    // Quantized topological boundaries (avalanches)
                    float avalanche = smoothstep(0.08, 0.0, abs(fract(field * 8.0 - u_time * 0.5) - 0.5));
                    
                    // --- REPO: mycelial_networks ---
                    // Anastomosis loops (bright fusion points)
                    float anastomosis = pow(sin(r.x * 20.0 + u_time) * cos(r.y * 20.0 - u_time), 4.0);
                    
                    // Combine structural elements
                    float structure = membrane * 1.2 + avalanche * 0.8 + anastomosis * 0.5;
                    
                    // Get spectral color for this band
                    vec3 bandCol = wavelengthToCandyRGB(lambda);
                    
                    finalColor += bandCol * structure;
                    totalWeight += 1.0;
                }
                
                finalColor /= totalWeight;
                
                // Maximalist Candy-Acid Post-Processing
                finalColor = pow(finalColor, vec3(0.7)); // Lift midtones
                finalColor += finalColor * finalColor * 0.5; // Bloom
                
                // Vignette
                float vig = 1.0 - smoothstep(0.5, 1.5, length(uv));
                finalColor *= mix(0.1, 1.0, vig);

                fragColor = vec4(finalColor, 1.0);
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

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization or Render Failed:", e);
    
    // Fallback: If WebGL fails, create a corrupted ASCII representation using Canvas2D
    if (ctx && ctx.fillText) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.font = '12px monospace';
        const chars = "LENIA_MYCELIUM_FOAM_SANDPILE_SPECTRAL_";
        for(let y = 0; y < grid.height; y += 14) {
            for(let x = 0; x < grid.width; x += 8) {
                const nx = x / grid.width - 0.5;
                const ny = y / grid.height - 0.5;
                const d = Math.sqrt(nx*nx + ny*ny);
                const a = Math.atan2(ny, nx);
                const w = Math.sin(d * 20.0 - time * 2.0 + a * 3.0);
                if (w > 0.5) {
                    const idx = Math.floor(Math.abs(Math.sin(x*y + time) * chars.length));
                    ctx.fillStyle = `hsl(${(d*360 + time*100) % 360}, 100%, 60%)`;
                    ctx.fillText(chars[idx], x, y);
                }
            }
        }
    }
}