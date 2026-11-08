if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.autoClear = false;
        
        const rtOpts = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const rtCore = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
        const rtHistoryA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
        const rtHistoryB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        scene.add(quad);
        
        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;
        
        const coreFrag = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            #define PI 3.14159265359
            #define TAU 6.28318530718
            
            // Complex arithmetic
            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
            vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b)+1e-12; return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
            vec2 cexp(vec2 z) { return exp(z.x)*vec2(cos(z.y), sin(z.y)); }
            vec2 cpow(vec2 z, float n) { float r=length(z); float th=atan(z.y, z.x); return pow(r,n)*vec2(cos(n*th), sin(n*th)); }
            
            // Noise & Hashing
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
                return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
            }
            float fbm(vec2 p) {
                float f = 0.0, a = 0.5;
                for(int i=0; i<5; i++) { f += a*noise(p); p*=2.01; a*=0.5; }
                return f;
            }
            
            void main() {
                vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
                vec2 p = (vUv - 0.5) * aspect;
                
                // Motion: foveal breathing & tremor
                float breath = 1.0 + 0.12 * sin(u_time * 0.4);
                vec2 tremor = vec2(noise(vec2(u_time*2.5)), noise(vec2(u_time*2.5+10.0))) * 0.015;
                vec2 center = vec2(0.0) + tremor;
                
                // Retinotopic log-polar mapping
                vec2 d = p - center;
                float r = max(length(d), 1e-6);
                vec2 lp = vec2(log(r) * breath, atan(d.y, d.x));
                
                // Floating point dementia & pressure pulses
                float pulse = exp(-fract(u_time * 0.15) * 4.0);
                float r_dist = length(p);
                float dementia = smoothstep(0.4, 1.2, r_dist) * pulse;
                
                if (dementia > 0.05) {
                    float bits = mix(23.0, 2.0, dementia);
                    float step_sz = exp2(-bits);
                    lp = floor(lp / step_sz + 0.5) * step_sz;
                }
                
                // Domain Coloring layer: f(z) = (z^5 - 1) / (z^3 + c)
                vec2 z = lp * 1.5;
                vec2 c = vec2(0.6 * cos(u_time*0.22), 0.6 * sin(u_time*0.31));
                vec2 num = cpow(z, 5.0) - vec2(1.0, 0.0);
                vec2 den = cpow(z, 3.0) + c;
                vec2 w = cdiv(num, den);
                
                float phase = atan(w.y, w.x);
                float mag = length(w);
                float logmag = log(mag + 1.0);
                
                // Klüver Form Constants
                float chirality = sin(u_time * 0.35); // Chirality flip
                float cobweb = sin(lp.x * 14.0 + phase * 2.0) * sin(lp.y * 20.0);
                float tunnel = sin(lp.x * 12.0 + 4.0 * chirality * lp.y - u_time * 2.5);
                float spiral = sin(lp.x * 6.0 + 8.0 * lp.y + u_time * 3.0);
                float grid = sin(lp.x * 22.0) * sin(lp.y * 22.0);
                
                // Morphing
                float m1 = fbm(lp * 0.3 + u_time * 0.1);
                float m2 = fbm(lp * 0.5 - u_time * 0.15);
                float form = mix(mix(cobweb, tunnel, m1), mix(spiral, grid, m1), m2);
                
                // Phase contours (tinting)
                float phase_contour = smoothstep(0.85, 1.0, sin(phase * 6.0));
                form *= (1.0 + phase_contour * 0.7);
                
                // Chromostereopsis Depth Map
                float depth_val = fract(logmag * 1.2 + form * 0.4 - u_time * 0.4);
                vec3 color_near = vec3(1.0, 0.0, 0.35); // Hot pink / red
                vec3 color_mid  = vec3(0.5, 0.0, 1.0);  // Violet transition
                vec3 color_far  = vec3(0.0, 0.8, 1.0);  // Cyan / blue
                
                vec3 base_color;
                if (depth_val < 0.5) {
                    base_color = mix(color_near, color_mid, depth_val * 2.0);
                } else {
                    base_color = mix(color_mid, color_far, (depth_val - 0.5) * 2.0);
                }
                
                // False color UV/IR accents
                vec3 acid = vec3(0.7, 1.0, 0.0) * phase_contour * smoothstep(0.4, 1.0, form);
                base_color += acid;
                
                // Enforce max saturation for chromostereopsis
                float maxC = max(base_color.r, max(base_color.g, base_color.b));
                if (maxC > 0.0) base_color /= maxC;
                
                // Spectral burns (wet light)
                float spec = pow(sin(phase * 12.0 + u_time * 3.0) * 0.5 + 0.5, 40.0);
                base_color += vec3(1.0, 0.95, 0.7) * spec * (0.5 + pulse * 1.5);
                
                // NaN Dementia Cracks
                float crack = smoothstep(0.8, 1.0, fbm(lp * 18.0));
                if (dementia > 0.4 && crack > 0.5) {
                    base_color = vec3(0.7, 0.0, 1.0) * (0.6 + 0.4*sin(u_time*30.0));
                }
                
                // Intensity shaping & foveal windowing
                float intensity = smoothstep(0.05, 0.8, abs(form)) * (0.7 + pulse * 0.8);
                float fovea_mask = smoothstep(0.005, 0.06, r) * (1.0 - smoothstep(1.0, 1.8, r));
                
                vec3 final_color = base_color * intensity * fovea_mask;
                
                // Luxurious dark background wash
                vec3 bg = vec3(0.02, 0.0, 0.05) * (1.0 - r_dist);
                final_color = mix(bg, final_color, smoothstep(0.0, 0.2, intensity * fovea_mask));
                
                fragColor = vec4(final_color, 1.0);
            }
        `;
        
        const feedbackFrag = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform sampler2D u_core;
            uniform sampler2D u_history;
            uniform float u_time;
            
            void main() {
                vec3 current = texture(u_core, vUv).rgb;
                vec3 history = texture(u_history, vUv).rgb;
                
                float dt = 0.016;
                float burnRate = 2.5;
                vec3 new_history = history + burnRate * current * dt;
                
                float tau = 6.0; // 6 seconds lingering
                new_history *= exp(-dt / tau);
                new_history = clamp(new_history, 0.0, 1.0);
                
                fragColor = vec4(new_history, 1.0);
            }
        `;
        
        const compositeFrag = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform sampler2D u_core;
            uniform sampler2D u_history;
            uniform vec2 u_resolution;
            
            vec3 getCombined(vec2 uv) {
                vec3 c = texture(u_core, uv).rgb;
                vec3 h = texture(u_history, uv).rgb;
                
                // Afterimage ghost: complement of history
                vec3 complement = vec3(1.0) - h;
                
                float adaptStrength = max(h.r, max(h.g, h.b));
                float currentCoverage = max(c.r, max(c.g, c.b));
                
                vec3 ghost = complement * adaptStrength * (1.0 - currentCoverage) * 2.0;
                return clamp(c + ghost, 0.0, 1.0);
            }
            
            void main() {
                vec2 dir = vUv - 0.5;
                float r2 = dot(dir, dir);
                
                vec3 base = getCombined(vUv);
                float brightness = max(base.r, max(base.g, base.b));
                
                // Chromatic Aberration & Prism Dispersion
                float ca_amt = 0.015 * r2 * brightness;
                
                float r = getCombined(vUv + dir * ca_amt * 1.2).r;
                float g = base.g;
                float b = getCombined(vUv - dir * ca_amt * 1.5).b;
                
                vec3 color = vec3(r, g, b);
                
                // Vignette
                color *= 1.0 - 0.4 * r2;
                
                fragColor = vec4(color, 1.0);
            }
        `;
        
        const matCore = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader, fragmentShader: coreFrag,
            uniforms: { u_time: { value: 0 }, u_resolution: { value: new THREE.Vector2() } }
        });
        
        const matFeedback = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader, fragmentShader: feedbackFrag,
            uniforms: { u_core: { value: null }, u_history: { value: null }, u_time: { value: 0 } }
        });
        
        const matComposite = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader, fragmentShader: compositeFrag,
            uniforms: { u_core: { value: null }, u_history: { value: null }, u_resolution: { value: new THREE.Vector2() } }
        });
        
        canvas.__three = {
            renderer, scene, camera, quad,
            rtCore, rtHistoryA, rtHistoryB,
            matCore, matFeedback, matComposite
        };
    } catch(e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const t = canvas.__three;
t.renderer.setSize(grid.width, grid.height, false);

t.matCore.uniforms.u_time.value = time;
t.matCore.uniforms.u_resolution.value.set(grid.width, grid.height);

// 1. Render Core
t.quad.material = t.matCore;
t.renderer.setRenderTarget(t.rtCore);
t.renderer.render(t.scene, t.camera);

// 2. Render Feedback
t.matFeedback.uniforms.u_time.value = time;
t.matFeedback.uniforms.u_core.value = t.rtCore.texture;
t.matFeedback.uniforms.u_history.value = t.rtHistoryA.texture;
t.quad.material = t.matFeedback;
t.renderer.setRenderTarget(t.rtHistoryB);
t.renderer.render(t.scene, t.camera);

// 3. Composite to screen
t.matComposite.uniforms.u_resolution.value.set(grid.width, grid.height);
t.matComposite.uniforms.u_core.value = t.rtCore.texture;
t.matComposite.uniforms.u_history.value = t.rtHistoryB.texture;
t.quad.material = t.matComposite;
t.renderer.setRenderTarget(null);
t.renderer.render(t.scene, t.camera);

// Swap history buffers
const temp = t.rtHistoryA;
t.rtHistoryA = t.rtHistoryB;
t.rtHistoryB = temp;