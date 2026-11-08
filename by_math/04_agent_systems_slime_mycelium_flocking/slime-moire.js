try {
    if (!ctx) throw new Error("WebGL2 context required for feral slime-moiré engine.");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const simSize = 512;

        const targetOptions = {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };

        const targetA = new THREE.WebGLRenderTarget(simSize, simSize, targetOptions);
        const targetB = targetA.clone();

        const data = new Float32Array(simSize * simSize * 4);
        for (let i = 0; i < simSize * simSize; i++) {
            let x = (i % simSize) / simSize - 0.5;
            let y = Math.floor(i / simSize) / simSize - 0.5;
            
            data[i * 4] = 1.0; 
            
            let d1 = Math.hypot(x - 0.1, y - 0.1);
            let d2 = Math.hypot(x + 0.2, y + 0.15);
            let d3 = Math.hypot(x, y - 0.2);
            let isSeed = (d1 < 0.02 || d2 < 0.015 || d3 < 0.025) || (Math.random() > 0.9995);
            
            data[i * 4 + 1] = isSeed ? 1.0 : 0.0; 
            data[i * 4 + 2] = 0.0;
            data[i * 4 + 3] = 1.0;
        }
        const seedTex = new THREE.DataTexture(data, simSize, simSize, THREE.RGBAFormat, THREE.FloatType);
        seedTex.needsUpdate = true;

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const simMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: seedTex },
                uRes: { value: new THREE.Vector2(simSize, simSize) },
                uTime: { value: 0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform sampler2D uState;
                uniform vec2 uRes;
                uniform float uTime;
                in vec2 vUv;
                out vec4 fragColor;

                vec2 laplacian(vec2 uv, vec2 texel) {
                    vec2 sum = vec2(0.0);
                    sum += texture(uState, uv + vec2(-1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(uState, uv + vec2( 1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(uState, uv + vec2( 0.0,-1.0) * texel).rg * 0.2;
                    sum += texture(uState, uv + vec2( 0.0, 1.0) * texel).rg * 0.2;
                    sum += texture(uState, uv + vec2(-1.0,-1.0) * texel).rg * 0.05;
                    sum += texture(uState, uv + vec2( 1.0,-1.0) * texel).rg * 0.05;
                    sum += texture(uState, uv + vec2(-1.0, 1.0) * texel).rg * 0.05;
                    sum += texture(uState, uv + vec2( 1.0, 1.0) * texel).rg * 0.05;
                    sum -= texture(uState, uv).rg * 1.0;
                    return sum;
                }

                void main() {
                    vec2 texel = 1.0 / uRes;
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;

                    vec2 lap = laplacian(vUv, texel);

                    float r = length(vUv - 0.5);
                    
                    float F = mix(0.062, 0.090, sin(r * 15.0 - uTime * 0.2) * 0.5 + 0.5);
                    float k = mix(0.061, 0.059, cos(r * 12.0 + uTime * 0.15) * 0.5 + 0.5);

                    float reaction = u * v * v;
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + k) * v;

                    float entropy = fract(sin(dot(vUv + uTime, vec2(12.9898, 78.233))) * 43758.5453);
                    if (entropy > 0.99995) dv += 0.5; 

                    u += du;
                    v += dv;

                    fragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        const dispMat = new THREE.ShaderMaterial({
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
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform sampler2D uState;
                uniform vec2 uRes;
                uniform float uTime;
                in vec2 vUv;
                out vec4 fragColor;

                void main() {
                    vec2 mUV = (vUv - 0.5) * (uRes / min(uRes.x, uRes.y));
                    
                    float rSq = dot(mUV, mUV);
                    mUV = mUV / (1.0 + rSq * 0.2); 

                    vec2 texel = 1.0 / vec2(512.0);
                    float uC = texture(uState, vUv).r;
                    float vC = texture(uState, vUv).g;

                    float vR = texture(uState, vUv + vec2(texel.x, 0.0)).g;
                    float vT = texture(uState, vUv + vec2(0.0, texel.y)).g;
                    vec2 grad = vec2(vR - vC, vT - vC);

                    vec2 tear = grad * 35.0;

                    float freq = 60.0 + uC * 180.0;

                    float angle = uTime * 0.15;
                    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                    vec2 rUV = rot * mUV;

                    vec2 a1 = vec2(1.0, 0.0);
                    vec2 a2 = vec2(-0.5, 0.866025);
                    vec2 a3 = vec2(-0.5, -0.866025);

                    float g1 = sin(dot(rUV + tear, a1) * freq + uTime * 2.0);
                    float g2 = sin(dot(rUV - tear, a2) * freq - uTime * 1.5);
                    float g3 = sin(dot(rUV + vec2(tear.y, -tear.x), a3) * freq + uTime * 2.5);

                    float moire = g1 * g2 * g3;

                    float bands = smoothstep(0.0, 0.25, moire);

                    vec3 toxicYellow = vec3(1.0, 0.95, 0.0);
                    vec3 hotMagenta  = vec3(1.0, 0.0, 0.4);
                    vec3 hyperCyan   = vec3(0.0, 1.0, 0.8);
                    vec3 deepViolet  = vec3(0.15, 0.0, 0.6);

                    vec3 baseCol = mix(deepViolet, hotMagenta, uC);
                    vec3 bandCol = mix(hyperCyan, toxicYellow, vC * 2.5);

                    vec3 finalCol = mix(baseCol, bandCol, bands);

                    float vein = smoothstep(0.005, 0.03, length(grad));
                    finalCol += toxicYellow * vein * 2.5; 

                    float glitch = step(0.998, fract(sin(dot(vUv, vec2(127.1, 311.7)) + uTime) * 43758.5453));
                    finalCol = mix(finalCol, vec3(1.0, 0.0, 0.5), glitch * vC);

                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });

        const sceneSim = new THREE.Scene();
        sceneSim.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat));

        const sceneDisp = new THREE.Scene();
        sceneDisp.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dispMat));

        canvas.__three = { renderer, targetA, targetB, simMat, dispMat, sceneSim, sceneDisp, camera };
    }

    const t = canvas.__three;
    
    if (t.dispMat && t.dispMat.uniforms && t.dispMat.uniforms.uRes) {
        t.dispMat.uniforms.uRes.value.set(grid.width, grid.height);
    }
    if (t.simMat && t.simMat.uniforms && t.simMat.uniforms.uTime) {
        t.simMat.uniforms.uTime.value = time;
    }
    if (t.dispMat && t.dispMat.uniforms && t.dispMat.uniforms.uTime) {
        t.dispMat.uniforms.uTime.value = time;
    }

    const STEPS = 16; 
    for (let i = 0; i < STEPS; i++) {
        if (i === 0 && time < 0.1) {
            // Keep seed for the first few frames
        } else {
            t.simMat.uniforms.uState.value = t.targetA.texture;
        }
        
        t.renderer.setRenderTarget(t.targetB);
        t.renderer.render(t.sceneSim, t.camera);

        let temp = t.targetA;
        t.targetA = t.targetB;
        t.targetB = temp;
    }

    t.dispMat.uniforms.uState.value = t.targetA.texture;
    t.renderer.setRenderTarget(null);
    t.renderer.setSize(grid.width, grid.height, false);
    t.renderer.render(t.sceneDisp, t.camera);

} catch(e) {
    console.error("Feral Slime-Moiré Engine Failure:", e);
}