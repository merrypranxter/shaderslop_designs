/**
 * THE WEIRD CODE GUY
 * [MODULE: KIYOSHI-ABSORBER-V1 + ALCHEMICAL SCRIPTURE + REPO GENOME]
 * 
 * HYBRID SYSTEM: Temporal Desync (Predictive Oracle) x Phosphene Field (Retinotopic V1) x Afterimage Painter (Complementary Scars)
 * 
 * BEHAVIOR:
 * The present cursor is a mere disturbance. The future cursor (The Oracle) dominates the field, 
 * waiting ahead of you. It commands a log-polar cortical geometry. 
 * Smooth motion yields a confident, highly-saturated halo.
 * Hesitation or sudden stops fracture the timeline into multiple fading guesses.
 * Reversals trigger a complementary (cyan/magenta/yellow) burn-in scar in the fabric of the feedback buffer.
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL2 context not available");

        // Feral UI Injection
        if (!document.getElementById('feral-oracle-ui')) {
            const ui = document.createElement('div');
            ui.id = 'feral-oracle-ui';
            ui.style.cssText = `
                position: absolute; top: 10px; left: 10px; z-index: 100;
                background: rgba(5, 2, 10, 0.85); color: #0ff;
                font-family: monospace; font-size: 11px; padding: 15px;
                border: 1px solid #f0f; border-left: 4px solid #f0f;
                box-shadow: 0 0 15px rgba(255, 0, 255, 0.2);
                width: 240px; pointer-events: auto; backdrop-filter: blur(4px);
            `;
            ui.innerHTML = `
                <div style="color:#f0f; margin-bottom:10px; font-weight:bold; letter-spacing:1px;">ORACLE_RETICLE_V3.1</div>
                <label>LEAD_HORIZON: <span id="val-lead">0.40</span>s</label>
                <input type="range" id="sl-lead" min="0.05" max="1.5" step="0.01" value="0.40" style="width:100%; margin-bottom:8px;">
                
                <label>PREDICTION_MODEL: <span id="val-model">DAMPED</span></label>
                <input type="range" id="sl-model" min="0" max="2" step="1" value="2" style="width:100%; margin-bottom:8px;">
                
                <label>PHOSPHENE_DENSITY: <span id="val-den">1.5</span></label>
                <input type="range" id="sl-den" min="0.5" max="4.0" step="0.1" value="1.5" style="width:100%; margin-bottom:8px;">
                
                <label>SCAR_DECAY: <span id="val-dec">0.96</span></label>
                <input type="range" id="sl-dec" min="0.80" max="0.99" step="0.01" value="0.96" style="width:100%; margin-bottom:8px;">
            `;
            canvas.parentNode.appendChild(ui);
            
            const updateLabel = (id, val) => document.getElementById(id).innerText = val;
            document.getElementById('sl-lead').oninput = (e) => { uniforms.uLeadTime.value = parseFloat(e.target.value); updateLabel('val-lead', e.target.value); };
            document.getElementById('sl-model').oninput = (e) => { 
                const v = parseInt(e.target.value); 
                uniforms.uPredictionModel.value = v; 
                updateLabel('val-model', v===0 ? 'LINEAR' : v===1 ? 'QUADRATIC' : 'DAMPED'); 
            };
            document.getElementById('sl-den').oninput = (e) => { uniforms.uDensity.value = parseFloat(e.target.value); updateLabel('val-den', e.target.value); };
            document.getElementById('sl-dec').oninput = (e) => { uniforms.uDecay.value = parseFloat(e.target.value); updateLabel('val-dec', e.target.value); };
        }

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: false, antialias: false });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const sceneFeedback = new THREE.Scene();
        const sceneDisplay = new THREE.Scene();

        // Ping-pong buffers for temporal scars
        const rtParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false
        };
        let targetA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtParams);
        let targetB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtParams);

        const uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(grid.width, grid.height) },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
            uMouseVel: { value: new THREE.Vector2(0, 0) },
            uMouseAcc: { value: new THREE.Vector2(0, 0) },
            uLeadTime: { value: 0.40 },
            uPredictionModel: { value: 2 },
            uDensity: { value: 1.5 },
            uDecay: { value: 0.96 },
            tFeedback: { value: null }
        };

        const glslIncludes = `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            uniform vec2 uMouseVel;
            uniform vec2 uMouseAcc;
            uniform float uLeadTime;
            uniform int uPredictionModel;
            uniform float uDensity;

            vec2 predict(int model, vec2 p, vec2 v, vec2 a, float t) {
                if (model == 0) return p + v * t;
                if (model == 1) return p + v * t + 0.5 * a * t * t;
                // Damped model (k=3.0)
                float k = 3.0;
                float decay = (1.0 - exp(-k * t)) / k;
                return p + v * decay;
            }

            float predictionConfidence(vec2 v, float t) {
                return exp(-t * (0.5 + length(v) * 1.5));
            }

            vec3 getOracleData(vec2 aspectUV, vec2 m, vec2 v, vec2 a) {
                vec2 pred = predict(uPredictionModel, m, v, a, uLeadTime);
                float conf = predictionConfidence(v, uLeadTime);

                // Retinotopic Log-Polar map anchored to the FUTURE cursor
                vec2 d = aspectUV - pred;
                float r = max(length(d), 1e-6);
                float rho = log(r);
                float th = atan(d.y, d.x);

                // Topology morphs based on prediction model (Math -> Symptom)
                if (uPredictionModel == 0) th += sin(r * 20.0) * 0.1;
                if (uPredictionModel == 1) th += r * 3.0;
                if (uPredictionModel == 2) th += exp(-r * 4.0) * 2.0;

                // Phosphene Cortex Generators (Cobwebs & Tunnels)
                float spiral = sin(rho * 12.0 * uDensity + th * 5.0 - uTime * 3.0);
                float cobweb = sin(rho * 20.0 * uDensity) * sin(th * 8.0);
                float phosphene = smoothstep(0.1, 0.9, abs(spiral * cobweb));
                
                // Foveal windowing (hollow center, fading periphery)
                phosphene *= smoothstep(0.0, 0.15, r) * smoothstep(1.0, 0.3, r);

                // The Oracle Reticle (Blooming Future)
                float oracle = 0.005 / (r + 0.002);
                oracle *= conf;

                // Path Beads (Trajectories)
                float beads = 0.0;
                for(int i = 1; i <= 8; i++) {
                    float t_i = uLeadTime * float(i) / 8.0;
                    vec2 beadP = predict(uPredictionModel, m, v, a, t_i);
                    float dBead = length(aspectUV - beadP);
                    beads += 0.001 / (dBead + 0.001) * (float(i)/8.0);
                }

                // Fracturing (Machine Hesitation on Sudden Stops)
                float shock = smoothstep(1.0, 5.0, length(a));
                float fractures = 0.0;
                for(int i = 1; i <= 4; i++) {
                    vec2 fracP = pred - v * (float(i) * 0.08);
                    fractures += 0.003 / (length(aspectUV - fracP) + 0.002) * (1.0 - float(i)/4.0);
                }
                fractures *= shock;

                float totalIntensity = phosphene * 0.6 + oracle + beads + fractures;

                // Saturated Color Space Warp Palette
                vec3 colA = vec3(1.0, 0.05, 0.5); // Hot Pink
                vec3 colB = vec3(0.05, 1.0, 1.0); // Electric Cyan
                vec3 colC = vec3(0.8, 1.0, 0.05); // Acid Yellow

                vec3 baseCol = mix(colA, colB, sin(th * 2.0 + uTime) * 0.5 + 0.5);
                baseCol = mix(baseCol, colC, sin(rho * 3.0 - uTime) * 0.5 + 0.5);

                return baseCol * totalIntensity;
            }
        `;

        const matFeedback = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D tFeedback;
                uniform float uDecay;
                ${glslIncludes}

                void main() {
                    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                    vec2 aspectUV = vUv * aspect;
                    vec2 m = uMouse * aspect;
                    vec2 v = uMouseVel * aspect;
                    vec2 a = uMouseAcc * aspect;

                    vec3 ghost = getOracleData(aspectUV, m, v, a);
                    vec3 oldScar = texture(tFeedback, vUv).rgb;

                    // Reversal / High-Acceleration Complementary Burn-in
                    float reversal = clamp(-dot(normalize(v + 1e-5), normalize(a + 1e-5)), 0.0, 1.0);
                    float shock = smoothstep(1.5, 6.0, length(a));
                    float burnPower = shock * (0.5 + reversal * 0.5);

                    // Additive-RGB Complement for the afterimage
                    vec3 comp = vec3(1.0) - normalize(ghost + 0.001);
                    float intensity = length(ghost);

                    // Glitch Prophet: NaN-like corruption on extreme violence
                    if (length(a) > 15.0) comp = mix(comp, vec3(0.8, 0.0, 1.0), 0.5); // Purple corruption

                    vec3 newScar = comp * intensity * burnPower * 0.15;
                    
                    // Spatial diffusion (blur) of the scar
                    vec2 texel = 1.0 / uResolution;
                    vec3 blurScar = oldScar * 0.5 + 
                                   (texture(tFeedback, vUv + vec2(texel.x, 0.0)).rgb + 
                                    texture(tFeedback, vUv - vec2(texel.x, 0.0)).rgb + 
                                    texture(tFeedback, vUv + vec2(0.0, texel.y)).rgb + 
                                    texture(tFeedback, vUv - vec2(0.0, texel.y)).rgb) * 0.125;

                    vec3 outScar = max(blurScar * uDecay, newScar);
                    fragColor = vec4(outScar, 1.0);
                }
            `
        });

        const matDisplay = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D tFeedback;
                ${glslIncludes}

                void main() {
                    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                    vec2 aspectUV = vUv * aspect;
                    vec2 m = uMouse * aspect;
                    vec2 v = uMouseVel * aspect;
                    vec2 a = uMouseAcc * aspect;

                    vec3 ghost = getOracleData(aspectUV, m, v, a);
                    vec3 scar = texture(tFeedback, vUv).rgb;

                    // The Present (Insignificant compared to the future)
                    float presentDist = length(aspectUV - m);
                    float present = 0.0015 / (presentDist + 0.0001);
                    vec3 presentCol = vec3(1.0, 0.9, 0.8) * pow(present, 1.8);

                    // Background Void
                    vec3 bg = vec3(0.02, 0.01, 0.04) * (1.0 - length(vUv - 0.5) * 0.5);

                    vec3 finalCol = bg + ghost + scar + presentCol;

                    // Filmic Tonemapping
                    finalCol = (finalCol * (2.51 * finalCol + 0.03)) / (finalCol * (2.43 * finalCol + 0.59) + 0.14);
                    
                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        
        const meshFeedback = quad.clone();
        meshFeedback.material = matFeedback;
        sceneFeedback.add(meshFeedback);

        const meshDisplay = quad.clone();
        meshDisplay.material = matDisplay;
        sceneDisplay.add(meshDisplay);

        canvas.__three = { 
            renderer, sceneFeedback, sceneDisplay, camera, 
            targetA, targetB, uniforms,
            mouseState: {
                lastP: new THREE.Vector2(0.5, 0.5),
                v: new THREE.Vector2(0, 0),
                lastV: new THREE.Vector2(0, 0),
                a: new THREE.Vector2(0, 0)
            }
        };
    } catch (e) {
        console.error("Feral Oracle Initialization Failed:", e);
        throw e;
    }
}

const { renderer, sceneFeedback, sceneDisplay, camera, uniforms, mouseState } = canvas.__three;
let { targetA, targetB } = canvas.__three;

// Handle Resizes
if (uniforms.uResolution.value.x !== grid.width || uniforms.uResolution.value.y !== grid.height) {
    renderer.setSize(grid.width, grid.height, false);
    targetA.setSize(grid.width, grid.height);
    targetB.setSize(grid.width, grid.height);
    uniforms.uResolution.value.set(grid.width, grid.height);
}

// Physics & Motion Tracking
const dt = Math.max(0.001, Math.min(0.05, 1.0 / 60.0)); // Fixed-ish dt for stability
const mx = mouse.x / grid.width;
const my = 1.0 - (mouse.y / grid.height);
const currentP = new THREE.Vector2(mx, my);

// Initialize mouse if it's sitting at 0,0
if (mouseState.lastP.x === 0 && mouseState.lastP.y === 0) mouseState.lastP.copy(currentP);

const targetV = new THREE.Vector2().subVectors(currentP, mouseState.lastP).divideScalar(dt);
mouseState.v.lerp(targetV, 12.0 * dt); // EMA smoothing

const targetA_vec = new THREE.Vector2().subVectors(mouseState.v, mouseState.lastV).divideScalar(dt);
mouseState.a.lerp(targetA_vec, 12.0 * dt);

mouseState.lastP.copy(currentP);
mouseState.lastV.copy(mouseState.v);

// Update Uniforms
uniforms.uTime.value = time;
uniforms.uMouse.value.copy(currentP);
uniforms.uMouseVel.value.copy(mouseState.v);
uniforms.uMouseAcc.value.copy(mouseState.a);

// Pass 1: Render Feedback (Scars)
uniforms.tFeedback.value = targetA.texture;
renderer.setRenderTarget(targetB);
renderer.render(sceneFeedback, camera);

// Pass 2: Render Display (Composite)
uniforms.tFeedback.value = targetB.texture;
renderer.setRenderTarget(null);
renderer.render(sceneDisplay, camera);

// Ping-Pong Swap
canvas.__three.targetA = targetB;
canvas.__three.targetB = targetA;