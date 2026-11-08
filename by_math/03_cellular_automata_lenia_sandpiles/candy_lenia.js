try {
    if (!ctx) throw new Error("WebGL2 context required");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const fboOpts = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };

        const fboSimA = new THREE.WebGLRenderTarget(512, 512, fboOpts);
        const fboSimB = new THREE.WebGLRenderTarget(512, 512, fboOpts);
        const fboPostA = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);
        const fboPostB = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const sceneSim = new THREE.Scene();
        const scenePost = new THREE.Scene();
        const sceneOut = new THREE.Scene();
        const geo = new THREE.PlaneGeometry(2, 2);

        const vShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const simMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(512, 512) },
                u_time: { value: 0 },
                u_frame: { value: 0 },
                u_mouse: { value: new THREE.Vector2(-1, -1) },
                u_click: { value: 0 }
            },
            vertexShader: vShader,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D u_state;
                uniform vec2 u_res;
                uniform float u_time;
                uniform float u_frame;
                uniform vec2 u_mouse;
                uniform float u_click;

                const float R = 21.0;
                const float dt = 0.12;
                const vec4 mu_g = vec4(0.15, 0.14, 0.13, 0.15);
                const vec4 sig_g = vec4(0.015, 0.018, 0.016, 0.025);

                mat4 W = mat4(
                    1.0,  0.5,  0.0,  0.2,
                    0.2,  1.0,  0.8,  0.0,
                   -0.5,  0.0,  1.0,  0.1,
                    0.1, -0.2, -0.3,  1.0
                );

                float kWeight(float r) {
                    float kr1 = r / R - 0.5;
                    float w1 = exp(-(kr1 * kr1) / 0.045);
                    float kr2 = r / R - 0.8;
                    float w2 = 0.4 * exp(-(kr2 * kr2) / 0.02);
                    return w1 + w2;
                }

                vec4 growth(vec4 u) {
                    vec4 d = u - mu_g;
                    return 2.0 * exp(-(d * d) / (2.0 * sig_g * sig_g)) - 1.0;
                }

                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

                void main() {
                    if (u_frame < 5.0) {
                        vec4 seed = vec4(0.0);
                        for(float i=0.; i<50.; i++) {
                            vec2 pos = vec2(hash(vec2(i, 1.1)), hash(vec2(i, 2.2)));
                            float r = length(vUv - pos);
                            seed += exp(-r*r*900.0) * vec4(hash(vec2(i,3.)), hash(vec2(i,4.)), hash(vec2(i,5.)), hash(vec2(i,6.)));
                        }
                        fragColor = clamp(seed, 0.0, 1.0);
                        return;
                    }

                    vec4 sum = vec4(0.0);
                    float wsum = 0.0;
                    const int NR = 6;
                    const int NA = 16;

                    for (int ri = 1; ri <= NR; ri++) {
                        float r = R * float(ri) / float(NR);
                        float kw = kWeight(r) * r;
                        for (int ai = 0; ai < NA; ai++) {
                            float a = float(ai) / float(NA) * 6.283185307;
                            vec2 offset = vec2(cos(a), sin(a)) * r / u_res;
                            sum += texture(u_state, vUv + offset) * kw;
                            wsum += kw;
                        }
                    }
                    vec4 U = (wsum > 0.0) ? sum / wsum : vec4(0.0);
                    vec4 U_mix = W * U;

                    // Advection current for traces
                    float sL = texture(u_state, vUv - vec2(1.0, 0.0)/u_res).r;
                    float sR = texture(u_state, vUv + vec2(1.0, 0.0)/u_res).r;
                    float sD = texture(u_state, vUv - vec2(0.0, 1.0)/u_res).r;
                    float sU = texture(u_state, vUv + vec2(0.0, 1.0)/u_res).r;
                    vec2 curl = vec2(sU - sD, sL - sR);
                    vec2 advUv = vUv - curl * 0.003;

                    vec4 state = texture(u_state, advUv);
                    vec4 dA = growth(U_mix);

                    float mDist = length(vUv - u_mouse);
                    vec4 inject = exp(-mDist*mDist*300.0) * vec4(0.8, 1.0, 0.0, 0.5) * u_click;

                    float edge = smoothstep(0.4, 0.5, length(vUv - 0.5));
                    inject += edge * vec4(0.0, 0.02, 0.0, 0.0) * hash(vUv + u_time);

                    fragColor = clamp(state + dt * dA + inject, 0.0, 1.0);
                }
            `
        });

        const postMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_lenia: { value: null },
                u_prev: { value: null },
                u_time: { value: 0 },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: vShader,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;

                uniform sampler2D u_lenia;
                uniform sampler2D u_prev;
                uniform float u_time;
                uniform vec2 u_res;

                vec3 getPalette(vec4 state, vec2 uv) {
                    vec3 base = mix(vec3(0.85, 0.98, 0.98), vec3(1.0, 0.95, 0.98), uv.y);
                    
                    vec3 ch0_col = vec3(1.0, 0.05, 0.5); // Hot Pink
                    vec3 ch1_col = vec3(0.7, 1.0, 0.0);  // Lemon Lime
                    vec3 ch2_col = vec3(0.0, 0.8, 0.9);  // Saturated Cyan
                    vec3 ch3_col = vec3(0.6, 0.3, 1.0);  // Lavender

                    vec3 col = base;
                    col = mix(col, ch2_col, state.b * 0.85);
                    col = mix(col, ch1_col, state.g * 0.85);
                    col = mix(col, ch0_col, state.r * 0.95);
                    
                    col += state.a * ch3_col * 1.5;

                    float sum = dot(state, vec4(1.0));
                    vec3 irid = 0.5 + 0.5 * cos(sum * 6.28 + vec3(0.0, 1.5, 3.0) + u_time);
                    col += irid * smoothstep(0.1, 0.6, state.g) * 0.4;

                    float noise = fract(sin(dot(uv * u_time, vec2(12.989, 78.233))) * 43758.54);
                    col += noise * state.g * vec3(1.0, 0.9, 0.9) * 0.3;

                    return col;
                }

                void main() {
                    vec2 offset = vec2(0.003, 0.0015) * sin(u_time * 2.0 + vUv.y * 15.0);
                    vec4 stateR = texture(u_lenia, vUv + offset);
                    vec4 stateG = texture(u_lenia, vUv);
                    vec4 stateB = texture(u_lenia, vUv - offset);
                    vec4 state = vec4(stateR.r, stateG.g, stateB.b, stateG.a);

                    vec3 color = getPalette(state, vUv);

                    float s0 = dot(texture(u_lenia, vUv).rgb, vec3(1.0));
                    float s1 = dot(texture(u_lenia, vUv + vec2(0.005, 0.0)).rgb, vec3(1.0));
                    float s2 = dot(texture(u_lenia, vUv + vec2(0.0, 0.005)).rgb, vec3(1.0));
                    vec2 grad = vec2(s1 - s0, s2 - s0);

                    vec2 prevUv = vUv - grad * 0.015 + vec2(0.0, -0.0005);
                    vec3 prevColor = texture(u_prev, prevUv).rgb;

                    float smear = mix(0.92, 0.5, smoothstep(0.0, 0.4, state.r + state.g));
                    vec3 finalColor = mix(color, prevColor, smear);

                    float scanline = sin(vUv.y * u_res.y * 2.5) * 0.03;
                    finalColor -= scanline * vec3(0.1, 0.05, 0.1);

                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });

        const outMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { u_tex: { value: null } },
            vertexShader: vShader,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D u_tex;
                void main() { fragColor = texture(u_tex, vUv); }
            `
        });

        sceneSim.add(new THREE.Mesh(geo, simMat));
        scenePost.add(new THREE.Mesh(geo, postMat));
        sceneOut.add(new THREE.Mesh(geo, outMat));

        canvas.__three = {
            renderer, camera, sceneSim, scenePost, sceneOut,
            simMat, postMat, outMat,
            fboSimA, fboSimB, fboPostA, fboPostB,
            frameCount: 0
        };
    }

    const t = canvas.__three;

    if (t.fboPostA.width !== grid.width || t.fboPostA.height !== grid.height) {
        t.fboPostA.setSize(grid.width, grid.height);
        t.fboPostB.setSize(grid.width, grid.height);
        if (t.postMat.uniforms.u_res) {
            t.postMat.uniforms.u_res.value.set(grid.width, grid.height);
        }
    }

    t.renderer.setSize(grid.width, grid.height, false);

    if (t.simMat.uniforms.u_time) {
        t.simMat.uniforms.u_time.value = time;
        t.simMat.uniforms.u_frame.value = t.frameCount;
        t.simMat.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
        t.simMat.uniforms.u_click.value = mouse.isPressed ? 1.0 : 0.0;
        t.simMat.uniforms.u_state.value = t.fboSimA.texture;
    }

    t.renderer.setRenderTarget(t.fboSimB);
    t.renderer.render(t.sceneSim, t.camera);

    if (t.postMat.uniforms.u_time) {
        t.postMat.uniforms.u_time.value = time;
        t.postMat.uniforms.u_lenia.value = t.fboSimB.texture;
        t.postMat.uniforms.u_prev.value = t.fboPostA.texture;
    }

    t.renderer.setRenderTarget(t.fboPostB);
    t.renderer.render(t.scenePost, t.camera);

    if (t.outMat.uniforms.u_tex) {
        t.outMat.uniforms.u_tex.value = t.fboPostB.texture;
    }

    t.renderer.setRenderTarget(null);
    t.renderer.render(t.sceneOut, t.camera);

    let tempSim = t.fboSimA; t.fboSimA = t.fboSimB; t.fboSimB = tempSim;
    let tempPost = t.fboPostA; t.fboPostA = t.fboPostB; t.fboPostB = tempPost;
    
    t.frameCount++;

} catch (e) {
    console.error("WebGL Lenia Error:", e);
}