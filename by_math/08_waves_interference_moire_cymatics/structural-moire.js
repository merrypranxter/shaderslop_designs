if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0, 0) }
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
                
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_mouse;
                
                #define PI 3.14159265359
                
                // Procedural paper grain / xerox noise
                float grain(vec2 uv, float seed) {
                    return fract(sin(dot(uv * 1000.0 + seed, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                // Occult Mandala / Kaleidoscope Fold
                vec2 kaleidoscope(vec2 uv, float folds, float rotation) {
                    float angle = atan(uv.y, uv.x) + rotation;
                    float radius = length(uv);
                    float sector = 2.0 * PI / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    return vec2(cos(angle), sin(angle)) * radius;
                }
                
                // Print Artifact: Halftone Dot Screen
                float halftoneDot(vec2 uv, float scale, float angle, vec2 offset) {
                    float c = cos(angle);
                    float s = sin(angle);
                    vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
                    vec2 st = rotUV * scale + offset;
                    vec2 grid = abs(fract(st) - 0.5);
                    float dist = length(grid);
                    return smoothstep(0.45, 0.1, dist);
                }
                
                // Print Artifact: Halftone Line Screen (Op-Art)
                float halftoneLine(vec2 uv, float scale, float angle, vec2 offset) {
                    float c = cos(angle);
                    float s = sin(angle);
                    vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
                    vec2 st = rotUV * scale + offset;
                    float line = abs(fract(st.x) - 0.5);
                    return smoothstep(0.4, 0.1, line);
                }
                
                // Core Moiré Generation System
                vec3 getMoire(vec2 uv, float t) {
                    vec2 kalUV = kaleidoscope(uv, 10.0, t * 0.04);
                    
                    // Spiral Phantom Displacement (Moiré as secret/structure)
                    float r = length(kalUV);
                    float a = atan(kalUV.y, kalUV.x);
                    float spiralPhase = a * 5.0 + log(r + 0.001) * 12.0 - t * 1.5;
                    vec2 dispUV = kalUV + vec2(cos(spiralPhase), sin(spiralPhase)) * 0.03;
                    
                    // Scale Chirp (Doppler shift in visual space)
                    float baseScale = 30.0 + pow(r, 1.2) * 80.0;
                    
                    // CMYK Misregistration & Separation Angles
                    float angleC = radians(15.0 + sin(t * 0.11) * 8.0);
                    float angleM = radians(75.0 + cos(t * 0.13) * 8.0);
                    float angleY = radians(0.0 + sin(t * 0.07) * 5.0);
                    float angleK = radians(45.0 + cos(t * 0.17) * 6.0);
                    
                    // Deliberate scale misalignment to amplify Rosette Moiré
                    float scaleC = baseScale;
                    float scaleM = baseScale * 1.025;
                    float scaleY = baseScale * 1.05;
                    float scaleK = baseScale * 0.975;
                    
                    // Offset drift
                    vec2 offC = vec2(sin(t * 0.2) * 0.3, cos(t * 0.16) * 0.2);
                    vec2 offM = vec2(cos(t * 0.24) * 0.3, sin(t * 0.18) * 0.2);
                    vec2 offY = vec2(sin(t * 0.3) * 0.2, cos(t * 0.22) * 0.3);
                    vec2 offK = vec2(cos(t * 0.14) * 0.2, sin(t * 0.26) * 0.3);
                    
                    // Mix lines and dots for "textile weave tension"
                    float c = halftoneLine(dispUV, scaleC, angleC, offC);
                    float m = halftoneDot(dispUV, scaleM, angleM, offM);
                    float y = halftoneLine(dispUV, scaleY, angleY, offY);
                    float k = halftoneDot(dispUV, scaleK, angleK, offK);
                    
                    // Psychedelic Collage: Acid Vibration Palette
                    vec3 elecOrange = vec3(1.0, 0.42, 0.0);
                    vec3 cobaltBlue = vec3(0.0, 0.28, 1.0);
                    vec3 hotMagenta = vec3(1.0, 0.0, 0.78);
                    vec3 acidLime = vec3(0.67, 1.0, 0.0);
                    
                    vec3 color = vec3(0.0);
                    
                    // Screen-like additive blend (Cyberdelic Neon glow)
                    color += elecOrange * c * 0.9;
                    color += cobaltBlue * m * 0.9;
                    color += hotMagenta * y * 0.8;
                    color += acidLime * k * 0.8;
                    
                    // Multiply-like subtractive overprint (Physical ink density simulation)
                    color -= (elecOrange * c * cobaltBlue * m) * 0.8;
                    color -= (hotMagenta * y * acidLime * k) * 0.7;
                    color -= (cobaltBlue * m * hotMagenta * y) * 0.6;
                    
                    return color;
                }
                
                void main() {
                    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
                    
                    // Normalize mouse for WebGL space
                    vec2 mouseNorm = (u_mouse / u_resolution.xy) - 0.5;
                    mouseNorm.x *= u_resolution.x / u_resolution.y;
                    mouseNorm.y *= -1.0; 
                    
                    // Anamorphic / Observer-Dependent Distortion
                    float distToMouse = length(uv - mouseNorm);
                    vec2 offsetUV = uv + (uv - mouseNorm) * smoothstep(1.0, 0.0, distToMouse) * 0.3;
                    
                    // Temporal Feedback Moiré (Current frame)
                    vec3 colorNow = getMoire(offsetUV, u_time);
                    
                    // Temporal Feedback Moiré (Ghost trail / Memory)
                    // With chromatic hue shift (.gbr swizzle) as described in the repo
                    vec3 colorPast = getMoire(offsetUV, u_time - 0.15).gbr * 0.65;
                    
                    vec3 voidBlack = vec3(0.04, 0.02, 0.08);
                    vec3 finalColor = voidBlack + max(colorNow, colorPast);
                    
                    // Glitch Scanline (Photocopy Artifact)
                    float scan = step(0.15, fract(gl_FragCoord.y * 0.25 + u_time * 5.0));
                    finalColor *= mix(0.8, 1.0, scan);
                    
                    // Analog Zine: Paper Grain
                    finalColor += (grain(uv, u_time) - 0.5) * 0.18;
                    
                    // Vignette depth
                    float vig = 1.0 - length(uv) * 1.1;
                    finalColor *= smoothstep(-0.2, 0.8, vig);
                    
                    fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
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
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Simulate interaction or autonomous wandering if mouse is idle
    const mx = mouse.isPressed ? mouse.x : grid.width / 2 + Math.sin(time * 0.5) * grid.width * 0.3;
    const my = mouse.isPressed ? mouse.y : grid.height / 2 + Math.cos(time * 0.37) * grid.height * 0.3;
    
    material.uniforms.u_mouse.value.set(mx, my);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);