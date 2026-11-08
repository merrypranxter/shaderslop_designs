if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                in vec2 vUv;
                out vec4 fragColor;
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_mouse;

                #define PI 3.14159265359
                #define TAU 6.28318530718

                // OKLCh to sRGB (Perceptual Color Space)
                vec3 oklch2srgb(vec3 c) {
                    float L = c.x; float C = c.y; float h = c.z;
                    float a = C * cos(h); float b = C * sin(h);
                    float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
                    float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
                    float s_ = L - 0.0894841775 * a - 1.2914855480 * b;
                    float l = l_*l_*l_; float m = m_*m_*m_; float s = s_*s_*s_;
                    vec3 rgb = vec3(
                         4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                    );
                    return rgb;
                }

                vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }

                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
                float noise(vec2 p) {
                    vec2 i = floor(p), f = fract(p);
                    f = f*f*(3.0-2.0*f);
                    return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                               mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
                }

                // Psychedelic Collage: The Tetragrammaton (4-fold symmetry fold)
                vec2 kaleidoscope(vec2 uv, float folds) {
                    float angle = atan(uv.y, uv.x);
                    float radius = length(uv);
                    float sector = TAU / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    return vec2(cos(angle), sin(angle)) * radius;
                }

                // Structural Color: Thin Film Interference
                vec3 thinFilm(float thickness, float viewAngle) {
                    float pathDiff = 2.0 * 1.56 * thickness * cos(viewAngle); // n=1.56 (Chitin)
                    return oklch2srgb(vec3(0.65, 0.18, pathDiff * 4.0 + u_time * 0.5));
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;

                    // Damage Aesthetics: VHS Tracking Tear
                    float tear = step(0.99, hash(vec2(u_time * 0.2, floor(vUv.y * 24.0))));
                    uv.x += tear * 0.15 * sin(u_time * 30.0);

                    // Dream Physics: Hyperbolic Poincaré Projection
                    float r2 = dot(uv, uv);
                    float mask = smoothstep(1.0, 0.95, r2);
                    vec2 z = uv / (1.001 - r2); 

                    // Symmetry Fold
                    z = kaleidoscope(z, 4.0);
                    
                    // The Ocean / Math: FBM Domain Warping
                    z += vec2(noise(z * 2.0 + u_time*0.5), noise(z.yx * 2.0 - u_time*0.3)) * 0.2;

                    // Fractal Iteration: Julia Set
                    vec2 c = vec2(-0.4, 0.6) + vec2(sin(u_time*0.2), cos(u_time*0.3)) * 0.2;
                    c += (u_mouse - 0.5) * 0.5; // Dream steering

                    float smooth_n = 0.0;
                    float trap = 1e10;
                    float hyphae = 1e10;
                    
                    vec2 dz = vec2(1.0, 0.0);
                    for(int i = 0; i < 64; i++) {
                        dz = 2.0 * cmul(z, dz);
                        z = cmul(z, z) + c;
                        
                        trap = min(trap, dot(z, z));
                        // Mycelial Networks: Anastomosis Orbit Trap
                        hyphae = min(hyphae, abs(z.x * z.y));

                        if(dot(z, z) > 256.0) {
                            float log_zn = log(dot(z,z)) * 0.5;
                            float nu = log(log_zn / 0.69314718) / 0.69314718;
                            smooth_n = float(i) + 1.0 - nu;
                            break;
                        }
                    }

                    // The Void Rule: Background is near-black
                    vec3 color = vec3(0.02, 0.01, 0.04);

                    if (smooth_n > 0.0) {
                        // Structural Color + Fractal Gradient
                        float thickness = smooth_n * 0.08 + hyphae * 0.3;
                        float viewAngle = length(uv) * PI * 0.25;
                        color = thinFilm(thickness, viewAngle);
                        
                        // Golden Angle Fibonacci Hues for Neon Accents
                        float fibHue = smooth_n * 2.39996; 
                        vec3 neon = oklch2srgb(vec3(0.85, 0.25, fibHue - u_time));
                        
                        // Blend mycelial glowing cords
                        color = mix(color, neon, exp(-hyphae * 8.0));
                    } else {
                        // Interior Glow (The Whirring)
                        color = oklch2srgb(vec3(0.1, 0.05, trap * 10.0 - u_time));
                    }

                    // Damage Aesthetics: Phosphor Bloom & Chroma Bleed
                    float bloom = exp(-trap * 3.0);
                    color += oklch2srgb(vec3(0.7, 0.2, u_time)) * bloom * 0.4;

                    // CRT Scanlines & RGB Shift
                    color.r *= 0.95 + 0.05 * sin(vUv.y * u_resolution.y * 3.1415 + u_time);
                    color.g *= 0.95 + 0.05 * sin(vUv.y * u_resolution.y * 3.1415 + u_time + 2.0);
                    color.b *= 0.95 + 0.05 * sin(vUv.y * u_resolution.y * 3.1415 + u_time + 4.0);

                    // Apply Hyperbolic Mask
                    color *= mask;

                    // AgX Tonemapping Approximation
                    vec3 x = max(vec3(0.0), color);
                    vec3 a_agx = x * (x + 0.0245786) - 0.000090537;
                    vec3 b_agx = x * (0.983729 * x + 0.4329510) + 0.238081;
                    color = a_agx / b_agx;
                    
                    // Gamma Correction
                    color = pow(color, vec3(1.0/2.2));

                    fragColor = vec4(color, 1.0);
                }
            `
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (material.uniforms.u_mouse) {
        const targetX = mouse.x / grid.width;
        const targetY = 1.0 - (mouse.y / grid.height);
        material.uniforms.u_mouse.value.x += (targetX - material.uniforms.u_mouse.value.x) * 0.1;
        material.uniforms.u_mouse.value.y += (targetY - material.uniforms.u_mouse.value.y) * 0.1;
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);