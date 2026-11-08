const w = Math.floor(grid.width);
const h = Math.floor(grid.height);

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        
        const rtA = new THREE.WebGLRenderTarget(w, h, {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping
        });
        const rtB = rtA.clone();
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const plane = new THREE.PlaneGeometry(2, 2);
        
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(w, h) },
                uTime: { value: 0 },
                uFrame: { value: 0 }
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
                uniform float uTime;
                uniform int uFrame;
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
                    vec2 state = texture(uState, vUv).rg;
                    
                    // Initial seeding pattern
                    if (uFrame < 5) {
                        float dist = length(vUv - 0.5);
                        float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
                        if (dist < 0.1 || (dist > 0.3 && dist < 0.32) || noise > 0.995) {
                            fragColor = vec4(0.5, 0.25, 0.0, 1.0);
                        } else {
                            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
                        }
                        return;
                    }
                    
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(uState, vUv, texel);
                    float reaction = u * v * v;
                    
                    // Spatially varying parameters for complex emergence across Pearson classes
                    vec2 centeredUv = vUv - 0.5;
                    float angle = uTime * 0.05;
                    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                    vec2 rotatedUv = rot * centeredUv + 0.5;
                    
                    float F = mix(0.02, 0.08, clamp(rotatedUv.x, 0.0, 1.0));
                    float k = mix(0.05, 0.07, clamp(rotatedUv.y, 0.0, 1.0));
                    
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + k) * v;
                    
                    fragColor = vec4(clamp(u + du, 0.0, 1.0), clamp(v + dv, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });
        
        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uTime: { value: 0 },
                uResolution: { value: new THREE.Vector2(w, h) }
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

                // Psychedelic Collage: Kaleidoscope Pattern
                vec2 kaleidoscope(vec2 uv, float folds) {
                    uv = uv * 2.0 - 1.0;
                    float angle = atan(uv.y, uv.x);
                    float radius = length(uv);
                    
                    // Organic breathing displacement
                    radius += sin(angle * 6.0 + uTime * 2.0) * 0.03; 
                    
                    float sector = 2.0 * 3.14159 / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    vec2 folded = vec2(cos(angle), sin(angle)) * radius;
                    
                    float rot = uTime * 0.1;
                    mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
                    return (m * folded) * 0.5 + 0.5;
                }

                // Structural Color: Cosine Palette
                vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                    return a + b * cos(6.28318 * (c * t + d));
                }

                void main() {
                    vec2 uv = vUv;
                    
                    // Liquid UV Warp
                    uv.x += sin(uv.y * 8.0 + uTime) * 0.015;
                    uv.y += cos(uv.x * 8.0 + uTime) * 0.015;
                    
                    vec2 kUv = kaleidoscope(uv, 6.0);
                    
                    vec2 state = texture(uState, kUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Acid Vibration Palette Parameters (Bright, no pure black/white)
                    vec3 a = vec3(0.7, 0.6, 0.7);
                    vec3 b = vec3(0.2, 0.3, 0.2);
                    vec3 c = vec3(1.0, 1.0, 1.0);
                    vec3 d = vec3(0.0, 0.33, 0.67);
                    
                    float t = v * 5.0 - u * 2.0 + uTime * 0.5;
                    vec3 baseCol = palette(t, a, b, c, d);
                    
                    // Structural Color: Thin Film Interference
                    float thickness = u * 800.0 + 200.0;
                    float pathDiff = 2.0 * 1.33 * thickness / 1000.0;
                    vec3 filmCol = 0.6 + 0.3 * cos(6.28318 * (pathDiff + vec3(0.0, 0.33, 0.67)));
                    
                    vec3 color = mix(baseCol, filmCol, smoothstep(0.0, 0.5, v));
                    
                    // Print Artifact: CMYK Misregistration & Chromatic Aberration
                    vec2 offset = vec2(0.008 * sin(uTime * 3.0), 0.008 * cos(uTime * 3.0));
                    float vR = texture(uState, kUv + offset).g;
                    float vB = texture(uState, kUv - offset).g;
                    
                    color.r += vR * 0.4;
                    color.b += vB * 0.4;
                    
                    // Strict clamp to ensure absolutely no pure black or white
                    color = clamp(color, 0.15, 0.90);
                    
                    // Print Artifact: Paper Grain
                    float grain = fract(sin(dot(vUv * 1000.0 + uTime, vec2(127.1, 311.7))) * 43758.5453);
                    color += (grain - 0.5) * 0.08;
                    
                    fragColor = vec4(color, 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(plane, simMaterial);
        scene.add(mesh);
        
        canvas.__three = { 
            renderer, rtA, rtB, camera, scene, mesh, 
            simMaterial, displayMaterial, frame: 0,
            width: w, height: h 
        };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, camera, scene, mesh, simMaterial, displayMaterial } = canvas.__three;

if (canvas.__three.width !== w || canvas.__three.height !== h) {
    canvas.__three.rtA.setSize(w, h);
    canvas.__three.rtB.setSize(w, h);
    if (simMaterial?.uniforms?.uResolution) simMaterial.uniforms.uResolution.value.set(w, h);
    if (displayMaterial?.uniforms?.uResolution) displayMaterial.uniforms.uResolution.value.set(w, h);
    canvas.__three.width = w;
    canvas.__three.height = h;
}

canvas.__three.frame++;

if (simMaterial?.uniforms) {
    simMaterial.uniforms.uTime.value = time;
    simMaterial.uniforms.uFrame.value = canvas.__three.frame;
}

let currentRtA = canvas.__three.rtA;
let currentRtB = canvas.__three.rtB;

// Run multiple reaction-diffusion steps per frame for rapid organic growth
const steps = 10;
for (let i = 0; i < steps; i++) {
    simMaterial.uniforms.uState.value = currentRtA.texture;
    mesh.material = simMaterial;
    renderer.setRenderTarget(currentRtB);
    renderer.render(scene, camera);
    
    // Ping-pong buffer swap
    let temp = currentRtA;
    currentRtA = currentRtB;
    currentRtB = temp;
}

canvas.__three.rtA = currentRtA;
canvas.__three.rtB = currentRtB;

if (displayMaterial?.uniforms) {
    displayMaterial.uniforms.uTime.value = time;
    displayMaterial.uniforms.uState.value = currentRtA.texture;
}

mesh.material = displayMaterial;
renderer.setRenderTarget(null);
renderer.setSize(w, h, false);
renderer.render(scene, camera);