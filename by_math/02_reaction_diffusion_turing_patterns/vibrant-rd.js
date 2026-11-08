if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const simScene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(2, 2);

        const SIM_SIZE = 512;
        const options = {
            type: THREE.HalfFloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const rtA = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options);
        const rtB = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, options);

        const seedData = new Float32Array(SIM_SIZE * SIM_SIZE * 4);
        for (let i = 0; i < SIM_SIZE * SIM_SIZE * 4; i += 4) {
            seedData[i] = 1.0;
            seedData[i + 1] = 0.0;
            seedData[i + 2] = 0.0;
            seedData[i + 3] = 1.0;
        }
        for (let i = 0; i < 60; i++) {
            let cx = Math.random() * SIM_SIZE;
            let cy = Math.random() * SIM_SIZE;
            let r = Math.random() * 15 + 5;
            for (let y = 0; y < SIM_SIZE; y++) {
                for (let x = 0; x < SIM_SIZE; x++) {
                    let dx = x - cx;
                    let dy = y - cy;
                    if (dx * dx + dy * dy < r * r) {
                        let idx = (y * SIM_SIZE + x) * 4;
                        seedData[idx] = 0.5 + Math.random() * 0.1;
                        seedData[idx + 1] = 0.25 + Math.random() * 0.1;
                    }
                }
            }
        }
        const seedTex = new THREE.DataTexture(seedData, SIM_SIZE, SIM_SIZE, THREE.RGBAFormat, THREE.FloatType);
        seedTex.needsUpdate = true;

        const initMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { tDiffuse: { value: seedTex } },
            vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: `uniform sampler2D tDiffuse; in vec2 vUv; out vec4 fragColor; void main() { fragColor = texture(tDiffuse, vUv); }`
        });
        const initMesh = new THREE.Mesh(geometry, initMaterial);
        const initScene = new THREE.Scene();
        initScene.add(initMesh);
        
        renderer.setRenderTarget(rtA);
        renderer.render(initScene, camera);
        renderer.setRenderTarget(rtB);
        renderer.render(initScene, camera);
        renderer.setRenderTarget(null);

        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(SIM_SIZE, SIM_SIZE) },
                uFeedRate: { value: 0.045 },
                uKillRate: { value: 0.060 },
                uDiffusionU: { value: 1.0 },
                uDiffusionV: { value: 0.5 },
                uDeltaT: { value: 1.0 },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector3() }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uFeedRate;
                uniform float uKillRate;
                uniform float uDiffusionU;
                uniform float uDiffusionV;
                uniform float uDeltaT;
                uniform float uTime;
                uniform vec3 uMouse;

                in vec2 vUv;
                out vec4 fragColor;

                vec2 laplacian(sampler2D tex, vec2 uv, vec2 texel) {
                    vec2 sum = vec2(0.0);
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
                    vec2 texel = 1.0 / uResolution;
                    
                    vec2 flow = vec2(
                        sin(vUv.y * 10.0 + uTime * 0.5),
                        cos(vUv.x * 10.0 - uTime * 0.4)
                    ) * 0.001;
                    
                    vec2 state = texture(uState, vUv - flow).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(uState, vUv, texel);
                    float reaction = u * v * v;
                    
                    float f = uFeedRate + 0.015 * sin(vUv.x * 15.0 + uTime * 0.2) * cos(vUv.y * 15.0);
                    float k = uKillRate + 0.008 * sin(vUv.y * 20.0 - uTime * 0.3);

                    float du = uDiffusionU * lap.r - reaction + f * (1.0 - u);
                    float dv = uDiffusionV * lap.g + reaction - (f + k) * v;
                    
                    float newU = clamp(u + uDeltaT * du, 0.0, 1.0);
                    float newV = clamp(v + uDeltaT * dv, 0.0, 1.0);
                    
                    if (uMouse.z > 0.5) {
                        float dist = distance(vUv, uMouse.xy);
                        if (dist < 0.03) {
                            newV = clamp(newV + 0.5, 0.0, 1.0);
                            newU = clamp(newU - 0.5, 0.0, 1.0);
                        }
                    }
                    
                    if (distance(vUv, vec2(0.5)) < 0.01) {
                        newV = clamp(newV + 0.01, 0.0, 1.0);
                    }
                    
                    fragColor = vec4(newU, newV, 0.0, 1.0);
                }
            `
        });
        const simMesh = new THREE.Mesh(geometry, simMaterial);
        simScene.add(simMesh);

        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uState;
                uniform float uTime;
                uniform vec2 uResolution;
                in vec2 vUv;
                out vec4 fragColor;

                vec3 wavelengthToRGB(float W) {
                    vec3 c = vec3(0.0);
                    if (W >= 380.0 && W < 440.0) 
                        c = vec3(-(W-440.0)/(440.0-380.0), 0.0, 1.0);
                    else if (W >= 440.0 && W < 490.0) 
                        c = vec3(0.0, (W-440.0)/(490.0-440.0), 1.0);
                    else if (W >= 490.0 && W < 510.0)
                        c = vec3(0.0, 1.0, -(W-510.0)/(510.0-490.0));
                    else if (W >= 510.0 && W < 580.0)
                        c = vec3((W-510.0)/(580.0-510.0), 1.0, 0.0);
                    else if (W >= 580.0 && W < 645.0)
                        c = vec3(1.0, -(W-645.0)/(645.0-580.0), 0.0);
                    else if (W >= 645.0 && W <= 780.0)
                        c = vec3(1.0, 0.0, 0.0);
                    
                    float factor = 0.0;
                    if(W >= 380.0 && W < 420.0) factor = 0.3 + 0.7*(W-380.0)/(420.0-380.0);
                    else if(W >= 420.0 && W < 700.0) factor = 1.0;
                    else if(W >= 700.0 && W <= 780.0) factor = 0.3 + 0.7*(780.0-W)/(780.0-700.0);
                    
                    return c * factor;
                }

                void main() {
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 offset = vec2(0.004, 0.004);
                    float vRight = texture(uState, vUv + offset).g;
                    float vUp = texture(uState, vUv + vec2(-offset.y, offset.x)).g;
                    
                    float emboss1 = (vRight - v) * 12.0;
                    float emboss2 = (vUp - v) * 12.0;
                    
                    float wave = 400.0 + (v + emboss1 * 0.1) * 350.0 + sin(uTime * 0.5 + vUv.x * 5.0) * 30.0;
                    wave = 400.0 + mod(wave - 400.0, 350.0);
                    vec3 spectral = wavelengthToRGB(wave);
                    
                    vec3 neon = vec3(0.1, 0.9, 0.6) * u + vec3(0.9, 0.1, 0.7) * v;
                    vec3 color = mix(spectral, neon, 0.5);
                    
                    color += vec3(emboss1, -emboss1, emboss2) * 1.5;
                    
                    float scanline = sin(vUv.y * uResolution.y * 1.5) * 0.03;
                    color += scanline;
                    
                    color = mix(color, vec3(0.5, 0.7, 0.9), 0.15);
                    color = clamp(color, 0.15, 0.85);
                    
                    fragColor = vec4(color, 1.0);
                }
            `
        });
        const mesh = new THREE.Mesh(geometry, displayMaterial);
        scene.add(mesh);

        canvas.__three = { renderer, camera, scene, simScene, simMaterial, displayMaterial, rtA, rtB, step: 0 };
    } catch (e) {
        return;
    }
}

const { renderer, camera, scene, simScene, simMaterial, displayMaterial, rtA, rtB } = canvas.__three;

const STEPS_PER_FRAME = 12;
for (let i = 0; i < STEPS_PER_FRAME; i++) {
    const readRT = (canvas.__three.step % 2 === 0) ? rtA : rtB;
    const writeRT = (canvas.__three.step % 2 === 0) ? rtB : rtA;

    simMaterial.uniforms.uState.value = readRT.texture;
    simMaterial.uniforms.uTime.value = time;
    simMaterial.uniforms.uMouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height, mouse.isPressed ? 1.0 : 0.0);

    renderer.setRenderTarget(writeRT);
    renderer.render(simScene, camera);
    
    canvas.__three.step++;
}

renderer.setRenderTarget(null);
const finalRT = (canvas.__three.step % 2 === 0) ? rtA : rtB;
displayMaterial.uniforms.uState.value = finalRT.texture;
displayMaterial.uniforms.uTime.value = time;
displayMaterial.uniforms.uResolution.value.set(grid.width, grid.height);

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);