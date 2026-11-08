const FVD_ORACLE_UI_ID = 'fvd-oracle-ui';

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const copyScene = new THREE.Scene();

        // Ping-pong buffers for temporal feedback
        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false
        };
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                iResolution: { value: new THREE.Vector3(grid.width, grid.height, 1) },
                iTime: { value: 0 },
                iMouse: { value: new THREE.Vector4() },
                iMouseVel: { value: new THREE.Vector2() },
                iMouseAcc: { value: new THREE.Vector2() },
                iChannel0: { value: rtA.texture },
                uLeadTime: { value: 0.4 },
                uPredictionModel: { value: 2 },
                uGhostOpacity: { value: 0.8 },
                uPhospheneDensity: { value: 1.0 },
                uAfterimageDecay: { value: 0.95 }
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
                out vec4 fragColor;
                in vec2 vUv;
                
                uniform vec3 iResolution;
                uniform float iTime;
                uniform vec4 iMouse;
                uniform vec2 iMouseVel;
                uniform vec2 iMouseAcc;
                uniform sampler2D iChannel0;
                
                uniform float uLeadTime;
                uniform int uPredictionModel;
                uniform float uGhostOpacity;
                uniform float uPhospheneDensity;
                uniform float uAfterimageDecay;

                #define PI 3.14159265359
                #define TAU 6.28318530718

                // High-saturation neon palette
                vec3 neon(float t) {
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.5);
                    vec3 c = vec3(1.0, 1.0, 1.0);
                    vec3 d = vec3(0.0, 0.33, 0.67);
                    vec3 col = a + b * cos(TAU * (c * t + d));
                    
                    // Push saturation extremely high
                    float maxC = max(col.r, max(col.g, col.b));
                    if (maxC > 0.0) col /= maxC; 
                    return clamp(col * 1.2, 0.0, 1.0);
                }

                vec2 predict(int model, vec2 p, vec2 v, vec2 a, float t) {
                    if (model == 0) return p + v * t;
                    if (model == 1) return p + v * t + 0.5 * a * t * t;
                    // Damped prediction (prevents infinite overshoot)
                    float k = 4.0;
                    return p + v * ((1.0 - exp(-k * t)) / k);
                }
                
                float confidence(vec2 v, float t) {
                    float speed = length(v);
                    return exp(-t * (1.0 + speed * 0.25));
                }

                vec2 to_log_polar(vec2 uv, vec2 center) {
                    vec2 d = uv - center;
                    float r = max(length(d), 1e-6);
                    return vec2(log(r), atan(d.y, d.x));
                }

                void main() {
                    vec2 p = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
                    vec2 uv = gl_FragCoord.xy / iResolution.xy;
                    float aspect = iResolution.x / iResolution.y;
                    
                    vec2 m = (iMouse.xy * 2.0 - iResolution.xy) / iResolution.y;
                    vec2 v = iMouseVel / iResolution.y * 2.0;
                    vec2 a = iMouseAcc / iResolution.y * 2.0;
                    
                    // Feral idle animation
                    if (iMouse.z <= 0.0 && length(v) < 0.01 && length(a) < 0.01) {
                        float t = iTime * 1.5;
                        m = vec2(cos(t * 0.8), sin(t * 1.1)) * 0.5;
                        v = vec2(-sin(t * 0.8)*0.8, cos(t * 1.1)*1.1) * 0.5 * 1.5;
                        a = vec2(-cos(t * 0.8)*0.64, -sin(t * 1.1)*1.21) * 0.5 * 2.25;
                    }

                    vec2 pred = predict(uPredictionModel, m, v, a, uLeadTime);
                    float conf = confidence(v, uLeadTime);
                    
                    float speed = length(v);
                    float accel = length(a);
                    
                    // Shock detection: high acceleration or aggressive braking
                    float braking = smoothstep(0.0, -15.0, dot(v, a));
                    float shock = smoothstep(8.0, 25.0, accel) + braking * smoothstep(2.0, 12.0, speed);
                    shock = clamp(shock, 0.0, 1.0);
                    
                    vec3 col = vec3(0.0);
                    
                    // 1. Phosphene Field (locks onto the predicted ghost)
                    vec2 lp = to_log_polar(p, pred);
                    float rho = lp.x;
                    float th = lp.y;
                    
                    float tunnel = sin(rho * 14.0 * uPhospheneDensity - iTime * 5.0);
                    float spiral = sin(rho * 5.0 * uPhospheneDensity + th * 5.0 - iTime * 3.0);
                    float cobweb = sin(th * 14.0) * sin(rho * 9.0);
                    
                    float phosphene = tunnel * spiral * cobweb;
                    float window = exp(-abs(rho + 0.6) * 1.8) * smoothstep(0.0, 0.15, length(p - pred));
                    
                    vec3 phosColor = neon(rho * 0.15 - iTime * 0.2 + 0.5);
                    col += phosColor * abs(phosphene) * window * uGhostOpacity * conf * 0.9;
                    
                    // 2. Future Path Checkpoints
                    const int STEPS = 10;
                    for(int i = 1; i <= STEPS; i++) {
                        float ft = uLeadTime * float(i) / float(STEPS);
                        vec2 fpos = predict(uPredictionModel, m, v, a, ft);
                        float fconf = confidence(v, ft);
                        float d = length(p - fpos);
                        float bead = smoothstep(0.025, 0.005, d);
                        col += neon(ft * 2.0 - iTime) * bead * fconf * uGhostOpacity * 0.7;
                    }
                    
                    // 3. Oracle Reticle
                    float dPred = length(p - pred);
                    float reticle = smoothstep(0.09, 0.07, dPred) * smoothstep(0.05, 0.07, dPred);
                    vec3 oracleBaseCol = neon(iTime * 0.4);
                    col += oracleBaseCol * reticle * uGhostOpacity * (0.3 + 0.7 * conf);
                    col += oracleBaseCol * exp(-dPred * 12.0) * 0.45 * conf * uGhostOpacity; // Bloom
                    
                    // Fractured Guesses on sudden stop
                    if (shock > 0.01) {
                        for(int i = 1; i <= 4; i++) {
                            float ang = float(i) * TAU / 4.0 + iTime * 4.0;
                            vec2 fOff = vec2(cos(ang), sin(ang)) * shock * 0.25;
                            float dFrac = length(p - (pred + fOff));
                            float fracRing = smoothstep(0.05, 0.02, dFrac) * smoothstep(0.01, 0.02, dFrac);
                            col += neon(float(i)*0.3) * fracRing * shock * uGhostOpacity * 1.2;
                        }
                    }
                    
                    // 4. Present Cursor (White-hot nucleus)
                    float dCur = length(p - m);
                    float nucleus = smoothstep(0.025, 0.002, dCur);
                    float nucBloom = exp(-dCur * 35.0) * 0.9;
                    col += vec3(1.0) * nucleus + oracleBaseCol * nucBloom;
                    
                    // 5. Causal Shockwave
                    float swRing = abs(length(p - m) - shock * 0.6);
                    col += vec3(1.0, 0.2, 0.6) * smoothstep(0.04, 0.005, swRing) * shock;
                    
                    // 6. Feedback & Complementary Burn-in Scars
                    // Chromatic aberration warp on feedback driven by shock
                    vec2 uvR = uv - (p - pred) * 0.003 * shock;
                    vec2 uvB = uv + (p - pred) * 0.003 * shock;
                    
                    vec4 prev = texture(iChannel0, uv);
                    float histR = texture(iChannel0, uvR).r;
                    float histG = prev.g;
                    float histB = texture(iChannel0, uvB).b;
                    
                    vec3 history = vec3(histR, histG, histB) * uAfterimageDecay;
                    
                    // Additive CMY inversion scar when oracle overshoots
                    vec3 compCol = vec3(1.0) - oracleBaseCol;
                    compCol = clamp(compCol * 1.8, 0.0, 1.0);
                    
                    float burn = reticle * shock * 1.8;
                    history = max(history, compCol * burn);
                    
                    fragColor = vec4(col + history, 1.0);
                }
            `
        });

        const copyMaterial = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: null } },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`
        });

        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
        copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial));

        // UI Generation
        let uiContainer = document.getElementById(FVD_ORACLE_UI_ID);
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = FVD_ORACLE_UI_ID;
            uiContainer.style.cssText = "position:absolute; top:15px; left:15px; color:#fff; font-family:monospace; background:rgba(5,5,10,0.85); padding:15px; border-radius:4px; border:1px solid #333; z-index:100; pointer-events:auto; width:220px; text-transform:uppercase;";
            uiContainer.innerHTML = `<h3 style="margin:0 0 15px 0; font-size:13px; color:#ff00ff; letter-spacing:1px;">Predictive Oracle</h3>`;
            
            function createSlider(label, id, min, max, step, val) {
                const wrap = document.createElement('div');
                wrap.style.marginBottom = "12px";
                wrap.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:6px; color:#aaa;">
                        <span>${label}</span><span id="${id}-val">${val}</span>
                    </div>
                    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%; cursor:pointer; accent-color:#0ff;">
                `;
                uiContainer.appendChild(wrap);
                setTimeout(() => {
                    const input = document.getElementById(id);
                    const valDisp = document.getElementById(`${id}-val`);
                    input.addEventListener('input', () => valDisp.textContent = input.value);
                }, 0);
            }
            
            createSlider("Lead Time", "sld-lead", 0.0, 1.5, 0.01, 0.4);
            createSlider("Model (0=Lin,1=Quad,2=Dmp)", "sld-model", 0, 2, 1, 2);
            createSlider("Ghost Opacity", "sld-ghost", 0.0, 1.0, 0.01, 0.8);
            createSlider("Phosphene Density", "sld-phos", 0.1, 2.0, 0.01, 1.0);
            createSlider("Afterimage Decay", "sld-decay", 0.80, 0.99, 0.01, 0.95);
            
            uiContainer.addEventListener('mousedown', e => e.stopPropagation());
            uiContainer.addEventListener('mousemove', e => e.stopPropagation());
            document.body.appendChild(uiContainer);
        }

        canvas.__three = { 
            renderer, scene, copyScene, camera, material, copyMaterial, rtA, rtB,
            mouse: { x: grid.width/2, y: grid.height/2, z: 0 },
            lastMouse: { x: grid.width/2, y: grid.height/2 },
            vel: { x: 0, y: 0 }, lastVel: { x: 0, y: 0 },
            acc: { x: 0, y: 0 },
            lastTime: time
        };

        const updateMouse = (e) => {
            const rect = canvas.getBoundingClientRect();
            canvas.__three.mouse.x = e.clientX - rect.left;
            canvas.__three.mouse.y = grid.height - (e.clientY - rect.top);
        };
        
        canvas.addEventListener('mousemove', updateMouse);
        canvas.addEventListener('mousedown', (e) => { updateMouse(e); canvas.__three.mouse.z = 1; });
        canvas.addEventListener('mouseup', () => { canvas.__three.mouse.z = 0; });
        canvas.addEventListener('mouseleave', () => { canvas.__three.mouse.z = 0; });

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const t = canvas.__three;
t.renderer.setSize(grid.width, grid.height, false);

// Motion tracking & EMA
let dt = Math.max(time - t.lastTime, 0.001);
t.lastTime = time;

let targetVx = (t.mouse.x - t.lastMouse.x) / dt;
let targetVy = (t.mouse.y - t.lastMouse.y) / dt;
t.lastMouse.x = t.mouse.x;
t.lastMouse.y = t.mouse.y;

t.vel.x += (targetVx - t.vel.x) * 0.15;
t.vel.y += (targetVy - t.vel.y) * 0.15;

let targetAx = (t.vel.x - t.lastVel.x) / dt;
let targetAy = (t.vel.y - t.lastVel.y) / dt;
t.lastVel.x = t.vel.x;
t.lastVel.y = t.vel.y;

t.acc.x += (targetAx - t.acc.x) * 0.1;
t.acc.y += (targetAy - t.acc.y) * 0.1;

// Sync uniforms
const u = t.material.uniforms;
u.iResolution.value.set(grid.width, grid.height, 1);
u.iTime.value = time;
u.iMouse.value.set(t.mouse.x, t.mouse.y, t.mouse.z, 0);
u.iMouseVel.value.set(t.vel.x, t.vel.y);
u.iMouseAcc.value.set(t.acc.x, t.acc.y);

const uiLead = document.getElementById('sld-lead');
if (uiLead) {
    u.uLeadTime.value = parseFloat(uiLead.value);
    u.uPredictionModel.value = parseInt(document.getElementById('sld-model').value);
    u.uGhostOpacity.value = parseFloat(document.getElementById('sld-ghost').value);
    u.uPhospheneDensity.value = parseFloat(document.getElementById('sld-phos').value);
    u.uAfterimageDecay.value = parseFloat(document.getElementById('sld-decay').value);
}

// 1. Render main scene to rtB
u.iChannel0.value = t.rtA.texture;
t.renderer.setRenderTarget(t.rtB);
t.renderer.render(t.scene, t.camera);

// 2. Copy rtB to screen
t.copyMaterial.uniforms.tDiffuse.value = t.rtB.texture;
t.renderer.setRenderTarget(null);
t.renderer.render(t.copyScene, t.camera);

// 3. Swap buffers
let temp = t.rtA;
t.rtA = t.rtB;
t.rtB = temp;