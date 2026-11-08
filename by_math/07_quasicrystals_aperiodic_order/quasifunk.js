if (!canvas.__three) {
    try {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
        if (!gl) throw new Error("WebGL 2 not supported or context occupied");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { 
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;
                in vec2 vUv;
                out vec4 fragColor;

                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
                    m = m * m;
                    m = m * m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 a0 = x - floor(x + 0.5);
                    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
                    vec3 g;
                    g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                float fbm(vec2 p) {
                    float f = 0.0;
                    float amp = 0.5;
                    for(int i = 0; i < 4; i++) {
                        f += amp * snoise(p);
                        p *= 2.0;
                        amp *= 0.5;
                    }
                    return f;
                }

                vec2 warp(vec2 p, float t) {
                    vec2 offset = vec2(fbm(p + t * 0.2), fbm(p + vec2(5.2, 1.3) - t * 0.15));
                    return p + offset * 0.8;
                }

                vec2 kaleidoscope(vec2 uv, float folds) {
                    float angle = atan(uv.y, uv.x);
                    float radius = length(uv);
                    float sector = 6.28318530718 / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    return vec2(cos(angle), sin(angle)) * radius;
                }

                float quasicrystal(vec2 p, float t) {
                    const int N = 8;
                    float sum = 0.0;
                    for(int i = 0; i < N; i++) {
                        float angle = float(i) * 3.14159265359 / float(N);
                        vec2 dir = vec2(cos(angle), sin(angle));
                        float phase = t * (float(i) * 0.2 + 0.5);
                        float freq = 12.0;
                        // Plane waves mapped with Silver Ratio for Ammann-Beenker structure
                        float w1 = cos(dot(p, dir) * freq + phase);
                        float w2 = cos(dot(p, dir) * freq * 2.41421356 + phase * 1.618);
                        sum += w1 * 0.6 + w2 * 0.4;
                    }
                    return sum / float(N);
                }

                vec3 getAcidColor(float v) {
                    v = clamp(v * 0.5 + 0.5, 0.0, 1.0);
                    // Cyberdelic Neon / Acid Vibration Palette
                    vec3 c0 = vec3(0.04, 0.02, 0.1); // Deep Violet Black
                    vec3 c1 = vec3(0.0, 0.28, 1.0);  // Cobalt Blue
                    vec3 c2 = vec3(1.0, 0.0, 0.78);  // Hot Magenta
                    vec3 c3 = vec3(1.0, 0.42, 0.0);  // Electric Orange
                    vec3 c4 = vec3(0.67, 1.0, 0.0);  // Acid Lime
                    
                    float steps = 5.0;
                    float sv = v * steps;
                    float i = floor(sv);
                    float f = smoothstep(0.4, 0.6, fract(sv));
                    
                    if (i == 0.0) return mix(c0, c1, f);
                    if (i == 1.0) return mix(c1, c2, f);
                    if (i == 2.0) return mix(c2, c3, f);
                    if (i == 3.0) return mix(c3, c4, f);
                    return c4;
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;
                    
                    // Funk pulse & rotate
                    float pulse = 1.0 + 0.15 * sin(u_time * 1.8);
                    uv *= pulse;
                    float theta = u_time * 0.12;
                    mat2 rot = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
                    uv = rot * uv;
                    
                    // Kaleidoscope fold (8-fold symmetry matching the quasicrystal)
                    uv = kaleidoscope(uv, 8.0);
                    
                    // CMYK misregistration / RGB offset
                    vec2 printOffset = vec2(0.03 * sin(u_time * 2.0), 0.02 * cos(u_time * 1.5));
                    
                    vec2 uvR = warp(uv + printOffset, u_time);
                    vec2 uvG = warp(uv, u_time);
                    vec2 uvB = warp(uv - printOffset * 0.5, u_time);
                    
                    float qR = quasicrystal(uvR, u_time);
                    float qG = quasicrystal(uvG, u_time + 0.05);
                    float qB = quasicrystal(uvB, u_time + 0.1);
                    
                    vec3 colR = getAcidColor(qR);
                    vec3 colG = getAcidColor(qG);
                    vec3 colB = getAcidColor(qB);
                    
                    vec3 finalColor = vec3(colR.r, colG.g, colB.b);
                    
                    // Halftone print artifact overlay
                    float luma = dot(finalColor, vec3(0.299, 0.587, 0.114));
                    float hFreq = 200.0;
                    float rad = radians(45.0);
                    mat2 hRot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                    vec2 hUv = hRot * vUv * hFreq;
                    vec2 cell = fract(hUv) - 0.5;
                    float dist = length(cell);
                    float dotRadius = sqrt(1.0 - luma) * 0.65;
                    float ht = smoothstep(dotRadius + 0.1, dotRadius - 0.1, dist);
                    
                    // Mix with deep violet for ink-bleed halftone punch
                    finalColor = mix(finalColor, vec3(0.04, 0.02, 0.1), ht);
                    
                    // Photocopy grain noise
                    float noise = fract(sin(dot(vUv * (u_time + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
                    finalColor += (noise - 0.5) * 0.12;
                    
                    // Vignette border burn
                    float vignette = length(vUv - 0.5);
                    finalColor *= smoothstep(0.8, 0.3, vignette);
                    
                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;
if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
}
if (material?.uniforms?.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);