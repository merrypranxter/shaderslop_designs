if (!canvas.__three) {
    try {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
        if (!gl) throw new Error("WebGL 2 not supported or context occupied");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mouse_pressed: { value: 0.0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    // Full screen quad
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_mouse;
                uniform float u_mouse_pressed;
                
                const float PI = 3.14159265359;
                const float PHI = 1.61803398875; // Golden Ratio for Quasicrystal scaling
                
                // Hash functions
                vec2 hash2(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453);
                }
                
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                // 2D Noise
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }
                
                // Fractional Brownian Motion
                float fbm(vec2 p) {
                    float f = 0.0;
                    float amp = 0.5;
                    for(int i = 0; i < 5; i++) {
                        f += amp * noise(p);
                        p *= 2.0;
                        amp *= 0.5;
                    }
                    return f;
                }
                
                // Voronoi for Leopard Spots
                float voronoi(vec2 x, float t) {
                    vec2 n = floor(x);
                    vec2 f = fract(x);
                    float md = 8.0;
                    for(int j = -1; j <= 1; j++)
                    for(int i = -1; i <= 1; i++) {
                        vec2 g = vec2(float(i), float(j));
                        vec2 o = hash2(n + g);
                        o = 0.5 + 0.5 * sin(t + 6.2831 * o);
                        vec2 r = g + o - f;
                        float d = dot(r, r);
                        if(d < md) md = d;
                    }
                    return md;
                }
                
                // 5-fold Quasicrystal projection
                float quasicrystal(vec2 uv, float time) {
                    float v = 0.0;
                    for (int i = 0; i < 5; i++) {
                        float angle = 2.0 * PI * float(i) / 5.0;
                        vec2 dir = vec2(cos(angle), sin(angle));
                        float phase = dot(uv, dir) * 2.0 * PHI;
                        v += cos(phase + time);
                    }
                    return v / 5.0;
                }
                
                // Michel-Lévy Lisa Frank Acid Palette
                vec3 michelLevyColor(float retardation) {
                    float r = retardation * 2.5;
                    vec3 color;
                    
                    // Hyper-saturated cosine palette
                    color.r = sin(r * PI) * 0.5 + 0.5;
                    color.g = sin((r + 0.33) * PI) * 0.5 + 0.5;
                    color.b = sin((r + 0.67) * PI) * 0.5 + 0.5;
                    
                    color = smoothstep(0.1, 0.9, color);
                    
                    // Force maximum saturation (Lisa Frank aesthetic)
                    float maxC = max(color.r, max(color.g, color.b));
                    float minC = min(color.r, min(color.g, color.b));
                    if (maxC > minC) {
                        color = (color - minC) / (maxC - minC);
                    }
                    
                    return pow(color, vec3(0.5)); // Neon punch
                }
                
                void main() {
                    vec2 uv = (vUv - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
                    uv *= 6.0;
                    
                    // Mouse interaction
                    vec2 mouseOffset = (u_mouse - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
                    mouseOffset *= 6.0;
                    vec2 mpos = uv - mouseOffset;
                    float mouseDist = length(mpos);
                    float mouseForce = exp(-mouseDist * 1.5) * (1.0 + u_mouse_pressed * 2.0);
                    
                    // Domain Warping
                    vec2 warp = vec2(fbm(uv + u_time * 0.15), fbm(uv + vec2(5.2, 1.3) - u_time * 0.15)) * 2.0 - 1.0;
                    vec2 wuv = uv + warp * 1.2 + normalize(mpos + 0.001) * mouseForce * 2.0;
                    
                    // Hierarchical 5-fold Quasicrystal (self-similar at phi scales)
                    float qc = 0.0;
                    float amp = 1.0;
                    float scale = 1.0;
                    for(int j = 0; j < 3; j++) {
                        qc += quasicrystal(wuv * scale, u_time * 0.4) * amp;
                        scale *= PHI;
                        amp *= 0.5;
                    }
                    
                    // Calculate normal from quasicrystal gradient for structural color
                    float eps = 0.02;
                    float qcx = quasicrystal(wuv + vec2(eps, 0.0), u_time * 0.4);
                    float qcy = quasicrystal(wuv + vec2(0.0, eps), u_time * 0.4);
                    vec2 grad = vec2(qcx - qc, qcy - qc) / eps;
                    vec3 normal = normalize(vec3(grad, 4.0));
                    
                    // Leopard Spots (Voronoi rings)
                    float v1 = voronoi(wuv * 2.5, u_time * 0.3);
                    float spots = smoothstep(0.1, 0.25, v1) - smoothstep(0.4, 0.6, v1);
                    
                    // Tiger Stripes (Domain warped sine waves)
                    float stripeWarp = fbm(wuv * 1.5 + u_time * 0.2);
                    float stripes = sin(wuv.x * 6.0 + wuv.y * 3.0 + stripeWarp * 12.0);
                    float tiger = smoothstep(0.6, 0.85, stripes);
                    
                    // Mix animal prints dynamically
                    float patternMask = fbm(uv * 0.4 - u_time * 0.1);
                    float finalPrint = mix(spots, tiger, smoothstep(0.35, 0.65, patternMask));
                    
                    // Photoelastic Stress / Birefringence Retardation
                    float viewAngle = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
                    float stress = qc * 1.5 + viewAngle * 3.0 + fbm(uv * 2.0) * 1.5 + mouseForce * 4.0;
                    float retardation = abs(stress) * 1.5 + u_time * 0.4;
                    
                    vec3 baseColor = michelLevyColor(retardation);
                    
                    // Quasicrystal boundaries (stress lines)
                    float contour = fract(qc * 5.0);
                    float line = smoothstep(0.0, 0.04, contour) * smoothstep(0.08, 0.04, contour);
                    baseColor = mix(baseColor, vec3(1.0, 0.2, 0.8), line * 0.7); // Hot pink stress lines
                    
                    // Apply Animal Print with inverted neon halos
                    float printMask = smoothstep(0.1, 0.9, finalPrint);
                    float printCore = smoothstep(0.6, 0.9, finalPrint);
                    vec3 spotColor = vec3(0.05, 0.0, 0.15); // Glossy deep purple
                    
                    vec3 color = mix(baseColor, 1.0 - baseColor, printMask); // Neon halo
                    color = mix(color, spotColor, printCore); // Dark core
                    
                    // Sparkles (High frequency pixel noise)
                    float sparkleNoise = hash(gl_FragCoord.xy + u_time);
                    float sparkleMask = smoothstep(0.992, 1.0, sparkleNoise);
                    float sparkleIntensity = (0.5 + 0.5 * sin(u_time * 8.0 + qc * 15.0)) * sparkleMask;
                    color += vec3(sparkleIntensity * 2.5);
                    
                    // Vignette
                    float vignette = 1.0 - length(vUv - 0.5) * 1.0;
                    color *= smoothstep(0.0, 0.5, vignette);
                    
                    fragColor = vec4(color, 1.0);
                }
            `,
            depthWrite: false,
            depthTest: false
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL setup failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth mouse interpolation
    if (mouse.x !== 0 || mouse.y !== 0) {
        const currentMouse = material.uniforms.u_mouse.value;
        currentMouse.x += ((mouse.x / grid.width) - currentMouse.x) * 0.1;
        currentMouse.y += (1.0 - (mouse.y / grid.height) - currentMouse.y) * 0.1;
    }
    material.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);