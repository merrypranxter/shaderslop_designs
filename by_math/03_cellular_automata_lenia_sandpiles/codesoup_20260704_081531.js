if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            #define PI 3.14159265359
            
            // HASH & NOISE (Acoustic Speckle / Grain)
            vec2 hash22(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.xx+p3.yz)*p3.zy);
            }
            
            // CHLADNI VIBRATION (from 'vibration' repo)
            float chladni(vec2 p, float t) {
                float v1 = sin(p.x*PI + t) * cos(p.y*PI - t);
                float v2 = sin(p.x*PI*1.5 - t*0.8) * cos(p.y*PI*1.5 + t*0.8);
                return v1 * v2;
            }
            
            // MOIRÉ SPIRAL (from 'moire' repo)
            float spiralMoire(vec2 p, float t) {
                float r = length(p);
                float a = atan(p.y, p.x);
                float s1 = sin(a * 7.0 + log(r + 0.1)*15.0 + t*2.0);
                float s2 = sin(a * 8.0 + log(r + 0.1)*16.0 - t*2.5);
                return s1 * s2;
            }
            
            // LENIA KERNEL (from 'lenia' repo)
            float leniaRing(float r, float mu, float sigma) {
                float d = r - mu;
                return exp(-(d*d)/(2.0*sigma*sigma));
            }
            
            // PLATEAU FOAM + ABELIAN SANDPILE 
            // Additive weighted Voronoi representing cellular tissue & discrete topple terraces
            vec4 foam(vec2 p, float t) {
                vec2 ip = floor(p);
                vec2 fp = fract(p);
                float f1 = 1e9, f2 = 1e9, id = 0.0;
                for(int j=-2; j<=2; j++) {
                    for(int i=-2; i<=2; i++) {
                        vec2 offset = vec2(i, j);
                        vec2 h = hash22(ip + offset);
                        vec2 pos = offset + 0.5 + 0.4 * sin(t*0.5 + 6.28*h);
                        float weight = h.x * 0.35; // curved Plateau borders
                        float d = length(fp - pos) - weight;
                        if(d < f1) {
                            f2 = f1;
                            f1 = d;
                            id = h.y;
                        } else if(d < f2) {
                            f2 = d;
                        }
                    }
                }
                float border = f2 - f1; 
                // Sandpile stepping: forcing discrete integer states on continuous fields
                float sandpile = floor(mod(id * 100.0 + t * 5.0, 4.0)) / 3.0; 
                return vec4(f1, border, id, sandpile);
            }
            
            // OKLAB PERCEPTUAL SPACE (from 'color_space_warp' & 'color_systems')
            vec3 oklab2srgb(vec3 c) {
                float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
                float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
                float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
                float l_ = l*l*l, m_ = m*m*m, s_ = s*s*s;
                return vec3(
                     4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
                    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
                    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_
                );
            }
            
            // CANDY-ACID PALETTE via GOLDEN ANGLE
            vec3 candyAcid(float t) {
                float h = t * 2.39996 + u_time * 0.2; // Golden angle progression
                float C = 0.38 + 0.12 * sin(t * 15.0); // Hyperbolic chroma push (impossible_colors)
                float L = 0.65 + 0.2 * cos(t * 8.0);
                float a = C * cos(h);
                float b = C * sin(h);
                return oklab2srgb(vec3(L, a, b));
            }
            
            // UNIFIED COMPUTATIONAL SOUP
            vec3 sampleSoup(vec2 uv, float t, float waveOffset) {
                vec2 p = (uv - 0.5) * 3.5;
                p.x *= u_resolution.x / u_resolution.y;
                
                // Slow biological rotation
                float c = cos(t*0.05), s = sin(t*0.05);
                p *= mat2(c, -s, s, c);
                
                float ch = chladni(p, t);
                float moire = spiralMoire(p, t);
                
                // Ultrasound domain warping
                p += vec2(ch, moire) * 0.15 * waveOffset;
                
                vec4 f = vec4(0.0);
                float amp = 1.0, freq = 1.0;
                
                // Multi-scale tissue layers
                for(int i=0; i<3; i++) {
                    f += foam(p * freq, t) * amp;
                    freq *= 1.8;
                    amp *= 0.55;
                    p *= mat2(0.8, -0.6, 0.6, 0.8);
                }
                
                float speckle = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                
                // Lenia wet-engine organisms living inside the foam
                float lenia = leniaRing(f.x, 0.3, 0.1) * leniaRing(f.y, 0.1, 0.05);
                
                // Sandpile terraces
                float terraces = f.w;
                
                // Birefringence Michel-Lévy Retardance Map
                float retardance = f.x * 4.0 + f.y * 6.0 + lenia * 3.0 + terraces * 1.5;
                
                return candyAcid(retardance + speckle * 0.08);
            }
            
            void main() {
                vec2 uv = vUv;
                
                // CAUCHY DISPERSION (from 'prism_dispersion')
                // Sampling the field per-wavelength with an offset
                float r = sampleSoup(uv, u_time, 1.0).r;
                float g = sampleSoup(uv, u_time, 1.03).g;
                float b = sampleSoup(uv, u_time, 1.06).b;
                vec3 col = vec3(r, g, b);
                
                // SHOEGAZE HALATION & BLOOM
                float lum = dot(col, vec3(0.299, 0.587, 0.114));
                vec3 halation = vec3(1.0, 0.3, 0.8) * smoothstep(0.5, 1.0, lum);
                col += halation * 0.6;
                
                // FILM GRAIN / ULTRASOUND NOISE VEIL
                float grain = fract(sin(dot(uv + u_time, vec2(12.9898,78.233))) * 43758.5453);
                col += (grain - 0.5) * 0.15;
                
                // IMPOSSIBLE COLORS (Stygian darks / Hyperbolic oversaturation)
                col = mix(col, col * 1.5 - 0.1, 0.25);
                
                // SOFT VIGNETTE
                float vig = length(uv - 0.5) * 2.0;
                col *= 1.0 - pow(vig, 3.0) * 0.3;
                
                fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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