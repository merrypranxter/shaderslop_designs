try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1);
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const plane = new THREE.PlaneGeometry(2, 2);

        // Ping-pong buffers for simulation state
        // R: Pathogen (U)
        // G: Structure/Anatomy (V)
        // B: Acidic Rejection / Stress
        // A: Morphological Memory / Residue
        const options = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        let rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, options);
        let rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, options);

        const simVertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const simFragmentShader = `
            precision highp float;
            in vec2 vUv;
            out vec4 fragColor;

            uniform sampler2D u_state;
            uniform vec2 u_res;
            uniform float u_time;
            uniform vec2 u_mouse;
            uniform float u_mouse_vel;

            // --- HASH & NOISE (From Damage / Morphogenesis Repos) ---
            float hash12(vec2 p) {
                vec3 p3  = fract(vec3(p.xyx) * .1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f*f*(3.0-2.0*f);
                float a = hash12(i);
                float b = hash12(i + vec2(1.0, 0.0));
                float c = hash12(i + vec2(0.0, 1.0));
                float d = hash12(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i=0; i<4; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            // Polynomial smooth min (Lenia / Shiny Repos)
            float smin(float a, float b, float k) {
                float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
                return mix(b, a, h) - k * h * (1.0 - h);
            }

            // --- MORPHOGENETIC ATTRACTOR (Xenomorph Archetype) ---
            // The goo doesn't hardcode the alien; this field represents the evolutionary
            // "fitness" landscape. High values = stable biomechanical geometry.
            float xenoFitness(vec2 uv, float stress) {
                vec2 p = uv * 2.0 - 1.0;
                p.x = abs(p.x); // Bilateral symmetry
                
                // Cranium: Elongated dome
                float cranium = length(vec2(p.x * 1.3, max(0.0, p.y - 0.2))) - 0.55;
                
                // Biomechanical Ribs
                float ribs = p.x - 0.25 - 0.15 * sin(p.y * 35.0 + u_time * 0.5) * exp(-abs(p.y * 2.0));
                
                // Inner Maw / Teeth (More pronounced under stress/fast mouse velocity)
                float jaw = length(vec2(p.x * 2.5, p.y + 0.3)) - 0.2;
                float teeth = abs(sin(p.x * 40.0) * sin(p.y * 40.0)) * 0.1 * stress;
                jaw -= teeth;

                // Vertebral Tail
                float tailWobble = sin(p.y * 10.0 - u_time) * 0.1;
                float spine = abs(p.x - tailWobble) - 0.05 - 0.05 * sin(p.y * 50.0);

                // Merge structures
                float d = smin(cranium, ribs, 0.15);
                d = smin(d, jaw, 0.1);
                d = smin(d, spine, 0.08);

                // Return fitness (1.0 = highly fit, 0.0 = unfit)
                return smoothstep(0.1, -0.05, d);
            }

            void main() {
                vec2 px = 1.0 / u_res;
                vec4 state = texture(u_state, vUv);
                
                float U = state.r; // Pathogen
                float V = state.g; // Anatomy
                float Acid = state.b; // Rejection
                float Mem = state.a; // Residue

                // --- 9-POINT LAPLACIAN ---
                vec4 n  = texture(u_state, vUv + vec2(0.0, px.y));
                vec4 s  = texture(u_state, vUv - vec2(0.0, px.y));
                vec4 e  = texture(u_state, vUv + vec2(px.x, 0.0));
                vec4 w  = texture(u_state, vUv - vec2(px.x, 0.0));
                vec4 ne = texture(u_state, vUv + vec2(px.x, px.y));
                vec4 nw = texture(u_state, vUv + vec2(-px.x, px.y));
                vec4 se = texture(u_state, vUv + vec2(px.x, -px.y));
                vec4 sw = texture(u_state, vUv + vec2(-px.x, -px.y));

                // Anisotropic diffusion for ribs vs dome
                float aniso = sin(vUv.y * 20.0) * 0.5 + 0.5;
                float weightY = mix(0.2, 0.05, aniso * state.g);
                float weightX = mix(0.2, 0.35, aniso * state.g);

                vec4 lap = (n + s) * weightY + (e + w) * weightX + (ne + nw + se + sw) * 0.05 - state;

                // --- EVOLUTIONARY CYCLE ---
                // 30 second cycle: Dormancy -> Contam -> Convergence -> Acid -> Collapse
                float cycleT = mod(u_time, 30.0) / 30.0;
                
                float phase_dormant = smoothstep(0.1, 0.0, cycleT) + smoothstep(0.9, 1.0, cycleT);
                float phase_contam = smoothstep(0.1, 0.2, cycleT) * smoothstep(0.4, 0.3, cycleT);
                float phase_converge = smoothstep(0.3, 0.4, cycleT) * smoothstep(0.7, 0.6, cycleT);
                float phase_acid = smoothstep(0.6, 0.7, cycleT) * smoothstep(0.9, 0.8, cycleT);

                // --- KINETICS ---
                float Du = 0.20;
                float Dv = 0.10;
                float F = 0.030;
                float k = 0.062;

                // Mouse interaction acts as environmental stress
                float distToMouse = length(vUv - u_mouse);
                float stress = smoothstep(0.2, 0.0, distToMouse) * u_mouse_vel + phase_contam * 0.5;
                
                // Fitness attractor modifies Feed/Kill rates
                float fitness = xenoFitness(vUv, stress);
                
                // Memory reinforces successful structures
                F += Mem * 0.01; 
                
                // Convergence phase pulls the system toward the xenomorph archetype
                F += fitness * phase_converge * 0.015;
                k -= fitness * phase_converge * 0.005;

                // Stress forces rapid, sharp mutations (teeth/claws)
                F += stress * 0.02 * noise(vUv * 50.0 + u_time);

                // Acid kills anatomy
                k += Acid * 0.05;

                // Reaction-Diffusion updates
                float reaction = U * V * V;
                float dU = Du * lap.r - reaction + F * (1.0 - U);
                float dV = Dv * lap.g + reaction - (F + k) * V;

                // Acid generation (Triggers when V is dense during Acid phase)
                float acid_gen = phase_acid * smoothstep(0.4, 0.8, V) * (0.5 + 0.5 * noise(vUv * 15.0 - u_time * 2.0));
                float dAcid = 0.1 * lap.b + acid_gen - 0.02 * Acid;

                // Memory accumulation (Fossilizes successful V structures, decays during collapse)
                float dMem = 0.05 * V * phase_converge - 0.02 * Mem * phase_acid - 0.005 * Mem * phase_dormant;

                // Apply updates
                float dt = 1.0;
                U = clamp(U + dU * dt, 0.0, 1.0);
                V = clamp(V + dV * dt, 0.0, 1.0);
                Acid = clamp(Acid + dAcid * dt, 0.0, 1.0);
                Mem = clamp(Mem + dMem * dt, 0.0, 1.0);

                // Initial seed
                if (u_time < 0.1) {
                    U = 1.0;
                    V = (noise(vUv * 10.0) > 0.5 && length(vUv - 0.5) < 0.1) ? 1.0 : 0.0;
                    Acid = 0.0;
                    Mem = 0.0;
                }

                fragColor = vec4(U, V, Acid, Mem);
            }
        `;

        const displayFragmentShader = `
            precision highp float;
            in vec2 vUv;
            out vec4 fragColor;

            uniform sampler2D u_state;
            uniform vec2 u_res;
            uniform float u_time;

            // Structural Color / Thin Film Interference (Shiny Repo)
            vec3 iridescence(float thickness, float angle) {
                float phase = thickness * 5.0 + angle * 2.0;
                return vec3(
                    0.5 + 0.5 * sin(phase + 0.0),
                    0.5 + 0.5 * sin(phase + 2.1),
                    0.5 + 0.5 * sin(phase + 4.2)
                );
            }

            void main() {
                vec2 px = 1.0 / u_res;
                
                // Read state
                vec4 state = texture(u_state, vUv);
                float V = state.g; // Anatomy
                float Acid = state.b; // Rejection
                float Mem = state.a; // Residue

                // Chromatic Aberration & Normal Calculation
                float vL = texture(u_state, vUv - vec2(px.x, 0.0)).g;
                float vR = texture(u_state, vUv + vec2(px.x, 0.0)).g;
                float vD = texture(u_state, vUv - vec2(0.0, px.y)).g;
                float vU = texture(u_state, vUv + vec2(0.0, px.y)).g;
                
                vec3 normal = normalize(vec3(vR - vL, vU - vD, 0.05));

                // Lighting
                vec3 lightDir = normalize(vec3(0.3, 0.6, 0.8));
                vec3 viewDir = vec3(0.0, 0.0, 1.0);
                vec3 halfDir = normalize(lightDir + viewDir);
                
                float diff = max(dot(normal, lightDir), 0.0);
                float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

                // --- COLOR MAPPING ---
                
                // Base: Pitch black / wet gunmetal
                vec3 col = vec3(0.02, 0.03, 0.04);
                
                // Anatomy: Oily silver to dirty ivory
                vec3 anatomyBase = mix(vec3(0.3, 0.35, 0.4), vec3(0.8, 0.75, 0.65), V);
                
                // Iridescence on the membranes
                vec3 iri = iridescence(V, fresnel);
                anatomyBase = mix(anatomyBase, iri, fresnel * 0.5);
                
                col = mix(col, anatomyBase, smoothstep(0.1, 0.8, V));

                // Residue/Memory: Bruised pink / deep violet subsurface scattering
                vec3 memCol = vec3(0.4, 0.05, 0.3);
                col += memCol * Mem * 0.8 * (1.0 - V * 0.5); // Glows from underneath

                // Acidic Rejection: Luminous yellow-green corrosion
                vec3 acidCol = vec3(0.7, 1.0, 0.1);
                float acidGlow = smoothstep(0.0, 0.5, Acid);
                col = mix(col, acidCol, acidGlow * 0.8);
                col += acidCol * acidGlow * 1.5; // Emissive bloom

                // Specular Highlights (Wet effect)
                col += vec3(0.9, 0.95, 1.0) * spec * smoothstep(0.2, 0.8, V);

                // --- DAMAGE AESTHETICS ---
                
                // Chromatic Fringing at edges
                vec2 uvR = vUv + normal.xy * 0.003;
                vec2 uvB = vUv - normal.xy * 0.003;
                float rEdge = texture(u_state, uvR).g;
                float bEdge = texture(u_state, uvB).g;
                col.r += max(0.0, rEdge - V) * 0.5;
                col.b += max(0.0, bEdge - V) * 0.5;

                // Film Grain
                float grain = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
                col -= grain * 0.05;

                // Subtle vignette
                float vig = length(vUv - 0.5);
                col *= smoothstep(0.8, 0.2, vig);

                fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
            }
        `;

        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mouse_vel: { value: 0.0 }
            },
            vertexShader: simVertexShader,
            fragmentShader: simFragmentShader
        });

        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 }
            },
            vertexShader: simVertexShader,
            fragmentShader: displayFragmentShader
        });

        const simMesh = new THREE.Mesh(plane, simMaterial);
        const displayMesh = new THREE.Mesh(plane, displayMaterial);
        
        scene.add(simMesh);

        canvas.__three = { 
            renderer, 
            scene, 
            camera, 
            rtA, 
            rtB, 
            simMaterial, 
            displayMaterial, 
            simMesh, 
            displayMesh,
            lastMouse: { x: 0.5, y: 0.5 }
        };
    }

    const { renderer, scene, camera, rtA, rtB, simMaterial, displayMaterial, simMesh, displayMesh, lastMouse } = canvas.__three;

    // Handle Resize
    if (rtA.width !== grid.width || rtA.height !== grid.height) {
        rtA.setSize(grid.width, grid.height);
        rtB.setSize(grid.width, grid.height);
        simMaterial.uniforms.u_res.value.set(grid.width, grid.height);
        displayMaterial.uniforms.u_res.value.set(grid.width, grid.height);
        renderer.setSize(grid.width, grid.height, false);
    }

    // Input processing
    let mx = mouse.x / grid.width;
    let my = 1.0 - (mouse.y / grid.height);
    
    // Calculate velocity
    let dx = mx - lastMouse.x;
    let dy = my - lastMouse.y;
    let vel = Math.sqrt(dx*dx + dy*dy) * 100.0; // scale velocity
    vel = Math.min(vel, 1.0); // clamp
    
    lastMouse.x = mx;
    lastMouse.y = my;

    simMaterial.uniforms.u_time.value = time;
    if (mouse.isPressed) {
        simMaterial.uniforms.u_mouse.value.set(mx, my);
        simMaterial.uniforms.u_mouse_vel.value = vel;
    } else {
        simMaterial.uniforms.u_mouse_vel.value = Math.max(0, simMaterial.uniforms.u_mouse_vel.value - 0.05); // decay
    }

    // Simulation steps (Ping-Pong)
    const steps = 12; // High steps for stability and speed of evolution
    scene.remove(displayMesh);
    scene.add(simMesh);

    for (let i = 0; i < steps; i++) {
        const read = (i % 2 === 0) ? rtA : rtB;
        const write = (i % 2 === 0) ? rtB : rtA;

        simMaterial.uniforms.u_state.value = read.texture;
        renderer.setRenderTarget(write);
        renderer.render(scene, camera);
    }

    // The final state is in the write buffer of the last step
    const finalState = (steps % 2 === 0) ? rtA : rtB;
    
    // To ensure the next frame reads from the correct buffer, 
    // we swap rtA and rtB references if the final state ended up in rtB
    if (finalState === rtB) {
        canvas.__three.rtA = rtB;
        canvas.__three.rtB = rtA;
    }

    // Display Pass
    scene.remove(simMesh);
    scene.add(displayMesh);
    displayMaterial.uniforms.u_state.value = canvas.__three.rtA.texture;
    displayMaterial.uniforms.u_time.value = time;
    
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Xenomorph Attractor Evolution Failed:", e);
    throw e;
}