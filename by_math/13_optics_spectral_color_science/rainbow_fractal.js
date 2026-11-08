if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const fragmentShader = `
        precision highp float;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        out vec4 fragColor;

        #define PI 3.14159265359

        // [COLOR_SYSTEMS] OKLab to sRGB Conversion
        // Perceptually uniform color space interpolation
        vec3 oklab_to_srgb(vec3 c) {
            float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
            float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
            float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
            float l = l_ * l_ * l_;
            float m = m_ * m_ * m_;
            float s = s_ * s_ * s_;
            vec3 rgb = vec3(
                 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
            );
            vec3 srgb = vec3(
                rgb.r <= 0.0031308 ? rgb.r * 12.92 : 1.055 * pow(max(rgb.r, 0.0), 1.0/2.4) - 0.055,
                rgb.g <= 0.0031308 ? rgb.g * 12.92 : 1.055 * pow(max(rgb.g, 0.0), 1.0/2.4) - 0.055,
                rgb.b <= 0.0031308 ? rgb.b * 12.92 : 1.055 * pow(max(rgb.b, 0.0), 1.0/2.4) - 0.055
            );
            return clamp(srgb, 0.0, 1.0);
        }

        // [COLOR_FIELDS] Spectral Rainbow via OKLCh
        // Generates a perceptually uniform rainbow, avoiding HSL mud
        vec3 spectralRainbow(float t) {
            float L = 0.72; // High lightness for dream vividness
            float C = 0.28; // High chroma for "Neon Rule"
            float h = t * PI * 2.0;
            vec3 lab = vec3(L, C * cos(h), C * sin(h));
            return oklab_to_srgb(lab);
        }

        // [STRUCTURAL_COLOR] Thin-Film Interference
        // Simulates oil slick / soap bubble physics based on distance and angle
        vec3 thinFilm(float thickness, float cosTheta) {
            float n = 1.56; // Chitin / Dream-substance refractive index
            float sinThetaI2 = 1.0 - cosTheta * cosTheta;
            float sinThetaT2 = sinThetaI2 / (n * n);
            float cosThetaT = sqrt(max(0.0, 1.0 - sinThetaT2));
            float pathDiff = 2.0 * n * thickness * cosThetaT;
            vec3 phase = vec3(0.0, 0.33, 0.67);
            return 0.5 + 0.5 * cos(PI * 2.0 * (pathDiff + phase));
        }

        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // [PSYCHEDELIC_COLLAGE] Kaleidoscope Fold
        vec2 kal(vec2 uv, float folds) {
            float angle = atan(uv.y, uv.x);
            float radius = length(uv);
            float sector = PI * 2.0 / folds;
            angle = mod(angle, sector);
            angle = abs(angle - sector / 2.0);
            return vec2(cos(angle), sin(angle)) * radius;
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
            float r = length(uv);
            
            // [DREAM_PHYSICS] Mnemonic Gravity Pull
            // Space warps around a central memory well
            uv *= rot(u_time * 0.1 - r * 1.5);
            
            vec2 z = uv * 1.3;
            // Evolving Julia set coordinate
            vec2 c = vec2(sin(u_time * 0.13), cos(u_time * 0.19)) * 0.65;
            
            float trap1 = 100.0;
            float trap2 = 100.0;
            float smooth_n = 0.0;
            
            // [FRACTALS] Escape-Time + Domain Warping
            for(int i = 0; i < 28; i++) {
                // The Ocean / Math: FBM warp inside the fractal iteration
                z += vec2(sin(z.y * 2.5 + u_time * 0.5), cos(z.x * 2.5 - u_time * 0.5)) * 0.06;
                
                // Complex squaring
                z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
                
                // Identity Topology: Kaleidoscope folding at each step
                z = kal(z, 6.0 + 2.0 * sin(u_time * 0.08));
                
                trap1 = min(trap1, length(z));
                trap2 = min(trap2, abs(z.x + z.y));
                
                if(dot(z, z) > 16.0) {
                    smooth_n = float(i) - log2(log2(dot(z, z))) + 4.0;
                    break;
                }
                smooth_n = float(i);
            }
            
            // Calculate structural thickness based on orbit traps
            float thickness = trap1 * 1.8 + smooth_n * 0.05 - u_time * 0.4;
            float angle = abs(sin(r * PI + u_time * 0.5));
            
            // Synthesize Structural Color and Perceptual Rainbow
            vec3 iridescence = thinFilm(thickness, angle);
            vec3 rainbow = spectralRainbow(smooth_n * 0.03 - u_time * 0.15 + trap2 * 0.6);
            
            // Cyberdelic Neon blend
            vec3 col = mix(iridescence, rainbow, 0.7);
            
            // Phosphor Bloom (bright glowing core traces)
            col += spectralRainbow(u_time * 0.25 + trap1) * exp(-trap1 * 5.0) * 1.5;
            
            // [VISUAL_BIBLE] The Void Rule
            // Background is always near-black void.
            float mask = smoothstep(0.0, 24.0, smooth_n);
            col *= mask;
            
            // [DAMAGE_AESTHETICS] Glitch / Chromatic Aberration
            float glitch = exp(-trap2 * 12.0) * 0.6;
            col.r += glitch * spectralRainbow(smooth_n * 0.03 - u_time * 0.15 + 0.15).r;
            col.b += glitch * spectralRainbow(smooth_n * 0.03 - u_time * 0.15 - 0.15).b;
            
            // Deepen shadows and apply vignette
            col = pow(col, vec3(1.1)); 
            col *= 1.0 - smoothstep(0.6, 1.8, r);
            
            fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                void main() {
                    gl_Position = vec4(position, 1.0);
                }
            `,
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
if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);