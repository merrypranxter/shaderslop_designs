try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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

            // Feral Hash for tape noise
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            // Wave Sinusoidal Moiré (Repo: moire-as-point/04_wave_sinusoidal)
            // Creates smooth, liquid fringes rather than sharp digital bands.
            float sineGrating(vec2 p, float freq, float angle, float phase) {
                vec2 dir = vec2(cos(angle), sin(angle));
                float x = dot(p, dir);
                return 0.5 + 0.5 * sin(x * freq + phase);
            }

            vec3 getFrame(vec2 uv) {
                // Base: Near-white, high brightness, low contrast
                vec3 col = vec3(0.94, 0.93, 0.95);

                // Moiré interference mesh (faint grey)
                // Frequencies tuned to create a subtle woven/mesh appearance
                float f1 = 120.0;
                float f2 = 123.0;
                float g1 = sineGrating(uv, f1, 0.1, u_time * 0.2);
                float g2 = sineGrating(uv, f2, 1.4, -u_time * 0.15);
                float g3 = sineGrating(uv, 118.0, 2.8, u_time * 0.05);
                
                // Multiplicative blending for natural wave interference
                float moire = g1 * g2 * g3;
                moire = pow(moire, 0.8); 
                
                col -= moire * 0.12; // Apply as faint grey subtraction

                // Grey scanlines (CRT/Video structure)
                float scanline = sin(uv.y * u_resolution.y * 0.6) * 0.5 + 0.5;
                col -= scanline * 0.04;

                // Tape dropout (burns to pure white, thin horizontal bands, strobes irregularly)
                // Repo: damage_aesthetics -> VHS pause & tape tracking
                float t_quant = floor(u_time * 14.0); // Quantize time for erratic 14fps strobe
                
                // Horizontal band generation
                float band_noise = hash(vec2(floor(uv.y * 200.0), t_quant));
                
                // Irregular strobe envelope (machine hesitation)
                float strobe = step(0.88, hash(vec2(t_quant, 1.0))); 
                
                // Burn threshold
                float dropout = step(0.96, band_noise) * strobe;
                
                // Head-switching noise at bottom (classic VHS pause artifact)
                if (uv.y < 0.06) {
                    float head_noise = hash(vec2(uv.x * 50.0, uv.y * 100.0 + u_time));
                    float head_tear = step(0.6, head_noise);
                    dropout += head_tear * 0.6;
                    col -= head_noise * 0.08; // Add some dark grit to the bottom band
                }

                // Apply dropout as pure white burn
                col += vec3(dropout * 2.0); 

                return col;
            }

            void main() {
                vec2 uv = vUv;
                
                // Pause warp / Jitter (temporal instability)
                float t_jitter = floor(u_time * 24.0);
                
                // Horizontal tracking shear
                float shear = (hash(vec2(floor(uv.y * 40.0), t_jitter)) - 0.5) * 0.006;
                uv.x += shear * step(0.92, hash(vec2(t_jitter, 2.0))); // Only shear sometimes
                
                // Micro vertical jitter
                uv.y += (hash(vec2(t_jitter, 3.0)) - 0.5) * 0.002;

                // Chromatic Aberration (Pink/Cyan bleed at edges)
                vec2 center = vec2(0.5);
                float dist = length(uv - center);
                
                // Exponential spread pushes CA to the edges
                float spread = pow(dist, 2.2) * 0.025;
                
                // Directional vector for the bleed
                vec2 dir = normalize(uv - center + vec2(0.05, 0.0));
                
                // Shift Red outward, Blue inward to force Pink/Cyan fringing
                vec2 uvR = uv + dir * spread;
                vec2 uvG = uv;
                vec2 uvB = uv - dir * spread * 1.2; 

                float r = getFrame(uvR).r;
                float g = getFrame(uvG).g;
                float b = getFrame(uvB).b;

                vec3 finalCol = vec3(r, g, b);
                
                // Subtle corner vignette to emphasize the glow/bleed
                finalCol *= smoothstep(1.1, 0.4, dist);

                fragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
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

    if (material?.uniforms?.u_time) {
        material.uniforms.u_time.value = time;
    }
    if (material?.uniforms?.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}