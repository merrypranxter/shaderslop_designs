try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // Ping-pong buffers for continuous CA state
        const rtOpts = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping
        };
        const fboA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
        const fboB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);

        // ---------------------------------------------------------------------
        // FERAL CA SHADER: Lenia-like continuous automata in a Möbius-warped Poincaré disk
        // ---------------------------------------------------------------------
        const caFrag = `
            in vec2 vUv;
            out vec4 fragColor;
            uniform sampler2D u_state;
            uniform float u_time;
            uniform vec2 u_res;

            // Complex math for hyperbolic geometry
            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
            vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
            vec2 conj(vec2 z) { return vec2(z.x, -z.y); }
            vec2 mobius(vec2 z, vec2 a) { return cdiv(z - a, vec2(1.0, 0.0) - cmul(conj(a), z)); }

            void main() {
                vec2 z = vUv * 2.0 - 1.0;
                float r2 = dot(z,z);
                
                if(r2 >= 0.99) {
                    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    return;
                }

                // Möbius advection: the universe breathes and pulses
                float t = u_time * 0.4;
                vec2 c = vec2(sin(t * 1.3), cos(t * 0.8)) * 0.06 * sin(t * 0.5); 
                vec2 z_adv = mobius(z, c);
                vec2 uv_adv = z_adv * 0.5 + 0.5;

                vec4 center = texture(u_state, uv_adv);

                // Hyperbolic metric: cells shrink infinitely towards the boundary
                float metric = max(0.0, 1.0 - dot(z_adv, z_adv));
                
                // Multi-scale sampling rings
                float U1 = 0.0;
                float U2 = 0.0;
                float r1 = 0.015 * metric;
                float r2_samp = 0.035 * metric;

                for(int i = 0; i < 12; i++) {
                    float a = float(i) * 6.2831853 / 12.0 + u_time * 0.2; // slight rotational drift
                    vec2 dir = vec2(cos(a), sin(a));
                    U1 += texture(u_state, uv_adv + dir * r1).r;
                    U2 += texture(u_state, uv_adv + dir * r2_samp).r;
                }
                U1 /= 12.0;
                U2 /= 12.0;

                // Lenia-like continuous growth function
                float mu = 0.14;
                float sigma = 0.025;
                float G = exp(-pow(U1 - mu, 2.0) / (2.0 * sigma * sigma)) * 2.0 - 1.0;

                // Inhibition from outer ring (creates cell walls and mitosis)
                G -= U2 * 0.85;

                float dt = 0.18;
                float next_r = center.r + G * dt;
                
                // Baseline entropy decay
                next_r -= 0.004;

                // Edge pressure: force mitosis near the boundary
                if (metric < 0.2 && next_r > 0.6) {
                    next_r -= 0.15; 
                }

                // Fungal spore injection (spontaneous generation)
                if (next_r < 0.01) {
                    float noise = fract(sin(dot(uv_adv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
                    if (noise > 0.992) next_r = 0.9; 
                }

                fragColor = vec4(clamp(next_r, 0.0, 1.0), U1, U2, 1.0);
            }
        `;

        const caMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: caFrag
        });

        const caScene = new THREE.Scene();
        caScene.add(new THREE.Mesh(geometry, caMat));

        // ---------------------------------------------------------------------
        // DISPLAY SHADER: Acidic mapping & Hyperbolic Moiré 
        // ---------------------------------------------------------------------
        const dispFrag = `
            in vec2 vUv;
            out vec4 fragColor;
            uniform sampler2D u_state;
            uniform float u_time;

            float atanh_val(float x) {
                return 0.5 * log((1.0 + x) / (1.0 - x));
            }

            void main() {
                vec2 z = vUv * 2.0 - 1.0;
                float r = length(z);
                
                if(r >= 0.995) {
                    fragColor = vec4(0.02, 0.0, 0.04, 1.0);
                    return;
                }

                vec4 state = texture(u_state, vUv);
                float u = state.r;

                // Palette: Violet (Decay) -> Teal (Survival) -> Acid Green (Mutation) -> Magenta (Birth) -> Yellow (Excitation) -> White (Bloom)
                vec3 col = vec3(0.02, 0.0, 0.04);
                
                if (u > 0.01) {
                    if (u < 0.15) col = mix(vec3(0.02, 0.0, 0.04), vec3(0.54, 0.17, 0.89), u / 0.15); 
                    else if (u < 0.40) col = mix(vec3(0.54, 0.17, 0.89), vec3(0.0, 1.0, 1.0), (u - 0.15) / 0.25); 
                    else if (u < 0.60) col = mix(vec3(0.0, 1.0, 1.0), vec3(0.22, 1.0, 0.08), (u - 0.40) / 0.20); 
                    else if (u < 0.80) col = mix(vec3(0.22, 1.0, 0.08), vec3(1.0, 0.0, 1.0), (u - 0.60) / 0.20); 
                    else if (u < 0.95) col = mix(vec3(1.0, 0.0, 1.0), vec3(1.0, 1.0, 0.0), (u - 0.80) / 0.15); 
                    else col = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 1.0, 1.0), (u - 0.95) / 0.05); 
                }

                // Op-Art Hyperbolic Moiré Interference
                float hyp_d = atanh_val(r);
                float angle = atan(z.y, z.x);
                
                // 7-fold symmetry logic
                float sector = 6.2831853 / 7.0;
                float a = mod(angle + u_time * 0.05, sector) - sector / 2.0;
                
                float w1 = sin(hyp_d * 30.0 - u_time * 2.5);
                float w2 = sin(a * 45.0 + hyp_d * 12.0 + u_time * 1.5);
                
                float moire = smoothstep(0.4, 0.6, w1 * w2);

                // Chromatic interference: moiré edges glow
                vec3 moire_col = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), sin(hyp_d * 4.0 - u_time) * 0.5 + 0.5);
                col += moire * moire_col * 0.25 * smoothstep(0.0, 0.8, r);

                // Edge bloom and vignette
                float edge = smoothstep(0.75, 0.99, r);
                col = mix(col, vec3(1.0, 1.0, 1.0), edge * u); 
                col *= 1.0 - edge * 0.9;

                fragColor = vec4(col, 1.0);
            }
        `;

        const dispMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_state: { value: null }
            },
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: dispFrag
        });

        const dispScene = new THREE.Scene();
        dispScene.add(new THREE.Mesh(geometry, dispMat));

        // Seed Pass
        const seedMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                void main() {
                    vec2 z = vUv * 2.0 - 1.0;
                    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
                    float state = (length(z) < 0.5 && noise > 0.75) ? noise : 0.0;
                    fragColor = vec4(state, 0.0, 0.0, 1.0);
                }
            `
        });
        const seedScene = new THREE.Scene();
        seedScene.add(new THREE.Mesh(geometry, seedMat));
        
        renderer.setRenderTarget(fboA);
        renderer.render(seedScene, camera);
        renderer.setRenderTarget(null);

        canvas.__three = { renderer, camera, caScene, dispScene, caMat, dispMat, fboA, fboB };
    }

    const t3 = canvas.__three;
    t3.renderer.setSize(grid.width, grid.height, false);

    // 1. Run CA Step
    t3.caMat.uniforms.u_time.value = time;
    t3.caMat.uniforms.u_state.value = t3.fboA.texture;
    t3.caMat.uniforms.u_res.value.set(grid.width, grid.height);

    t3.renderer.setRenderTarget(t3.fboB);
    t3.renderer.render(t3.caScene, t3.camera);

    // 2. Display Result
    t3.dispMat.uniforms.u_time.value = time;
    t3.dispMat.uniforms.u_state.value = t3.fboB.texture;

    t3.renderer.setRenderTarget(null);
    t3.renderer.render(t3.dispScene, t3.camera);

    // 3. Ping-Pong Swap
    const temp = t3.fboA;
    t3.fboA = t3.fboB;
    t3.fboB = temp;

} catch (e) {
    console.error("Feral Math Mitosis Failed:", e);
}