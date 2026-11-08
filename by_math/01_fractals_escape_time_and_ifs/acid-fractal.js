if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            uniform vec2 u_mouse;
            
            #define MAX_ITER 100
            #define PI 3.14159265359
            
            // Hash & Noise
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            
            // Kaleidoscope (Psychedelic Collage)
            vec2 kaleidoscope(vec2 uv, float folds) {
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                float sector = 2.0 * PI / folds;
                angle = mod(angle, sector);
                if (angle > sector * 0.5) angle = sector - angle;
                return vec2(cos(angle), sin(angle)) * radius;
            }
            
            // Complex math
            vec2 cmul(vec2 a, vec2 b) {
                return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
            }
            
            // Neon Acid Palette (Color Fields)
            vec3 paletteNeon(float t) {
                vec3 a = vec3(0.5,  0.5,  0.5);
                vec3 b = vec3(0.5,  0.5,  0.33);
                vec3 c = vec3(2.0,  1.0,  1.0);
                vec3 d = vec3(0.5,  0.2,  0.25);
                return a + b * cos(6.28318 * (c * t + d));
            }
            
            // Acid Vibration Palette
            vec3 acidPalette(float t) {
                vec3 cols[5];
                cols[0] = vec3(1.0, 0.0, 1.0); // Hot Magenta
                cols[1] = vec3(0.0, 1.0, 1.0); // Cyan Shock
                cols[2] = vec3(1.0, 1.0, 0.0); // Lemon Zap
                cols[3] = vec3(1.0, 0.2, 0.0); // Electric Orange
                cols[4] = vec3(0.0, 1.0, 0.4); // Acid Lime
                
                t = mod(t, 5.0);
                int i = int(floor(t));
                float f = fract(t);
                f = smoothstep(0.0, 1.0, f);
                
                vec3 c1 = cols[i];
                vec3 c2 = cols[(i+1)%5];
                return mix(c1, c2, f);
            }
            
            // Fractal: Julia + Burning Ship Hybrid (Fractals)
            vec4 fractal(vec2 c, vec2 z_init, float time) {
                vec2 z = z_init;
                float n = 0.0;
                float trap = 1e10;
                
                for(int i = 0; i < MAX_ITER; i++) {
                    // Burning ship variant hybrid logic
                    z = mix(z, vec2(abs(z.x), abs(z.y)), 0.3);
                    z = cmul(z, z) + c;
                    trap = min(trap, abs(z.x * z.y));
                    if(dot(z, z) > 256.0) {
                        float log_zn = log(dot(z, z)) * 0.5;
                        float nu = log(log_zn / 0.69314718) / 0.69314718;
                        n = float(i) + 1.0 - nu;
                        break;
                    }
                }
                return vec4(n, trap, z);
            }
            
            // Halftone Screen (Dither / Psychedelic Collage)
            float halftone(vec2 fragCoord, float freq, float angle, float luma) {
                float rad = radians(angle);
                mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                vec2 uv = rot * fragCoord * freq / 1024.0;
                vec2 cell = fract(uv) - 0.5;
                float dist = length(cell);
                float dotRadius = sqrt(1.0 - luma) * 0.5;
                return smoothstep(dotRadius + 0.1, dotRadius - 0.1, dist);
            }
            
            void main() {
                vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
                
                // Mycelial displacement / Structural distortion
                vec2 p = uv * 2.5;
                p += vec2(noise(p * 4.0 + u_time * 0.3), noise(p * 4.0 - u_time * 0.3)) * 0.15;
                
                // Kaleidoscope radial symmetry fold
                float folds = 8.0;
                p = kaleidoscope(p, folds);
                
                // Rotate slowly
                float r = u_time * 0.15;
                mat2 rot = mat2(cos(r), -sin(r), sin(r), cos(r));
                p = rot * p;
                
                // Mouse interaction mapped to Julia parameter
                vec2 m = u_mouse * 2.0 - 1.0;
                
                // Morphing Julia parameter c
                vec2 c = vec2(-0.75, 0.1) + vec2(sin(u_time * 0.2), cos(u_time * 0.3)) * 0.1 + m * 0.2;
                
                // Damage Aesthetics: VHS horizontal tearing / Broadcast signal failure
                float tear = step(0.98, hash(vec2(0.0, floor(uv.y * 60.0 + u_time * 15.0))));
                p.x += tear * 0.1 * sin(u_time * 30.0);
                
                // Damage Aesthetics: Chromatic aberration / RGB shift
                float shift = 0.02 + tear * 0.06;
                
                vec4 fR = fractal(c, p + vec2(shift, 0.0), u_time);
                vec4 fG = fractal(c, p, u_time);
                vec4 fB = fractal(c, p - vec2(shift, 0.0), u_time);
                
                vec3 color = vec3(0.0);
                
                // Escape-time Coloring
                if(fG.x > 0.0) {
                    float tR = fR.x / float(MAX_ITER);
                    float tG = fG.x / float(MAX_ITER);
                    float tB = fB.x / float(MAX_ITER);
                    
                    color.r = paletteNeon(tR * 15.0 - u_time * 2.0).r;
                    color.g = paletteNeon(tG * 15.0 - u_time * 2.0).g;
                    color.b = paletteNeon(tB * 15.0 - u_time * 2.0).b;
                    
                    // Orbit trap glow (Occult Jewel / Acid Vibration)
                    color += acidPalette(fG.y * 8.0 - u_time * 3.0) * exp(-fG.y * 15.0);
                } else {
                    // Interior (Chaos basin)
                    color = acidPalette(length(fG.zw) * 5.0 + u_time * 4.0);
                }
                
                // Enhance saturation and acid vibration
                color = pow(color, vec3(0.7));
                
                // Halftone / Print artifacts pass
                float luma = dot(color, vec3(0.299, 0.587, 0.114));
                float ht = halftone(gl_FragCoord.xy, 150.0, 45.0, luma);
                
                // Mix original color with halftone for a printed CMYK/Riso aesthetic
                color = mix(color * 0.3, color * 1.7, ht);
                
                // Add film grain / photocopy noise
                float grain = hash(uv * 1000.0 + u_time);
                color += (grain - 0.5) * 0.15;
                
                // Vignette frame
                float vignette = 1.0 - smoothstep(0.4, 1.8, length(uv));
                color *= vignette;
                
                fragColor = vec4(color, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            vertexShader,
            fragmentShader
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
    if (material.uniforms.u_time) {
        material.uniforms.u_time.value = time;
    }
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    if (material.uniforms.u_mouse) {
        const mx = mouse.x ? mouse.x / grid.width : 0.5;
        const my = mouse.y ? mouse.y / grid.height : 0.5;
        material.uniforms.u_mouse.value.set(mx, my);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);