if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ 
            canvas, 
            context: ctx, 
            alpha: true, 
            antialias: true,
            preserveDrawingBuffer: true 
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

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
            uniform vec2 u_mouse;
            uniform float u_seed;

            const float PI = 3.14159265359;
            const int MAX_ITER = 200;
            const float BAILOUT = 256.0;

            // Perceptually uniform OKLab to sRGB conversion (from color_systems)
            vec3 oklab_to_srgb(vec3 c) {
                float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
                float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
                float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
                
                float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
                
                vec3 rgb = vec3(
                    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                   -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                   -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                );
                
                // Gamma encode
                return mix(
                    1.055 * pow(max(rgb, vec3(0.0)), vec3(1.0/2.4)) - 0.055, 
                    rgb * 12.92, 
                    lessThanEqual(rgb, vec3(0.0031308))
                );
            }

            // Maximalist Candy-Acid Palette
            vec3 palette(float t) {
                float L = 0.68 + 0.12 * sin(t * PI);
                float C = 0.28 + 0.06 * cos(t * 2.718);
                float h = t * PI * 2.0 + u_seed * 10.0;
                return oklab_to_srgb(vec3(L, C * cos(h), C * sin(h)));
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Fluid distortion on base UVs (psychedelic_collage / moire)
                float t = u_time * 0.25;
                uv += vec2(sin(uv.y * 3.0 + t), cos(uv.x * 3.0 - t)) * 0.05;

                // Mouse interaction mapped to Julia parameter
                vec2 mouseOffset = (u_mouse - 0.5) * 1.5;
                float mouseInfluence = smoothstep(0.0, 1.0, length(u_mouse - 0.5) * 2.0);

                // Animated Julia constant k - Sentinel mathematical weather system
                vec2 k = vec2(
                    sin(t * 0.85) * 0.65 + cos(t * 0.32) * 0.15,
                    cos(t * 0.71) * 0.65 + sin(t * 0.45) * 0.15
                );
                
                // Blend in mouse control softly
                k = mix(k, mouseOffset, mouseInfluence);

                vec2 z = uv * 1.25;
                vec2 dz = vec2(1.0, 0.0);
                float trap = 1e20;
                float n = 0.0;

                for(int i = 0; i < MAX_ITER; i++) {
                    // Derivative for Distance Estimation (Julia: dz = 2 * z * dz)
                    dz = 2.0 * vec2(z.x*dz.x - z.y*dz.y, z.x*dz.y + z.y*dz.x);
                    
                    // Fractal formula
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + k;

                    // Orbit trap for kintsugi veins / floral geometry
                    float currentTrap = min(abs(z.x * z.y), length(z) - 0.4);
                    trap = min(trap, abs(currentTrap));

                    if(dot(z, z) > BAILOUT) {
                        n = float(i);
                        break;
                    }
                }

                vec3 color = vec3(0.0);

                if(n < float(MAX_ITER) - 1.0) {
                    // Smooth escape time (fractals repo)
                    float log_zn = log(dot(z, z)) * 0.5;
                    float nu = log2(log_zn / log(2.0));
                    float sn = n + 1.0 - nu;

                    // Distance Estimator for crystalline edge glow
                    float r = length(z);
                    float dr = length(dz);
                    float de = 0.5 * log(r) * r / dr;

                    // Moiré op-art bands (moire repo)
                    float moireFreq = 5.0 + 2.0 * sin(u_time * 0.4);
                    float moire = 0.5 + 0.5 * sin(sn * moireFreq - u_time * 4.0);
                    float opArt = smoothstep(0.35, 0.65, moire);

                    // Glitchcore chromatic offset in palette lookup
                    float basePhase = sn * 0.015 - u_time * 0.2;
                    vec3 c_r = palette(basePhase);
                    vec3 c_g = palette(basePhase + 0.04);
                    vec3 c_b = palette(basePhase + 0.08);
                    
                    // Recombine with op-art interference
                    color = vec3(c_r.r, c_g.g, c_b.b) * (0.3 + 0.7 * opArt);

                    // Crystalline edge halos
                    float edgePulse = 10.0 + 4.0 * sin(u_time * 2.5);
                    float edgeGlow = exp(-de * edgePulse);
                    color += vec3(0.9, 0.95, 1.0) * edgeGlow * 1.3;

                    // Kintsugi / Buried shine veins (shiny repo)
                    float vein = exp(-trap * 12.0);
                    vec3 veinColor = palette(trap * 3.0 + u_time * 0.6);
                    color += veinColor * vein * 2.0;

                } else {
                    // Interior fluid core
                    float d = length(z);
                    float pulse = 0.5 + 0.5 * sin(d * 15.0 - u_time * 6.0);
                    color = palette(d * 0.15 + u_time * 0.1) * pulse * 0.5;
                }

                // CRT/VHS Shimmer & Scanlines (psychedelic_collage)
                float scanline = 0.92 + 0.08 * sin(vUv.y * u_resolution.y * 2.5);
                float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
                color *= scanline;
                color += noise * 0.07;

                // Vignette
                float vig = length(vUv - 0.5) * 2.0;
                color *= 1.0 - pow(vig, 2.8) * 0.7;

                fragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_seed: { value: Math.random() * 100.0 }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        canvas.__three = { renderer, scene, camera, material };

        // Keyboard Controls Setup
        if (!canvas.__keysAttached) {
            window.addEventListener('keydown', (e) => {
                const key = e.key.toLowerCase();
                if (key === 's') canvas.__saveScreenshot = true;
                if (key === 'r') canvas.__reseed = true;
                if (key === ' ') canvas.__paused = !canvas.__paused;
            });
            canvas.__keysAttached = true;
            canvas.__paused = false;
            canvas.__internalTime = 0;
        }

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

// Handle Keyboard Actions
if (canvas.__saveScreenshot) {
    const link = document.createElement('a');
    link.download = `julia_spectacle_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    canvas.__saveScreenshot = false;
}

if (canvas.__reseed) {
    if (material?.uniforms?.u_seed) {
        material.uniforms.u_seed.value = Math.random() * 100.0;
    }
    canvas.__reseed = false;
}

// Handle Time & Pausing
const dt = time - (canvas.__lastTime || time);
canvas.__lastTime = time;

if (!canvas.__paused) {
    canvas.__internalTime += dt;
}

// Update Uniforms
if (material?.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = canvas.__internalTime;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (material.uniforms.u_mouse) {
        // Normalize mouse to 0-1 range
        const mx = mouse.x / grid.width;
        const my = 1.0 - (mouse.y / grid.height); // Flip Y for GLSL coordinates
        material.uniforms.u_mouse.value.set(mx, my);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);