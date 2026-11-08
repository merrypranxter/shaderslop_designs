if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1);
        
        const simRes = 512;
        const rtOptions = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const rtA = new THREE.WebGLRenderTarget(simRes, simRes, rtOptions);
        const rtB = new THREE.WebGLRenderTarget(simRes, simRes, rtOptions);
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        scene.add(mesh);
        
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(simRes, simRes) },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0,0) },
                uIsPressed: { value: 0 }
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
                precision highp sampler2D;
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uIsPressed;
                
                vec2 laplacian(sampler2D tex, vec2 uv, vec2 texel) {
                    vec2 sum = vec2(0.0);
                    sum += texture(tex, uv + vec2(-1.0,  0.0) * texel).rg * 0.2;
                    sum += texture(tex, uv + vec2( 1.0,  0.0) * texel).rg * 0.2;
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
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(uState, vUv, texel);
                    float reaction = u * v * v;
                    
                    // Drifting parameter space to force constant mutation
                    vec2 driftUv = vUv + vec2(sin(uTime * 0.1), cos(uTime * 0.07)) * 0.2;
                    float fx = sin(driftUv.x * 4.0) * cos(driftUv.y * 4.0) * 0.5 + 0.5;
                    
                    // Interpolate between Coral Growth (0.0545, 0.062) and Turing Spots (0.030, 0.055)
                    float F = mix(0.030, 0.0545, fx);
                    float K = mix(0.055, 0.062, fx);
                    
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + K) * v;
                    
                    float newU = clamp(u + du, 0.0, 1.0);
                    float newV = clamp(v + dv, 0.0, 1.0);
                    
                    // Mouse injection logic
                    vec2 mDiff = vUv - uMouse;
                    if (uIsPressed > 0.5 && length(mDiff) < 0.03) {
                        newV = 1.0;
                    }
                    
                    fragColor = vec4(newU, newV, 0.0, 1.0);
                }
            `
        });
        
        const initMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: `
                precision highp float;
                in vec2 vUv;
                out vec4 fragColor;
                
                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }
                
                void main() {
                    float u = 1.0;
                    float v = 0.0;
                    
                    vec2 grid = vUv * 25.0;
                    vec2 i = floor(grid);
                    vec2 f = fract(grid);
                    
                    float rnd = hash(i);
                    // Seed scattered nodes
                    if (rnd > 0.3 && length(f - 0.5) < 0.4) {
                        v = 1.0;
                    }
                    
                    // Seed structural lines to prevent isolated dead zones
                    if (abs(sin(vUv.x * 30.0 + vUv.y * 20.0)) < 0.08) {
                        v = 1.0;
                    }
                    
                    fragColor = vec4(u, v, 0.0, 1.0);
                }
            `
        });
        
        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uTime: { value: 0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
            `,
            fragmentShader: `
                precision highp float;
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform sampler2D uState;
                uniform float uTime;
                
                // Lisa Frank neon palette generator
                vec3 getNeonColor(float t) {
                    t = fract(t);
                    vec3 c1 = vec3(1.0, 0.05, 0.5); // Hot Pink
                    vec3 c2 = vec3(0.0, 0.9, 1.0);  // Cyan
                    vec3 c3 = vec3(0.6, 0.0, 1.0);  // Purple
                    vec3 c4 = vec3(0.7, 1.0, 0.0);  // Lime
                    vec3 c5 = vec3(1.0, 0.4, 0.0);  // Orange
                    
                    float step = t * 5.0;
                    float idx = floor(step);
                    float f = smoothstep(0.0, 1.0, fract(step));
                    
                    if (idx == 0.0) return mix(c1, c2, f);
                    if (idx == 1.0) return mix(c2, c3, f);
                    if (idx == 2.0) return mix(c3, c4, f);
                    if (idx == 3.0) return mix(c4, c5, f);
                    return mix(c5, c1, f);
                }
                
                void main() {
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 warp = vec2(sin(vUv.y * 12.0 + uTime), cos(vUv.x * 12.0 - uTime)) * 0.02;
                    
                    float t1 = v * 3.0 - u * 0.5 + uTime * 0.2 + warp.x;
                    vec3 baseCol = getNeonColor(t1);
                    
                    float t2 = u * 2.0 + uTime * 0.3 + warp.y;
                    vec3 highCol = getNeonColor(t2);
                    
                    // Isolate the reaction boundary for high contrast edging
                    float edge = smoothstep(0.1, 0.3, v) - smoothstep(0.3, 0.5, v);
                    vec3 finalCol = mix(baseCol, highCol, edge);
                    
                    // Clamp to strictly forbid pure black or white
                    finalCol = clamp(finalCol, 0.15, 0.95);
                    
                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });
        
        mesh.material = initMaterial;
        renderer.setRenderTarget(rtA);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        
        canvas.__three = { renderer, scene, camera, mesh, simMaterial, displayMaterial, rtA, rtB };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const tData = canvas.__three;
if (!tData) return;

const { renderer, scene, camera, mesh, simMaterial, displayMaterial } = tData;
let { rtA, rtB } = tData;

if (simMaterial?.uniforms) {
    simMaterial.uniforms.uTime.value = time;
    let nx = mouse.x / grid.width;
    let ny = 1.0 - (mouse.y / grid.height);
    simMaterial.uniforms.uMouse.value.set(nx, ny);
    simMaterial.uniforms.uIsPressed.value = mouse.isPressed ? 1.0 : 0.0;
}

mesh.material = simMaterial;

const STEPS = 12;
for (let i = 0; i < STEPS; i++) {
    simMaterial.uniforms.uState.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(scene, camera);
    
    let temp = rtA;
    rtA = rtB;
    rtB = temp;
}

tData.rtA = rtA;
tData.rtB = rtB;

if (displayMaterial?.uniforms) {
    displayMaterial.uniforms.uState.value = rtA.texture;
    displayMaterial.uniforms.uTime.value = time;
}
mesh.material = displayMaterial;

renderer.setRenderTarget(null);
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);