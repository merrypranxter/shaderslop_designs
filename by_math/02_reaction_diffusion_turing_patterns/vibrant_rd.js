try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1);
        
        const size = 512;
        const rtParams = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping
        };
        
        let rtA = new THREE.WebGLRenderTarget(size, size, rtParams);
        let rtB = new THREE.WebGLRenderTarget(size, size, rtParams);
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        const initMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                in vec2 vUv;
                out vec4 fragColor;
                
                void main() {
                    float u = 1.0;
                    float v = 0.0;
                    
                    float noise = fract(sin(dot(vUv * 50.0, vec2(12.9898, 78.233))) * 43758.5453);
                    if (distance(vUv, vec2(0.5)) < 0.15 && noise > 0.4) {
                        u = 0.5;
                        v = 0.25;
                    }
                    
                    vec2 grid = fract(vUv * 8.0);
                    vec2 id = floor(vUv * 8.0);
                    float n2 = fract(sin(dot(id, vec2(1.23, 4.56))) * 789.012);
                    if (n2 > 0.5 && distance(grid, vec2(0.5)) < 0.15) {
                        u = 0.5;
                        v = 0.25;
                    }
                    
                    fragColor = vec4(u, v, 0.0, 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(geometry, initMat);
        scene.add(mesh);
        
        renderer.setRenderTarget(rtA);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        
        const simMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(size, size) },
                uFeedRate: { value: 0.040 },
                uKillRate: { value: 0.060 },
                uDiffusionU: { value: 1.0 },
                uDiffusionV: { value: 0.5 },
                uDeltaT: { value: 1.0 },
                uTime: { value: 0.0 },
                uMouse: { value: new THREE.Vector2(-1.0, -1.0) },
                uMousePressed: { value: 0.0 }
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
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uFeedRate;
                uniform float uKillRate;
                uniform float uDiffusionU;
                uniform float uDiffusionV;
                uniform float uDeltaT;
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uMousePressed;
                
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
                    
                    float u = state.r;
                    float v = state.g;
                    
                    vec2 lap = laplacian(uState, vUv, texel);
                    
                    float reaction = u * v * v;
                    
                    float f = uFeedRate + sin(vUv.x * 10.0 + uTime * 0.2) * 0.015 + cos(vUv.y * 5.0) * 0.005;
                    float k = uKillRate + cos(vUv.y * 10.0 - uTime * 0.15) * 0.015 + sin(vUv.x * 5.0) * 0.005;
                    
                    float du = uDiffusionU * lap.r - reaction + f * (1.0 - u);
                    float dv = uDiffusionV * lap.g + reaction - (f + k) * v;
                    
                    float newU = u + uDeltaT * du;
                    float newV = v + uDeltaT * dv;
                    
                    if (uMousePressed > 0.5) {
                        float dist = distance(vUv, uMouse);
                        if (dist < 0.04) {
                            newV += 0.5 * uDeltaT;
                            newU *= 0.5;
                        }
                    }
                    
                    fragColor = vec4(clamp(newU, 0.0, 1.0), clamp(newV, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });
        
        const dispMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uTime: { value: 0.0 },
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
                precision highp float;
                uniform sampler2D uState;
                uniform float uTime;
                uniform vec2 uResolution;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                vec2 kaleidoscope(vec2 uv, float folds) {
                    vec2 p = uv * 2.0 - 1.0;
                    float angle = atan(p.y, p.x);
                    float radius = length(p);
                    float sector = 6.2831853 / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    angle += sin(uTime * 0.1) * 0.2; 
                    return vec2(cos(angle), sin(angle)) * radius * 0.5 + 0.5;
                }
                
                vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                    return a + b * cos(6.28318 * (c * t + d));
                }
                
                void main() {
                    float distFromCenter = length(vUv - 0.5);
                    vec2 kUv = kaleidoscope(vUv, 8.0);
                    vec2 uv = mix(vUv, kUv, smoothstep(0.2, 0.9, distFromCenter));
                    
                    vec2 dir = normalize(uv - 0.5);
                    float dist = length(uv - 0.5);
                    
                    float r_val = texture(uState, uv + dir * 0.01 * dist).g;
                    float g_val = texture(uState, uv).g;
                    float b_val = texture(uState, uv - dir * 0.01 * dist).g;
                    
                    float u_val = texture(uState, uv).r;
                    
                    vec3 a = vec3(0.65, 0.65, 0.65); 
                    vec3 b = vec3(0.30, 0.30, 0.30); 
                    vec3 c = vec3(1.0, 1.0, 1.0);
                    vec3 d = vec3(0.0, 0.33, 0.67);
                    
                    vec3 colorR = palette(r_val * 5.0 + u_val - uTime * 0.4, a, b, c, d);
                    vec3 colorG = palette(g_val * 5.0 + u_val - uTime * 0.4, a, b, c, vec3(0.1, 0.44, 0.78));
                    vec3 colorB = palette(b_val * 5.0 + u_val - uTime * 0.4, a, b, c, vec3(0.2, 0.55, 0.89));
                    
                    vec3 finalColor = vec3(colorR.r, colorG.g, colorB.b);
                    
                    vec2 texel = 1.0 / uResolution;
                    float dx = texture(uState, uv + vec2(texel.x, 0.0)).g - texture(uState, uv - vec2(texel.x, 0.0)).g;
                    float dy = texture(uState, uv + vec2(0.0, texel.y)).g - texture(uState, uv - vec2(0.0, texel.y)).g;
                    float gradientMag = length(vec2(dx, dy));
                    
                    vec3 iridescence = palette(gradientMag * 20.0 + uTime * 0.6, vec3(0.65), vec3(0.30), vec3(1.5), vec3(0.4, 0.7, 0.2));
                    
                    finalColor = mix(finalColor, iridescence, smoothstep(0.005, 0.08, gradientMag));
                    
                    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
                    finalColor = mix(vec3(luminance), finalColor, 1.4); 
                    
                    finalColor = clamp(finalColor, 0.2, 0.9);
                    
                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });
        
        canvas.__three = { renderer, scene, camera, mesh, rtA, rtB, simMat, dispMat, stepsPerFrame: 16 };
    }
    
    const t = canvas.__three;
    if (!t) return;
    
    t.simMat.uniforms.uTime.value = time;
    
    if (mouse.isPressed) {
        t.simMat.uniforms.uMouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
        t.simMat.uniforms.uMousePressed.value = 1.0;
    } else {
        t.simMat.uniforms.uMouse.value.set(-1.0, -1.0);
        t.simMat.uniforms.uMousePressed.value = 0.0;
    }
    
    t.mesh.material = t.simMat;
    for (let i = 0; i < t.stepsPerFrame; i++) {
        t.simMat.uniforms.uState.value = t.rtA.texture;
        t.renderer.setRenderTarget(t.rtB);
        t.renderer.render(t.scene, t.camera);
        
        let temp = t.rtA;
        t.rtA = t.rtB;
        t.rtB = temp;
    }
    
    t.mesh.material = t.dispMat;
    t.dispMat.uniforms.uState.value = t.rtA.texture;
    t.dispMat.uniforms.uTime.value = time;
    t.dispMat.uniforms.uResolution.value.set(grid.width, grid.height);
    
    t.renderer.setRenderTarget(null);
    t.renderer.setSize(grid.width, grid.height, false);
    t.renderer.render(t.scene, t.camera);
    
} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}