try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const sceneSim = new THREE.Scene();
        const sceneDisp = new THREE.Scene();

        const res = 512; 
        const options = {
            type: THREE.FloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };

        let rtA = new THREE.WebGLRenderTarget(res, res, options);
        let rtB = new THREE.WebGLRenderTarget(res, res, options);

        const size = res * res * 4;
        const data = new Float32Array(size);
        for (let i = 0; i < size; i += 4) {
            data[i] = 1.0; 
            data[i + 1] = 0.0; 
            data[i + 2] = 0.0;
            data[i + 3] = 1.0;
        }

        for (let i = 0; i < 150; i++) {
            let cx = Math.floor(Math.random() * res);
            let cy = Math.floor(Math.random() * res);
            let r = 4 + Math.random() * 12;
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    if (x * x + y * y <= r * r) {
                        let px = (cx + Math.floor(x) + res) % res;
                        let py = (cy + Math.floor(y) + res) % res;
                        let idx = (py * res + px) * 4;
                        data[idx] = 0.5 + Math.random() * 0.1;
                        data[idx + 1] = 0.25 + Math.random() * 0.1;
                    }
                }
            }
        }

        const initTex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.FloatType);
        initTex.needsUpdate = true;

        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: initTex },
                uRes: { value: new THREE.Vector2(res, res) },
                uTime: { value: 0 }
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
                uniform sampler2D uState;
                uniform vec2 uRes;
                uniform float uTime;

                vec2 laplacian(sampler2D tex, vec2 uv, vec2 texel) {
                    vec2 sum = vec2(0.0, 0.0);
                    sum += texture(tex, uv + vec2(-1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(tex, uv + vec2( 1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(tex, uv + vec2( 0.0, -1.0) * texel).rg * 0.2;
                    sum += texture(tex, uv + vec2( 0.0,  1.0) * texel).rg * 0.2;
                    sum += texture(tex, uv + vec2(-1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(tex, uv + vec2( 1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(tex, uv + vec2(-1.0,  1.0) * texel).rg * 0.05;
                    sum += texture(tex, uv + vec2( 1.0,  1.0) * texel).rg * 0.05;
                    sum -= texture(tex, uv).rg;
                    return sum;
                }

                void main() {
                    vec2 texel = 1.0 / uRes;
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(uState, vUv, texel);
                    float reaction = u * v * v;
                    
                    // Base Gray-Scott parameters (Coral Growth / Fingerprint hybrid)
                    float F = 0.0545;
                    float K = 0.062;
                    
                    // Heat Damage Simulation: the tape is melting in a hot car, 
                    // mutating the reaction-diffusion parameters geographically over time
                    float heat = sin(vUv.y * 12.0 + uTime * 0.5) * cos(vUv.x * 8.0 - uTime * 0.3) * 0.003;
                    F += heat;
                    
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + K) * v;
                    
                    float newU = clamp(u + 1.0 * du, 0.0, 1.0);
                    float newV = clamp(v + 1.0 * dv, 0.0, 1.0);
                    
                    fragColor = vec4(newU, newV, 0.0, 1.0);
                }
            `
        });

        const dispMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uRes: { value: new THREE.Vector2(grid.width, grid.height) },
                uTime: { value: 0 }
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
                uniform sampler2D uState;
                uniform vec2 uRes;
                uniform float uTime;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec2 uv = vUv;
                    
                    // Tape stretch / Heat warp
                    float warp = sin(uv.y * 8.0 - uTime * 1.5) * 0.004 + sin(uv.y * 2.0 + uTime) * 0.008;
                    uv.x += warp;
                    
                    // VHS Tracking Tear (Horizontal Jitter)
                    float tearZone = exp(-pow(fract(uv.y * 1.5 + uTime * 0.3) - 0.5, 2.0) * 80.0);
                    float tear = (hash(vec2(uv.y * 150.0, uTime)) - 0.5) * 0.15 * tearZone;
                    uv.x += tear;
                    
                    // Chroma bleed offsets simulating magnetic misalignment
                    vec2 offsetR = vec2(0.006 + tear * 2.0, 0.0);
                    vec2 offsetB = vec2(-0.006 - tear, 0.0);
                    
                    float v_r = texture(uState, fract(uv + offsetR)).g;
                    float v_g = texture(uState, fract(uv)).g;
                    float v_b = texture(uState, fract(uv + offsetB)).g;
                    
                    // Reaction-Diffusion density
                    float density = smoothstep(0.18, 0.35, v_g);
                    
                    // --- TAPE DROPOUT (Dense RD areas burn out to white signal loss) ---
                    float dropoutNoise = step(0.65, hash(vec2(uv.x * 0.05, uv.y * 200.0 + uTime)));
                    vec3 dropoutColor = vec3(1.0, 0.96, 0.9) * (0.7 + 0.5 * dropoutNoise);
                    
                    // --- DEEP SCAN ARTIFACTS (Sparse RD areas show signal death) ---
                    float scanline = sin(uv.y * uRes.y * 0.4) * 0.5 + 0.5;
                    float interlace = sin(uv.y * uRes.y * 0.2 - uTime * 12.0) * 0.5 + 0.5;
                    vec3 rawNoise = vec3(hash(uv + uTime), hash(uv + uTime + 1.0), hash(uv + uTime + 2.0));
                    vec3 sparseColor = mix(vec3(0.02, 0.0, 0.08), vec3(0.15, 0.05, 0.25), rawNoise);
                    sparseColor *= mix(0.4, 1.0, scanline * interlace);
                    
                    // --- COMPOSITION ---
                    // The RD pattern itself is rendered as a degraded, over-saturated magnetic imprint
                    vec3 patternColor = vec3(v_r, v_g, v_b) * vec3(1.2, 0.4, 0.3); 
                    
                    // Blend sparse background and pattern
                    vec3 finalColor = mix(sparseColor, patternColor, smoothstep(0.02, 0.2, v_g));
                    
                    // Apply the severe dropout burnout where the pattern is highly dense
                    finalColor = mix(finalColor, dropoutColor, density);
                    
                    // CRT Screen Vignette
                    float vig = 16.0 * vUv.x * vUv.y * (1.0 - vUv.x) * (1.0 - vUv.y);
                    finalColor *= clamp(pow(vig, 0.25), 0.0, 1.0);
                    
                    // Phosphor flicker
                    finalColor *= 0.96 + 0.04 * sin(uTime * 50.0);
                    
                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });

        const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
        sceneSim.add(simQuad);

        const dispQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dispMaterial);
        sceneDisp.add(dispQuad);

        renderer.setRenderTarget(rtA);
        renderer.render(sceneSim, camera);

        canvas.__three = { renderer, camera, rtA, rtB, sceneSim, simQuad, sceneDisp, dispQuad };
    }

    const { renderer, camera, sceneSim, simQuad, sceneDisp, dispQuad } = canvas.__three;
    let { rtA, rtB } = canvas.__three;

    renderer.setSize(grid.width, grid.height, false);
    
    if (dispQuad && dispQuad.material && dispQuad.material.uniforms && dispQuad.material.uniforms.uRes) {
        dispQuad.material.uniforms.uRes.value.set(grid.width, grid.height);
        dispQuad.material.uniforms.uTime.value = time;
    }

    if (simQuad && simQuad.material && simQuad.material.uniforms) {
        simQuad.material.uniforms.uTime.value = time;
        
        // Ping-pong reaction-diffusion simulation steps
        const steps = 24; 
        let currentRT = rtA;
        let nextRT = rtB;

        for (let i = 0; i < steps; i++) {
            simQuad.material.uniforms.uState.value = currentRT.texture;
            renderer.setRenderTarget(nextRT);
            renderer.render(sceneSim, camera);

            let temp = currentRT;
            currentRT = nextRT;
            nextRT = temp;
        }

        canvas.__three.rtA = currentRT;
        canvas.__three.rtB = nextRT;

        // Final render pass displaying the VHS heat damage
        renderer.setRenderTarget(null);
        if (dispQuad.material.uniforms.uState) {
            dispQuad.material.uniforms.uState.value = currentRT.texture;
        }
        renderer.render(sceneDisp, camera);
    }
} catch (e) {
    console.error("Feral WebGL Error:", e);
}