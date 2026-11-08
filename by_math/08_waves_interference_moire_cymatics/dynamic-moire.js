try {
    if (!ctx) throw new Error("WebGL2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            context: ctx,
            alpha: true,
            antialias: false,
            preserveDrawingBuffer: true
        });
        renderer.autoClear = false;

        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();

        const camera = new THREE.Camera();
        const sceneFeedback = new THREE.Scene();
        const sceneScreen = new THREE.Scene();
        const geo = new THREE.PlaneGeometry(2, 2);

        const vs = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        const fsFeedback = `
            in vec2 vUv;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform sampler2D u_feedback;
            out vec4 fragColor;

            #define PI 3.14159265359

            float hash(vec2 p) { 
                return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); 
            }
            
            float noise(vec2 x) {
                vec2 i = floor(x); vec2 f = fract(x);
                float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            float spiral(vec2 uv, float tightness, float rotation, float arms) {
                float r = length(uv);
                float angle = atan(uv.y, uv.x);
                float spiralPhase = angle + log(r + 0.001) * tightness + rotation;
                return smoothstep(0.3, 0.7, sin(spiralPhase * arms) * 0.5 + 0.5);
            }

            float ring(vec2 uv, float freq, float offset) {
                float r = length(uv);
                return smoothstep(0.4, 0.6, sin(r * freq + offset) * 0.5 + 0.5);
            }

            void main() {
                vec2 uv = vUv;
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                
                vec2 st = (uv - 0.5) * aspect;
                vec2 mst = (u_mouse - 0.5) * aspect;

                float t = u_time * 0.5;

                // REPO 1: Chromatic RGB Moiré via CMYK Separation
                // High-frequency interference patterns driven by time and space
                
                // Cyan: Spiral Phantom counter-rotation
                vec2 centerC = st + vec2(sin(t*0.4)*0.1, cos(t*0.3)*0.1);
                float c1 = spiral(centerC, 12.0, t, 8.0);
                float c2 = spiral(centerC, 12.2, -t * 1.2, 8.0);
                float cyan = c1 * c2; 

                // Magenta: Radial rings breathing around the observer (mouse)
                vec2 centerM = st - mst * 0.5;
                float m1 = ring(centerM, 180.0, t * 4.0);
                float m2 = ring(centerM, 184.0, -t * 3.0);
                float magenta = max(m1, m2); 

                // Yellow: Wave Sinusoidal flowing across
                float y1 = sin((st.x + st.y + sin(t)*0.1) * 160.0) * 0.5 + 0.5;
                float y2 = sin((st.x - st.y + cos(t*0.8)*0.1) * 164.0) * 0.5 + 0.5;
                float yellow = smoothstep(0.2, 0.8, y1 * y2);

                // REPO 2: Acid Vibration Palette Mapping
                // Inverse subtractive mapping to create electric neon fringes
                vec3 current = vec3(1.0 - cyan, 1.0 - magenta, 1.0 - yellow);
                current = pow(current, vec3(1.8)); // Crush contrast for print feel

                // REPO 1 & 2: Temporal Feedback + Displacement Warp
                float n = noise(st * 5.0 + t);
                vec2 displace = vec2(cos(n * PI * 2.0), sin(n * PI * 2.0)) * 0.004;
                
                // Kaleidoscope fold influence on the memory buffer
                vec2 fb_uv = uv - 0.5;
                float angle = atan(fb_uv.y, fb_uv.x);
                float radius = length(fb_uv);
                float sector = PI / 3.0; // 6-fold
                float foldAngle = mod(angle, sector);
                if (foldAngle > sector * 0.5) foldAngle = sector - foldAngle;
                vec2 sym_uv = vec2(cos(foldAngle), sin(foldAngle)) * radius;
                
                // Mix standard coordinate with folded coordinate for organic fractal growth
                vec2 read_uv = mix(fb_uv, sym_uv, 0.08) * 0.992; // Slight zoom
                
                // Rotation drift
                float rotA = 0.003 * sin(t * 0.2);
                mat2 rot = mat2(cos(rotA), -sin(rotA), sin(rotA), cos(rotA));
                read_uv = rot * read_uv;

                read_uv += 0.5 + displace;

                vec3 prev = texture(u_feedback, read_uv).rgb;

                // Memory color mutation: RGB channel rotation to create chromatic beats
                prev = mix(prev, prev.brg, 0.12);

                // Resonance: feedback persists longer in bright areas
                float decay = mix(0.82, 0.98, length(current) * 0.6);
                
                vec3 finalColor = mix(current, prev, decay);

                fragColor = vec4(finalColor, 1.0);
            }
        `;

        const fsScreen = `
            in vec2 vUv;
            uniform sampler2D tDiffuse;
            uniform float u_time;
            out vec4 fragColor;

            void main() {
                vec2 uv = vUv;

                // REPO 2: Glitch Scan-Bend + CMYK Misregistration
                float glitchLine = step(0.99, fract(sin(u_time * 12.0 + uv.y * 80.0))); 
                float offset = 0.003 + glitchLine * 0.03;

                vec2 uvR = uv + vec2(offset, 0.0);
                vec2 uvG = uv;
                vec2 uvB = uv - vec2(offset, 0.0);

                float r = texture(tDiffuse, uvR).r;
                float g = texture(tDiffuse, uvG).g;
                float b = texture(tDiffuse, uvB).b;

                vec3 col = vec3(r, g, b);

                // REPO 2: Photocopy Noise / Zine Grain
                float grain = fract(sin(dot(uv * 1000.0 + u_time, vec2(127.1, 311.7))) * 43758.5453);
                
                // Soft Light Blend for paper grain
                vec3 grainVec = vec3(grain * 2.0 - 1.0);
                col = col + grainVec * (col - col * col) * 0.25;

                // Vignette Burn
                float dist = length(uv - 0.5);
                col *= smoothstep(0.85, 0.3, dist);

                // Final Contrast Punch (Risograph Ink Simulation)
                col = smoothstep(0.05, 0.95, col);

                fragColor = vec4(col, 1.0);
            }
        `;

        const matFeedback = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_feedback: { value: null }
            },
            vertexShader: vs,
            fragmentShader: fsFeedback
        });

        const matScreen = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                tDiffuse: { value: null },
                u_time: { value: 0 }
            },
            vertexShader: vs,
            fragmentShader: fsScreen
        });

        sceneFeedback.add(new THREE.Mesh(geo, matFeedback));
        sceneScreen.add(new THREE.Mesh(geo, matScreen));

        canvas.__three = { renderer, camera, sceneFeedback, sceneScreen, matFeedback, matScreen, rtA, rtB, currentRt: 0 };
    }

    const t = canvas.__three;
    const mx = mouse.x / grid.width;
    const my = mouse.y / grid.height;

    if (t.matFeedback?.uniforms) {
        t.matFeedback.uniforms.u_time.value = time;
        t.matFeedback.uniforms.u_mouse.value.set(mx, my);
        
        if (t.rtA.width !== grid.width || t.rtA.height !== grid.height) {
            t.matFeedback.uniforms.u_resolution.value.set(grid.width, grid.height);
            t.rtA.setSize(grid.width, grid.height);
            t.rtB.setSize(grid.width, grid.height);
            t.renderer.setSize(grid.width, grid.height, false);
        }
    }

    if (t.matScreen?.uniforms) {
        t.matScreen.uniforms.u_time.value = time;
    }

    const rtInput = t.currentRt === 0 ? t.rtA : t.rtB;
    const rtOutput = t.currentRt === 0 ? t.rtB : t.rtA;

    t.matFeedback.uniforms.u_feedback.value = rtInput.texture;
    t.renderer.setRenderTarget(rtOutput);
    t.renderer.render(t.sceneFeedback, t.camera);

    t.matScreen.uniforms.tDiffuse.value = rtOutput.texture;
    t.renderer.setRenderTarget(null);
    t.renderer.render(t.sceneScreen, t.camera);

    t.currentRt = 1 - t.currentRt;

} catch (e) {
    console.error("Feral Moiré System Error:", e);
}