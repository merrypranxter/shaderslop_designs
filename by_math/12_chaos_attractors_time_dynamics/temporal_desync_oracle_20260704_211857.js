if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();

        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        };

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                iResolution: { value: new THREE.Vector3(grid.width, grid.height, 1) },
                iTime: { value: 0 },
                iMouse: { value: new THREE.Vector2() },
                iMouseVel: { value: new THREE.Vector2() },
                iMouseAcc: { value: new THREE.Vector2() },
                iChannel0: { value: rtA.texture }
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

                uniform vec3 iResolution;
                uniform float iTime;
                uniform vec2 iMouse;
                uniform vec2 iMouseVel;
                uniform vec2 iMouseAcc;
                uniform sampler2D iChannel0;

                #define PI 3.14159265359
                #define TAU 6.28318530718

                // --- Predictive Lead Math (temporal_desync) ---
                vec2 predictLinear(vec2 p, vec2 v, float t) { return p + v * t; }
                vec2 predictQuadratic(vec2 p, vec2 v, vec2 a, float t) { return p + v * t + 0.5 * a * t * t; }
                vec2 predictDamped(vec2 p, vec2 v, float t) {
                    float k = 3.5;
                    float decay = (1.0 - exp(-k * t)) / k;
                    return p + v * decay;
                }

                // --- Retinotopic Geometry (phosphene_field) ---
                vec2 to_log_polar(vec2 uv, vec2 center) {
                    vec2 d = uv - center;
                    float r = max(length(d), 1e-6);
                    return vec2(log(r), atan(d.y, d.x));
                }

                // --- Color Palette (color_space_warp max saturation) ---
                vec3 neonPalette(float t) {
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.5);
                    vec3 c = vec3(1.0, 1.0, 1.0);
                    vec3 d = vec3(0.7, 0.9, 0.2); 
                    return a + b * cos(TAU * (c * t + d));
                }

                void main() {
                    vec2 uv = vUv;
                    vec2 p = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
                    vec2 m = (2.0 * iMouse - iResolution.xy) / iResolution.y;
                    
                    vec2 v = iMouseVel / iResolution.y * 2.0;
                    vec2 a = iMouseAcc / iResolution.y * 2.0;

                    float lead = 0.45;
                    vec2 pred = predictDamped(m, v, lead);
                    
                    float speed = length(v);
                    float accel = length(a);
                    float conf = exp(-lead * (0.2 + speed * 0.1 + accel * 0.02));

                    vec3 color = vec3(0.0);

                    // 1. Phosphene Geometry (locked to predicted future)
                    vec2 lp = to_log_polar(p, pred);
                    float rho = lp.x, th = lp.y;
                    
                    float spiral = sin(rho * 12.0 + th * 5.0 - iTime * 4.0);
                    float cobweb = sin(th * 16.0 + iTime * 2.0) * sin(rho * 8.0);
                    float tunnel = cos(rho * 20.0 - iTime * 6.0);
                    
                    float phosphene = smoothstep(0.4, 0.9, abs(spiral * cobweb)) + smoothstep(0.8, 1.0, tunnel) * 0.4;
                    
                    float distToPred = length(p - pred);
                    float phosMask = exp(-distToPred * 4.0);
                    vec3 phosColor = neonPalette(rho * 0.3 - iTime * 0.1 + th * 0.1) * phosphene * phosMask * conf * 2.0;
                    color += phosColor;

                    // 2. Path Checkpoints (Oracle beads)
                    for (int i = 1; i <= 6; i++) {
                        float t = float(i) / 6.0;
                        vec2 pt = predictDamped(m, v, lead * t);
                        float d = length(p - pt);
                        float bead = smoothstep(0.02, 0.005, d) * (0.3 + 0.7 * t);
                        color += vec3(0.0, 1.0, 0.8) * bead * conf; 
                    }

                    // 3. Oracle Reticle (Future)
                    float reticle = smoothstep(0.015, 0.0, abs(distToPred - 0.12)) * conf;
                    reticle += smoothstep(0.08, 0.0, distToPred) * 0.4 * conf;
                    color += vec3(1.0, 0.0, 0.8) * reticle * 2.5; 

                    // 4. Fracture / Hesitation on sudden changes
                    float shock = accel / (speed + 1e-4);
                    if (shock > 4.0) {
                        float shockFade = clamp(1.0 - shock * 0.05, 0.0, 1.0);
                        vec2 p1 = predictLinear(m, v, lead * 0.7);
                        vec2 p2 = predictQuadratic(m, v, a, lead * 1.3);
                        color += vec3(0.8, 1.0, 0.0) * smoothstep(0.03, 0.0, length(p - p1)) * shockFade;
                        color += vec3(0.0, 1.0, 1.0) * smoothstep(0.05, 0.0, length(p - p2)) * shockFade;
                        
                        float wave = smoothstep(0.02, 0.0, abs(length(p - m) - mod(iTime * 3.0, 0.6)));
                        color += vec3(1.0, 0.0, 0.0) * wave * shockFade * 0.8;
                    }

                    // 5. Present Cursor (White-hot nucleus)
                    float curDist = length(p - m);
                    float curDot = smoothstep(0.025, 0.005, curDist);
                    color += vec3(1.0, 1.0, 1.0) * curDot * 2.0;

                    // 6. Complementary Burn-in (afterimage_painter feedback)
                    vec2 dir = (p - pred);
                    float r = length(dir);
                    vec2 drift = (r > 1e-4) ? normalize(dir) * 0.003 * conf : vec2(0.0);
                    
                    vec3 prev;
                    prev.r = texture(iChannel0, uv + drift).r;
                    prev.g = texture(iChannel0, uv).g;
                    prev.b = texture(iChannel0, uv - drift).b;

                    vec3 comp = vec3(1.0) - prev;
                    float maxC = max(max(prev.r, prev.g), prev.b);
                    
                    // Oscillating complementary strobe decay
                    vec3 ghost = comp * maxC * 0.93;

                    vec3 finalColor = max(color, ghost);

                    fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        const copyScene = new THREE.Scene();
        const copyMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { tDiffuse: { value: rtB.texture } },
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                in vec2 vUv;
                out vec4 fragColor;
                void main() {
                    fragColor = texture(tDiffuse, vUv);
                }
            `
        });
        const copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
        copyScene.add(copyMesh);

        canvas.__three = { renderer, scene, camera, material, rtA, rtB, copyScene, copyMat };
        canvas.__state = {
            lastMouse: new THREE.Vector2(grid.width / 2, grid.height / 2),
            vel: new THREE.Vector2(),
            acc: new THREE.Vector2(),
            lastTime: time
        };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const { renderer, scene, camera, material, copyScene, copyMat } = canvas.__three;
const st = canvas.__state;

if (canvas.__three.rtA.width !== grid.width || canvas.__three.rtA.height !== grid.height) {
    canvas.__three.rtA.setSize(grid.width, grid.height);
    canvas.__three.rtB.setSize(grid.width, grid.height);
}

let dt = Math.max(time - st.lastTime, 0.001);
st.lastTime = time;

let mx = mouse.x;
let my = grid.height - mouse.y;

if (!mouse.isPressed && time < 3.0) {
    mx = grid.width / 2 + Math.sin(time * 2.0) * grid.width * 0.25;
    my = grid.height / 2 + Math.cos(time * 3.1) * grid.height * 0.25;
}

let curVx = (mx - st.lastMouse.x) / dt;
let curVy = (my - st.lastMouse.y) / dt;

let lastVelX = st.vel.x;
let lastVelY = st.vel.y;

st.vel.x += (curVx - st.vel.x) * 0.15;
st.vel.y += (curVy - st.vel.y) * 0.15;

let curAx = (st.vel.x - lastVelX) / dt;
let curAy = (st.vel.y - lastVelY) / dt;

st.acc.x += (curAx - st.acc.x) * 0.15;
st.acc.y += (curAy - st.acc.y) * 0.15;

st.lastMouse.x = mx;
st.lastMouse.y = my;

material.uniforms.iResolution.value.set(grid.width, grid.height, 1);
material.uniforms.iTime.value = time;
material.uniforms.iMouse.value.set(mx, my);
material.uniforms.iMouseVel.value.copy(st.vel);
material.uniforms.iMouseAcc.value.copy(st.acc);
material.uniforms.iChannel0.value = canvas.__three.rtA.texture;

renderer.setRenderTarget(canvas.__three.rtB);
renderer.render(scene, camera);

renderer.setRenderTarget(null);
copyMat.uniforms.tDiffuse.value = canvas.__three.rtB.texture;
renderer.render(copyScene, camera);

const temp = canvas.__three.rtA;
canvas.__three.rtA = canvas.__three.rtB;
canvas.__three.rtB = temp;