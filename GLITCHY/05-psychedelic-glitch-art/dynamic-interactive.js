if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        });
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2() },
                u_feedback: { value: rtA.texture },
                u_isPressed: { value: 0 }
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
                uniform sampler2D u_feedback;
                uniform float u_isPressed;

                #define PI 3.14159265359

                // -- Psychedelic Collage: Displacement Warp (Simplex Noise) --
                vec2 hash(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
                }
                
                float simplex(vec2 p) {
                    const float K1 = 0.366025404;
                    const float K2 = 0.211324865;
                    vec2 i = floor(p + (p.x + p.y) * K1);
                    vec2 a = p - i + (i.x + i.y) * K2;
                    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec2 b = a - o + K2;
                    vec2 c = a - 1.0 + 2.0 * K2;
                    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
                    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
                    return dot(n, vec3(70.0));
                }

                vec2 displace(vec2 uv, float time) {
                    float n1 = simplex(uv * 3.0 + time * 0.4);
                    float n2 = simplex(uv * 3.0 - time * 0.4 + 100.0);
                    return uv + vec2(n1, n2) * 0.02; 
                }

                // -- Psychedelic Collage: Kaleidoscope Pattern --
                vec2 kaleidoscope(vec2 uv, float folds, float time) {
                    vec2 p = uv * 2.0 - 1.0;
                    float angle = atan(p.y, p.x);
                    float radius = length(p);
                    
                    angle += time * 0.15; // Rotational drift
                    
                    float sector = 2.0 * PI / folds;
                    angle = mod(angle, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    
                    p = vec2(cos(angle), sin(angle)) * radius;
                    return p * 0.5 + 0.5;
                }

                // -- Crystalline: SDF Crystal Prisms --
                float sdHexagon(in vec2 p, in float r) {
                    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
                    p = abs(p);
                    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
                    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
                    return length(p) * sign(p.y);
                }

                float sdBox(in vec2 p, in vec2 b) {
                    vec2 d = abs(p) - b;
                    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
                }

                // -- Psychedelic Collage: Halftone Screen --
                float halftone(vec2 uv, float freq, float luma) {
                    float rad = radians(45.0);
                    mat2 rt = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                    vec2 cell = fract(rt * uv * freq) - 0.5;
                    float dotRad = sqrt(1.0 - luma) * 0.5;
                    return smoothstep(dotRad + 0.08, dotRad - 0.08, length(cell));
                }

                void main() {
                    vec2 uv = vUv;
                    
                    // 1. Kaleidoscope Fold on Feedback
                    vec2 kUv = kaleidoscope(uv, 8.0, u_time);
                    
                    // 2. Displacement Warp
                    vec2 dUv = displace(kUv, u_time);
                    
                    // Zoom IN for fractal feedback dive
                    dUv = (dUv - 0.5) * 0.985 + 0.5;
                    
                    // Glitch / Scan-Bend Global Pulse
                    float glitchPulse = step(0.97, fract(sin(u_time * 12.0) * 43758.5));
                    if (glitchPulse > 0.5) {
                        dUv.x += sin(uv.y * 50.0) * 0.05;
                    }
                    
                    // Mouse Interaction (Glitch Tear)
                    vec2 m = u_mouse / u_resolution;
                    vec2 mPos = (m - 0.5) * 5.0;
                    mPos.x *= u_resolution.x / u_resolution.y;
                    
                    vec2 screenP = (uv - 0.5) * 5.0;
                    screenP.x *= u_resolution.x / u_resolution.y;
                    float mouseDist = length(screenP - mPos);
                    
                    if (u_isPressed > 0.5 && mouseDist < 1.0) {
                        float tear = smoothstep(1.0, 0.0, mouseDist);
                        dUv += (screenP - mPos) * 0.08 * tear;
                    }
                    
                    // 3. Chromatic Aberration Feedback Sample
                    float r = texture(u_feedback, dUv + vec2(0.005, 0.0)).r;
                    float g = texture(u_feedback, dUv).g;
                    float b = texture(u_feedback, dUv - vec2(0.005, 0.0)).b;
                    vec3 feedbackCol = vec3(r, g, b);
                    
                    // Databending Hue Shift on Glitch
                    if (glitchPulse > 0.5) {
                        feedbackCol = feedbackCol.brg;
                    }
                    
                    // Decay towards Cyberdelic Void Black
                    vec3 voidBlack = vec3(0.015, 0.023, 0.031);
                    feedbackCol = mix(feedbackCol, voidBlack, 0.04);
                    
                    // Photocopy noise degradation
                    float noise = fract(sin(dot(uv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
                    feedbackCol -= noise * 0.03;
                    
                    // 4. Inject Crystal Lattice (Crystalline logic)
                    float scanShift = step(0.95, fract(sin(uv.y * 150.0 + u_time * 5.0) * 43758.5)) * 0.05;
                    vec2 p = screenP + vec2(scanShift, 0.0);
                    
                    // Scroll the grid
                    p.x += u_time * 0.8; 
                    p.y += sin(u_time * 0.3) * 1.5;
                    
                    vec2 id = floor(p);
                    vec2 f = fract(p) - 0.5;
                    
                    // Rotate individual crystals
                    float rotTime = u_time * 2.0 + id.x * 0.5 + id.y * 0.5;
                    mat2 rotMat = mat2(cos(rotTime), -sin(rotTime), sin(rotTime), cos(rotTime));
                    f *= rotMat;
                    
                    // Map Crystalline Data: Hexagonal vs Tetragonal
                    float isHex = step(0.5, fract(sin(dot(id, vec2(1.0, 2.0))) * 10.0));
                    float d = 1.0;
                    
                    // Sparse injection to allow feedback to breathe
                    float spawnChance = fract(sin(dot(id, vec2(5.34, 7.12))) * 43758.5);
                    if (spawnChance > 0.88) {
                        if (isHex > 0.5) {
                            // Hexagonal primitive
                            d = sdHexagon(f, 0.25);
                        } else {
                            // Tetragonal Rutile (c/a ratio ~0.644)
                            d = sdBox(f, vec2(0.25, 0.25 * 0.644));
                        }
                    }
                    
                    vec3 injectCol = vec3(0.0);
                    if (d < 0.0) {
                        // Cyberdelic Neon / Acid Vibration Palette
                        vec3 colA = vec3(0.0, 1.0, 0.941); // Neon Cyan
                        vec3 colB = vec3(1.0, 0.0, 0.8);   // Electric Magenta
                        vec3 colC = vec3(0.69, 1.0, 0.0);  // Acid Lime
                        
                        float hueSeed = fract(sin(dot(id, vec2(12.98, 78.23))) * 43758.5);
                        injectCol = mix(colA, colB, step(0.33, hueSeed));
                        injectCol = mix(injectCol, colC, step(0.66, hueSeed));
                        
                        // Internal d-spacing lattice lines
                        float dSpacing = fract(d * 25.0 - u_time * 4.0);
                        injectCol += smoothstep(0.1, 0.0, dSpacing) * vec3(1.0);
                    }
                    
                    // Mouse Interaction Glow
                    if (u_isPressed > 0.5 && mouseDist < 0.8) {
                        injectCol = mix(injectCol, vec3(1.0, 1.0, 1.0), smoothstep(0.8, 0.0, mouseDist));
                    }

                    // 5. Composite (Screen Blend for Neon Glow)
                    vec3 col = 1.0 - (1.0 - max(feedbackCol, 0.0)) * (1.0 - injectCol);
                    
                    // 6. Print Artifacts (Halftone overlay)
                    float luma = dot(col, vec3(0.299, 0.587, 0.114));
                    float ht = halftone(uv, 180.0, luma);
                    col = mix(col, col * ht * 1.5, 0.15);
                    
                    // Vignette Burn
                    float vig = length(uv - 0.5);
                    col *= smoothstep(0.85, 0.2, vig);

                    fragColor = vec4(col, 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material, rtA, rtB, pingpong: 0 };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material, rtA, rtB } = canvas.__three;

if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    // Invert Y for WebGL coordinates
    material.uniforms.u_mouse.value.set(mouse.x, grid.height - mouse.y);
    material.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
    
    // Ping-pong buffer logic for feedback loop
    const readTarget = canvas.__three.pingpong % 2 === 0 ? rtA : rtB;
    const writeTarget = canvas.__three.pingpong % 2 === 0 ? rtB : rtA;
    
    material.uniforms.u_feedback.value = readTarget.texture;
    
    renderer.setSize(grid.width, grid.height, false);
    
    // Pass 1: Render shader to the write target
    renderer.setRenderTarget(writeTarget);
    renderer.render(scene, camera);
    
    // Pass 2: Render identical output to the screen
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    
    canvas.__three.pingpong++;
}