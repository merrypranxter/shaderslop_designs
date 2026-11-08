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
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;

                // --- Hash & Noise ---
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                vec2 hash2(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0; float a = 0.5;
                    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
                    for (int i = 0; i < 4; i++) {
                        v += a * noise(p);
                        p = rot * p * 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                // --- Plateau Foam (Voronoi Relaxation) ---
                vec3 voronoi(vec2 x) {
                    vec2 n = floor(x);
                    vec2 f = fract(x);
                    float m_dist = 8.0;
                    float m_dist2 = 8.0;
                    for(int j=-1; j<=1; j++) {
                        for(int i=-1; i<=1; i++) {
                            vec2 g = vec2(float(i), float(j));
                            vec2 o = hash2(n + g);
                            // Temporal desync / relaxation
                            o = 0.5 + 0.5 * sin(u_time * 0.4 + 6.2831 * o);
                            vec2 r = g + o - f;
                            float d = dot(r, r);
                            if(d < m_dist) {
                                m_dist2 = m_dist;
                                m_dist = d;
                            } else if(d < m_dist2) {
                                m_dist2 = d;
                            }
                        }
                    }
                    return vec3(sqrt(m_dist), sqrt(m_dist2), 0.0);
                }

                // --- Master Scene: Coherent Computational Soup ---
                float scene(vec2 p, float t) {
                    // Acoustic Impedance / Domain Warp
                    vec2 warp = vec2(fbm(p + t * 0.15), fbm(p + vec2(5.2, 1.3) - t * 0.15));
                    p += warp * 0.3;
                    
                    // Ice Dendrite radial modulation (Birefringence)
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    float dendrite = sin(a * 7.0 + r * 12.0 - t * 2.0) * exp(-r * 1.5);
                    p += vec2(cos(a), sin(a)) * dendrite * 0.15;
                    
                    // Plateau Foam
                    vec3 v = voronoi(p * 2.5);
                    float foam = v.y - v.x; // Plateau border thickness
                    
                    // Lenia Multi-kernel Organism (Activator-Inhibitor)
                    float act = exp(-(foam - 0.05) * (foam - 0.05) / 0.005);
                    float inh = exp(-(foam - 0.25) * (foam - 0.25) / 0.02);
                    float lenia = act - 0.7 * inh;
                    
                    // Vibration / Chladni Nodal Lines
                    float chladni = abs(cos(12.0 * p.x + t) * cos(12.0 * p.y) - cos(18.0 * p.x) * cos(18.0 * p.y - t));
                    
                    // Moiré Interference embedded in haze
                    float moire = sin(60.0 * p.x + lenia * 8.0) * sin(60.0 * p.y + chladni * 8.0);
                    
                    // Abelian Sandpile (Fractal Quantization)
                    float base_val = foam * 2.0 + lenia * 1.2 + chladni * 0.4 + moire * 0.2;
                    float sandpile = floor(mod(base_val * 6.0, 4.0)) / 3.0; 
                    
                    return base_val * 0.6 + sandpile * 0.25;
                }

                // --- OKLCh to sRGB (Color Space Warp & Color Systems) ---
                vec3 oklch_to_srgb(vec3 lch) {
                    float l = lch.x;
                    float c = lch.y;
                    float h = lch.z;
                    vec3 lab = vec3(l, c * cos(h), c * sin(h));
                    
                    float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
                    float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
                    float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
                    
                    float l3 = l_ * l_ * l_;
                    float m3 = m_ * m_ * m_;
                    float s3 = s_ * s_ * s_;
                    
                    vec3 lin = vec3(
                         4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
                        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
                        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
                    );
                    
                    vec3 linPos = max(lin, vec3(0.0));
                    vec3 bLess = linPos * 12.92;
                    vec3 bMore = 1.055 * pow(linPos, vec3(1.0/2.4)) - 0.055;
                    return mix(bLess, bMore, step(vec3(0.0031308), linPos));
                }

                // --- Render Pass: Prism Dispersion + Birefringence + RGB Moiré ---
                vec3 render(vec2 p, float t) {
                    // Prism Dispersion: spatial offset per wavelength
                    float dR = scene(p * 0.98, t);
                    float dG = scene(p * 1.00, t + 0.05); // Temporal desync (Flash-lag)
                    float dB = scene(p * 1.02, t + 0.10);
                    
                    // Hyperbolic Colors: Max chroma pushes past real gamuts
                    float C = 0.38; 
                    
                    // Birefringence: Retardance to Michel-Levy OKLCh hues
                    float hR = dR * 12.0 + t * 1.5;
                    float hG = dG * 12.0 + t * 1.5 + 0.4;
                    float hB = dB * 12.0 + t * 1.5 + 0.8;
                    
                    // Self-Luminous / Stygian lightness oscillation
                    float L_R = 0.55 + 0.25 * sin(dR * 15.0);
                    float L_G = 0.55 + 0.25 * sin(dG * 15.0);
                    float L_B = 0.55 + 0.25 * sin(dB * 15.0);
                    
                    vec3 col;
                    // RGB Chromatic Moiré separation
                    col.r = oklch_to_srgb(vec3(L_R, C, hR)).r;
                    col.g = oklch_to_srgb(vec3(L_G, C, hG)).g;
                    col.b = oklch_to_srgb(vec3(L_B, C, hB)).b;
                    
                    return col;
                }

                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    p.x *= u_resolution.x / u_resolution.y;
                    
                    float t = u_time * 0.4;
                    
                    // Primary Render
                    vec3 col = render(p, t);
                    
                    // Shoegaze Halation (Bloom)
                    vec2 eps = vec2(0.015, 0.0);
                    vec3 bloom = (
                        render(p + eps.xy, t) +
                        render(p - eps.xy, t) +
                        render(p + eps.yx, t) +
                        render(p - eps.yx, t)
                    ) * 0.25;
                    
                    col = mix(col, bloom, 0.45);
                    
                    // Retrocausal Ghost Lead (Predictive Future State)
                    vec3 ghost = render(p * 0.95, t + 0.6);
                    col = mix(col, ghost, 0.15 * smoothstep(0.0, 1.0, sin(t * 2.0)));
                    
                    // Acoustic Shadowing (Self-luminous / Stygian contrast push)
                    float shadow_d = scene(p + vec2(0.0, 0.05), t);
                    col *= mix(1.0, 0.4, smoothstep(0.3, 0.9, shadow_d));
                    
                    // Shoegaze Film Grain & Speckle
                    float grain = hash(p * 800.0 + t);
                    col += (grain - 0.5) * 0.12;
                    
                    // Soft contrast curve
                    col = smoothstep(0.0, 1.0, col);
                    
                    // Vignette
                    float vig = length(p);
                    col *= 1.0 - 0.25 * vig * vig;
                    
                    fragColor = vec4(col, 1.0);
                }
            `
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
if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);