if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const simHeight = 512;
        const simWidth = Math.floor(512 * (grid.width / grid.height));
        const numPixels = simWidth * simHeight;

        const rtParams = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        let targetA = new THREE.WebGLRenderTarget(simWidth, simHeight, rtParams);
        let targetB = new THREE.WebGLRenderTarget(simWidth, simHeight, rtParams);

        const data = new Float32Array(numPixels * 4);
        for (let i = 0; i < numPixels; i++) {
            data[i * 4] = 1.0;
            data[i * 4 + 1] = 0.0;
            data[i * 4 + 2] = 0.0;
            data[i * 4 + 3] = 0.0;
        }

        for (let i = 0; i < 600; i++) {
            const cx = Math.floor(Math.random() * simWidth);
            const cy = Math.floor(Math.random() * simHeight);
            const r = Math.floor(Math.random() * 12) + 2;
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    if (x * x + y * y <= r * r) {
                        const px = (cx + x + simWidth) % simWidth;
                        const py = (cy + y + simHeight) % simHeight;
                        const idx = (py * simWidth + px) * 4;
                        if (Math.random() > 0.1) {
                            data[idx] = 0.4 + Math.random() * 0.2;
                            data[idx + 1] = 0.3 + Math.random() * 0.4;
                        }
                    }
                }
            }
        }

        const initTex = new THREE.DataTexture(data, simWidth, simHeight, THREE.RGBAFormat, THREE.FloatType);
        initTex.needsUpdate = true;

        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: initTex },
                uResolution: { value: new THREE.Vector2(simWidth, simHeight) },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uIsPressed: { value: false }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uTime;
                uniform vec2 uMouse;
                uniform bool uIsPressed;
                
                void main() {
                    vec2 texel = 1.0 / uResolution;
                    vec4 state = texture(uState, vUv);
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 sum = vec2(0.0);
                    sum += texture(uState, vUv + vec2(-1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2( 1.0, 0.0) * texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2( 0.0, -1.0) * texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2( 0.0,  1.0) * texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2(-1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2( 1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2(-1.0,  1.0) * texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2( 1.0,  1.0) * texel).rg * 0.05;
                    sum -= state.rg;
                    
                    float reaction = u * v * v;
                    
                    float warpX = sin(vUv.y * 8.0 + uTime * 0.2) * 0.06;
                    float warpY = cos(vUv.x * 8.0 - uTime * 0.15) * 0.06;
                    
                    float F = 0.038 + 0.016 * sin((vUv.x + warpX) * 4.0 + uTime * 0.1);
                    float k = 0.062 + 0.005 * cos((vUv.y + warpY) * 4.0 - uTime * 0.08);
                    
                    float du = 1.0 * sum.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * sum.g + reaction - (F + k) * v;
                    
                    float nextU = clamp(u + 1.0 * du, 0.0, 1.0);
                    float nextV = clamp(v + 1.0 * dv, 0.0, 1.0);
                    
                    if (uIsPressed) {
                        vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
                        float dist = distance(vUv * aspect, uMouse * aspect);
                        if (dist < 0.02) {
                            nextV = clamp(nextV + 0.5, 0.0, 1.0);
                            nextU = clamp(nextU - 0.5, 0.0, 1.0);
                        }
                    }
                    
                    fragColor = vec4(nextU, nextV, du, dv);
                }
            `,
            depthWrite: false,
            depthTest: false
        });

        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
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
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform sampler2D uState;
                uniform float uTime;
                
                void main() {
                    vec4 state = texture(uState, vUv);
                    float u = state.r;
                    float v = state.g;
                    float du = state.b;
                    float dv = state.a;
                    
                    vec3 c1 = vec3(1.0, 0.0, 0.55); // Neon Magenta
                    vec3 c2 = vec3(0.4, 0.0, 1.0);  // Deep Violet
                    vec3 c3 = vec3(0.0, 0.85, 1.0); // Electric Cyan
                    vec3 c4 = vec3(1.0, 0.95, 0.0); // Acid Yellow
                    vec3 c5 = vec3(0.1, 1.0, 0.3);  // Toxic Green
                    
                    float mix1 = smoothstep(0.0, 0.25, v);
                    float mix2 = smoothstep(0.25, 0.55, v);
                    float mix3 = smoothstep(0.55, 0.85, v);
                    
                    vec3 col = mix(c1, c2, mix1);
                    col = mix(col, c3, mix2);
                    col = mix(col, c4, mix3);
                    
                    float activity = smoothstep(0.0, 0.015, abs(du) + abs(dv));
                    col = mix(col, c5, activity * 0.75);
                    
                    float bgNoise = fract(sin(dot(vUv + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
                    col += (bgNoise - 0.5) * 0.06;
                    
                    float warp = sin(vUv.x * 25.0 + uTime) * cos(vUv.y * 25.0 - uTime) * 0.08;
                    col += vec3(warp, -warp, warp * 0.5);
                    
                    col = clamp(col, 0.12, 0.98);
                    
                    fragColor = vec4(col, 1.0);
                }
            `,
            depthWrite: false,
            depthTest: false
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMaterial);
        scene.add(quad);

        canvas.__three = { renderer, scene, camera, targetA, targetB, simMaterial, displayMaterial, quad };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, targetA, targetB, simMaterial, displayMaterial, quad } = canvas.__three;

if (!renderer || !simMaterial || !displayMaterial) return;

if (simMaterial?.uniforms?.uTime) {
    simMaterial.uniforms.uTime.value = time;
}
if (simMaterial?.uniforms?.uMouse) {
    simMaterial.uniforms.uMouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
}
if (simMaterial?.uniforms?.uIsPressed) {
    simMaterial.uniforms.uIsPressed.value = mouse.isPressed;
}
if (displayMaterial?.uniforms?.uTime) {
    displayMaterial.uniforms.uTime.value = time;
}

const steps = 14;
for (let i = 0; i < steps; i++) {
    quad.material = simMaterial;
    simMaterial.uniforms.uState.value = canvas.__three.targetA.texture;
    renderer.setRenderTarget(canvas.__three.targetB);
    renderer.render(scene, camera);
    
    let temp = canvas.__three.targetA;
    canvas.__three.targetA = canvas.__three.targetB;
    canvas.__three.targetB = temp;
}

quad.material = displayMaterial;
displayMaterial.uniforms.uState.value = canvas.__three.targetA.texture;
renderer.setRenderTarget(null);
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);