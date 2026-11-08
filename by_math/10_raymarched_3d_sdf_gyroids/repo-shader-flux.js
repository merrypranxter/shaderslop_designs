/**
 * THE WEIRD CODE GUY - "Cymatic Lace in a Shoegaze Moiré Field"
 * 
 * REPO GENOME INJECTION:
 * 1. THE-LISTS: Domain 16 (Minimal Surfaces) -> Gyroid base topology.
 * 2. LACE PATTERNS: Negative space topology -> Sine-cut holes in the gyroid.
 * 3. CYMATICS SACRED: Bessel function standing waves -> Radial ripple perturbations.
 * 4. MOIRÉ: Chromatic RGB spatial interference + Temporal feedback loops.
 * 5. COLOR SYSTEMS: Golden Angle (137.5°) hue distribution mapped through OKLCh perceptual space.
 * 6. SHOEGAZE STYLE / DAMAGE: Post-processing stack (Halation bloom, VHS chroma bleed, phase warp, macroblocking, film grain).
 * 7. ROCOCO: Asymmetric sine-scroll spatial warping.
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1.0); // Force 1.0 for consistent moire/scanlines
        
        const sceneBase = new THREE.Scene();
        const scenePost = new THREE.Scene();
        const sceneScreen = new THREE.Scene();

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // --- BASE PASS: RAYMARCHED CYMATIC GYROID ---
        const matBase = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0, 0) },
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
                uniform vec2 u_mouse;
                uniform vec2 u_resolution;

                // COLOR SYSTEMS: OKLCh to sRGB conversion for perceptually uniform neon colors
                vec3 oklch_to_srgb(vec3 lch) {
                    float L = lch.x; float C = lch.y; float h = lch.z * 3.14159265 / 180.0;
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

                    return vec3(
                        rgb.r <= 0.0031308 ? rgb.r * 12.92 : 1.055 * pow(max(rgb.r, 0.0), 1.0/2.4) - 0.055,
                        rgb.g <= 0.0031308 ? rgb.g * 12.92 : 1.055 * pow(max(rgb.g, 0.0), 1.0/2.4) - 0.055,
                        rgb.b <= 0.0031308 ? rgb.b * 12.92 : 1.055 * pow(max(rgb.b, 0.0), 1.0/2.4) - 0.055
                    );
                }

                // THE-LISTS & CYMATICS & LACE: Spatial mapping
                float map(vec3 p) {
                    vec3 bp = p;
                    // Interaction: Mouse perturbs the spatial field
                    p.xy += u_mouse * 2.0;
                    
                    // Temporal rotation
                    float t = u_time * 0.2;
                    mat2 rot = mat2(cos(t), -sin(t), sin(t), cos(t));
                    p.xy *= rot;
                    p.yz *= rot;

                    // 1. THE-LISTS: Minimal Surface (Gyroid)
                    float scale = 3.0;
                    float gyroid = dot(sin(p * scale), cos(p.zxy * scale)) / scale;

                    // 2. CYMATICS SACRED: Bessel-approx standing wave (Faraday/Chladni)
                    float r = length(bp.xy);
                    float theta = atan(bp.y, bp.x);
                    float cymatic = sin(8.0 * r - u_time * 4.0) * cos(5.0 * theta) * 0.15;

                    // 3. ROCOCO: Asymmetric scroll warping
                    float rococo = sin(p.x * 2.5 + sin(p.y * 3.5)) * 0.08;

                    // Base distance (Thickness of the "Lace")
                    float d = abs(gyroid + cymatic + rococo) - 0.06;

                    // 4. LACE PATTERNS: Negative space topology (cutting holes)
                    float holes = sin(p.x * 12.0) * sin(p.y * 12.0) * sin(p.z * 12.0);
                    d = max(d, holes - 0.3); // Intersection to carve out voids

                    // Bound to a sphere to keep it visible
                    d = max(d, length(bp) - 3.0);

                    return d;
                }

                vec3 calcNormal(vec3 p) {
                    vec2 e = vec2(0.002, 0.0);
                    return normalize(vec3(
                        map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)
                    ));
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;

                    vec3 ro = vec3(0.0, 0.0, 4.5);
                    vec3 rd = normalize(vec3(uv, -1.0));

                    float t = 0.0;
                    float max_t = 8.0;
                    vec3 p;
                    for(int i = 0; i < 64; i++) {
                        p = ro + rd * t;
                        float d = map(p);
                        if(d < 0.001 || t > max_t) break;
                        t += d * 0.65; // Slow down step for complex boolean geometry
                    }

                    vec3 col = vec3(0.01, 0.0, 0.03); // Deep void

                    if(t < max_t) {
                        vec3 n = calcNormal(p);
                        
                        // COLOR SYSTEMS: Golden Angle hue sequencing
                        float idx = floor(length(p) * 5.0 - u_time);
                        float hue = mod(idx * 137.507764, 360.0);
                        
                        // Vivid neon palette via OKLCh
                        float L = 0.6 + 0.3 * dot(n, normalize(vec3(1.0, 1.0, 1.0)));
                        float C = 0.38; // Max chroma for eye-bleeding saturation
                        vec3 baseCol = oklch_to_srgb(vec3(L, C, hue));

                        // MOIRÉ: Chromatic RGB Spatial Interference
                        float mr = sin(p.x * 60.0 + u_time) * sin(p.y * 60.0);
                        float mg = sin(p.x * 62.0 + u_time) * sin(p.y * 62.0);
                        float mb = sin(p.x * 64.0 + u_time) * sin(p.y * 64.0);
                        vec3 moire = vec3(mr, mg, mb) * 0.5 + 0.5;

                        col = baseCol * (0.4 + moire * 1.5) * (1.2 - t * 0.15);

                        // Rim lighting
                        float rim = 1.0 - max(dot(n, -rd), 0.0);
                        col += vec3(0.0, 1.0, 0.8) * pow(rim, 4.0);
                    }

                    fragColor = vec4(col, 1.0);
                }
            `
        });
        const meshBase = new THREE.Mesh(geometry, matBase);
        sceneBase.add(meshBase);

        // --- POST PASS: SHOEGAZE / DAMAGE / MOIRÉ FEEDBACK ---
        const matPost = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                t_base: { value: null },
                t_prev: { value: null },
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
                
                uniform sampler2D t_base;
                uniform sampler2D t_prev;
                uniform float u_time;
                uniform vec2 u_resolution;

                void main() {
                    // SHOEGAZE: Phase Warp (UV perturbation)
                    vec2 warpUv = vUv;
                    warpUv.y += sin(vUv.x * 15.0 + u_time) * 0.003;

                    // DAMAGE: VHS Chroma Bleed / Misregistration
                    float bleed = 0.008 * sin(vUv.y * 40.0 - u_time * 8.0);
                    float r = texture(t_base, warpUv + vec2(bleed, 0.0)).r;
                    float g = texture(t_base, warpUv).g;
                    float b = texture(t_base, warpUv - vec2(bleed, 0.0)).b;
                    vec3 base = vec3(r, g, b);

                    // SHOEGAZE: Halation Bloom (Threshold + 9-tap blur approx)
                    float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
                    vec3 bloom = max(vec3(0.0), base - 0.5) * 2.0;
                    vec2 off = vec2(0.006, 0.006);
                    bloom += texture(t_base, warpUv + off).rgb;
                    bloom += texture(t_base, warpUv - off).rgb;
                    bloom += texture(t_base, warpUv + vec2(-off.x, off.y)).rgb;
                    bloom += texture(t_base, warpUv + vec2(off.x, -off.y)).rgb;
                    bloom *= 0.15;
                    // Warm magenta/orange film overspill
                    base += bloom * vec3(1.0, 0.2, 0.5) * 1.5; 

                    // MOIRÉ: Temporal Feedback (Pause/Warp/Echo)
                    // Zoom out slightly to create a cascading infinite tunnel
                    vec2 prevUv = (vUv - 0.5) * 0.95 + 0.5; 
                    // Drift
                    prevUv.x += sin(vUv.y * 4.0 + u_time) * 0.005; 
                    vec3 prev = texture(t_prev, prevUv).rgb;

                    // SHOEGAZE: "Wall of Texture" mixing
                    vec3 final = mix(base, prev, 0.88); // Heavy temporal persistence

                    // DAMAGE: Macroblocking & Data Dropout
                    vec2 blockUv = floor(vUv * 48.0) / 48.0;
                    float blockNoise = fract(sin(dot(blockUv, vec2(12.9898, 78.233))) * 43758.5);
                    if (lum < 0.3 && blockNoise > 0.92) {
                        final *= 0.4; // Darken blocks
                    }

                    // SHOEGAZE: Film Grain Clumps
                    float grain = fract(sin(dot(vUv * u_time, vec2(17.1, 31.7))) * 1234.5);
                    final += (grain - 0.5) * 0.12;

                    // DAMAGE: CRT Scanlines
                    final *= 0.9 + 0.1 * sin(vUv.y * u_resolution.y * 0.5);

                    fragColor = vec4(final, 1.0);
                }
            `
        });
        const meshPost = new THREE.Mesh(geometry, matPost);
        scenePost.add(meshPost);

        // --- SCREEN PASS (Draw final RT to screen) ---
        const matScreen = new THREE.MeshBasicMaterial({ map: null });
        const meshScreen = new THREE.Mesh(geometry, matScreen);
        sceneScreen.add(meshScreen);

        // Render targets for ping-pong feedback
        const rtBase = new THREE.WebGLRenderTarget(grid.width, grid.height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
        let rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
        let rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });

        canvas.__three = { renderer, sceneBase, scenePost, sceneScreen, camera, matBase, matPost, matScreen, rtBase, rtA, rtB };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, sceneBase, scenePost, sceneScreen, camera, matBase, matPost, matScreen, rtBase } = canvas.__three;
let { rtA, rtB } = canvas.__three;

// Handle Resizing
if (renderer.getSize(new THREE.Vector2()).width !== grid.width || renderer.getSize(new THREE.Vector2()).height !== grid.height) {
    renderer.setSize(grid.width, grid.height, false);
    rtBase.setSize(grid.width, grid.height);
    rtA.setSize(grid.width, grid.height);
    rtB.setSize(grid.width, grid.height);
    matBase.uniforms.u_resolution.value.set(grid.width, grid.height);
    matPost.uniforms.u_resolution.value.set(grid.width, grid.height);
}

// Update Uniforms
matBase.uniforms.u_time.value = time;
matPost.uniforms.u_time.value = time;

// Normalize mouse to [-1, 1]
if (mouse.isPressed) {
    matBase.uniforms.u_mouse.value.set(
        (mouse.x / grid.width) * 2 - 1,
        -(mouse.y / grid.height) * 2 + 1
    );
} else {
    // Gentle auto-drift
    matBase.uniforms.u_mouse.value.lerp(new THREE.Vector2(Math.sin(time*0.5)*0.2, Math.cos(time*0.4)*0.2), 0.05);
}

// --- RENDER PIPELINE ---

// 1. Render Base Geometry
renderer.setRenderTarget(rtBase);
renderer.render(sceneBase, camera);

// 2. Setup Post-Processing Inputs
matPost.uniforms.t_base.value = rtBase.texture;
matPost.uniforms.t_prev.value = rtB.texture; // The feedback from last frame

// 3. Render Post-Processing (Shoegaze/Damage + Feedback)
renderer.setRenderTarget(rtA);
renderer.render(scenePost, camera);

// 4. Render to Screen
matScreen.map = rtA.texture;
renderer.setRenderTarget(null);
renderer.render(sceneScreen, camera);

// 5. Swap Ping-Pong Buffers
canvas.__three.rtA = rtB;
canvas.__three.rtB = rtA;