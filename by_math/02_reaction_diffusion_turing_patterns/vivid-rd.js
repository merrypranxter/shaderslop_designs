if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        
        const size = 512;
        const rtOpts = {
            width: size,
            height: size,
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            depthBuffer: false,
            stencilBuffer: false,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping
        };
        const rtA = new THREE.WebGLRenderTarget(size, size, rtOpts);
        const rtB = new THREE.WebGLRenderTarget(size, size, rtOpts);
        
        const data = new Float32Array(size * size * 4);
        for(let i = 0; i < size; i++) {
            for(let j = 0; j < size; j++) {
                const idx = (i * size + j) * 4;
                data[idx] = 1.0;     // U
                data[idx+1] = 0.0;   // V
                data[idx+2] = 0.0;
                data[idx+3] = 1.0;
                
                const dx = i - size / 2;
                const dy = j - size / 2;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Seed rings and chaotic noise
                if (dist < 30 || (dist > 60 && dist < 80 && Math.random() > 0.5) || (dist > 120 && dist < 130)) {
                    data[idx+1] = 0.5 + Math.random() * 0.5;
                }
                if (Math.random() < 0.01) {
                    data[idx+1] = 1.0;
                }
            }
        }
        const initTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
        initTex.wrapS = THREE.RepeatWrapping;
        initTex.wrapT = THREE.RepeatWrapping;
        initTex.needsUpdate = true;
        
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(size, size) },
                u_time: { value: 0.0 },
                u_dt: { value: 1.0 },
                u_mouse: { value: new THREE.Vector2(-1.0, -1.0) }
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
                uniform sampler2D u_state;
                uniform vec2 u_res;
                uniform float u_time;
                uniform float u_dt;
                uniform vec2 u_mouse;
                in vec2 vUv;
                out vec4 fragColor;
                
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
                    vec2 texel = 1.0 / u_res;
                    vec2 state = texture(u_state, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(u_state, vUv, texel);
                    float reaction = u * v * v;
                    
                    // Domain warped mapping of Munafo's parameter space
                    // Pushes the simulation through Spots (δ), Worms (μ), and U-Skate (π)
                    float F = 0.046 + 0.016 * sin(vUv.x * 4.0 + u_time * 0.2);
                    float k = 0.060 + 0.005 * cos(vUv.y * 4.0 - u_time * 0.15);
                    
                    // Mouse injection
                    if (u_mouse.x > -0.5) {
                        float dist = distance(vUv, u_mouse);
                        if(dist < 0.02) {
                            v += 0.5;
                        }
                    }
                    
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + k) * v;
                    
                    float newU = u + u_dt * du;
                    float newV = v + u_dt * dv;
                    
                    fragColor = vec4(clamp(newU, 0.0, 1.0), clamp(newV, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });
        
        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_time: { value: 0.0 }
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
                uniform sampler2D u_state;
                uniform float u_time;
                in vec2 vUv;
                out vec4 fragColor;
                
                vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                    return a + b * cos(6.28318 * (c * t + d));
                }
                
                void main() {
                    // Pan and organic UV warp
                    vec2 warpedUv = (vUv - 0.5) * (0.85 + 0.15 * sin(u_time * 0.1)) + 0.5;
                    warpedUv.x += u_time * 0.02;
                    warpedUv.y += u_time * 0.015;
                    warpedUv.x += sin(vUv.y * 10.0 + u_time * 0.5) * 0.005;
                    warpedUv.y += cos(vUv.x * 10.0 - u_time * 0.5) * 0.005;
                    
                    vec2 state = texture(u_state, warpedUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Pseudo-emboss for structural depth
                    float du = u - texture(u_state, warpedUv + vec2(0.002)).r;
                    
                    float t = v * 2.5 + du * 2.0 + u_time * 0.15;
                    
                    // Acid Vibration Palette (No black or white boundaries)
                    vec3 a = vec3(0.6, 0.5, 0.6);
                    vec3 b = vec3(0.4, 0.4, 0.4);
                    vec3 c = vec3(1.0, 1.0, 1.0);
                    vec3 d = vec3(0.0, 0.33, 0.67);
                    vec3 col = palette(t, a, b, c, d);
                    
                    // Secondary Cyberdelic Neon mapping
                    vec3 a2 = vec3(0.6, 0.4, 0.5);
                    vec3 b2 = vec3(0.3, 0.4, 0.3);
                    vec3 c2 = vec3(1.0, 1.0, 1.0);
                    vec3 d2 = vec3(0.3, 0.2, 0.8);
                    vec3 col2 = palette(u * 1.5 - u_time * 0.1, a2, b2, c2, d2);
                    
                    col = mix(col, col2, smoothstep(0.2, 0.8, u));
                    
                    // Chromatic aberration fringe driven by gradients
                    float ca = du * 15.0;
                    col.r += ca;
                    col.b -= ca;
                    
                    // Force clipping to prevent true black or true white
                    col = clamp(col, 0.2, 0.8);
                    
                    // Boost saturation
                    float lum = dot(col, vec3(0.299, 0.587, 0.114));
                    col = mix(vec3(lum), col, 1.8);
                    
                    // Final safety clamp
                    col = clamp(col, 0.2, 0.8);
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMaterial);
        scene.add(mesh);
        
        const simScene = new THREE.Scene();
        const simMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
        simScene.add(simMesh);
        
        canvas.__three = { renderer, scene, camera, simScene, simMesh, displayMaterial, rtA, rtB, initTex, step: 0 };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, simScene, simMesh, displayMaterial, rtA, rtB, initTex } = canvas.__three;
let { step } = canvas.__three;

if (simMesh?.material?.uniforms?.u_time) {
    simMesh.material.uniforms.u_time.value = time;
}

if (simMesh?.material?.uniforms?.u_mouse) {
    if (mouse.isPressed) {
        simMesh.material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
    } else {
        simMesh.material.uniforms.u_mouse.value.set(-1.0, -1.0);
    }
}

// Ping-pong reaction-diffusion integration
const STEPS = 12;
for (let i = 0; i < STEPS; i++) {
    const readTex = step === 0 ? initTex : (step % 2 === 0 ? rtA.texture : rtB.texture);
    const writeRT = step % 2 === 0 ? rtB : rtA;
    
    if (simMesh?.material?.uniforms?.u_state) {
        simMesh.material.uniforms.u_state.value = readTex;
    }
    
    renderer.setRenderTarget(writeRT);
    renderer.render(simScene, camera);
    
    step++;
}
canvas.__three.step = step;

// Final composite pass to screen
renderer.setRenderTarget(null);
if (displayMaterial?.uniforms?.u_time) {
    displayMaterial.uniforms.u_time.value = time;
}
if (displayMaterial?.uniforms?.u_state) {
    displayMaterial.uniforms.u_state.value = (step % 2 === 0 ? rtA.texture : rtB.texture);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);