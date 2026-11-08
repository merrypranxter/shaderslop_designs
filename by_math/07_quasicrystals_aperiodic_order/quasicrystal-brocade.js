if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
        camera.position.z = 1;
        
        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            precision highp float;
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec3 u_mouse;
            
            struct Surface {
                float h;
                float embMask;
                float threadDir; 
            };

            // Generates the quasicrystal heightfield, thread structure, and embroidery mask
            Surface mapSur(vec2 pos) {
                // 12-fold Quasicrystal mathematical loom
                float qc = 0.0;
                float scale = 5.0;
                for (int i = 0; i < 12; i++) {
                    float angle = float(i) * 3.1415926535 / 12.0;
                    vec2 dir = vec2(cos(angle), sin(angle));
                    // Gentle phase drift to make the pattern alive
                    float phase = sin(u_time * 0.05 + float(i) * 2.0) * 0.3;
                    qc += cos(dot(pos, dir) * scale + u_time * 0.15 + phase);
                }
                qc /= 12.0; 
                qc = qc * 4.0; // Boost amplitude to isolate interference peaks
                
                // Secondary Moire ribbing
                float moire = 0.0;
                for(int i = 0; i < 3; i++){
                    float angle = float(i) * 3.1415926535 / 3.0 + u_time * 0.02;
                    vec2 dir = vec2(cos(angle), sin(angle));
                    moire += cos(dot(pos, dir) * 60.0);
                }
                moire /= 3.0;
                
                // Organic fiber noise (continuous along threads)
                float fNoiseX = sin(pos.y * 150.0) * 0.15;
                float fNoiseY = sin(pos.x * 150.0) * 0.15;
                
                // Alternating Warp/Weft Cloth Structure
                float threadFreq = 200.0;
                float wx = cos(pos.x * threadFreq + fNoiseX); // Vertical threads
                float wy = cos(pos.y * threadFreq + fNoiseY); // Horizontal threads
                float cx = cos(pos.x * threadFreq * 0.08);
                float cy = cos(pos.y * threadFreq * 0.08);
                float mask = smoothstep(-0.1, 0.1, cx * cy); // Over/under checkerboard logic
                float cloth = mix(wy, wx, mask) * 0.025;
                
                // Raised Metallic Embroidery at Quasicrystal Nodes
                float embMask = smoothstep(0.4, 0.9, qc);
                float mThread = cos(dot(pos, vec2(0.707, -0.707)) * threadFreq * 0.6); // Diagonal stitching
                float embH = embMask * (0.1 + 0.03 * mThread);
                
                Surface s;
                s.h = cloth + embH + qc * 0.03 + moire * 0.01 * (1.0 - embMask);
                s.embMask = embMask;
                
                // Track thread direction for anisotropic highlights
                s.threadDir = mix(0.0, 1.0, mask);
                if (embMask > 0.01) s.threadDir = 2.0;
                
                return s;
            }

            float map(vec2 pos) {
                return mapSur(pos).h;
            }

            void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                p.x *= u_resolution.x / u_resolution.y;
                
                vec2 m = (u_mouse.xy / u_resolution.xy - 0.5) * 2.0;
                m.x *= u_resolution.x / u_resolution.y;
                
                // Interactive Fabric Brushing (Twists threads based on mouse proximity)
                vec2 delta = p - m;
                float r = length(delta);
                float twistAngle = exp(-r * 4.0) * (0.2 + 1.0 * u_mouse.z) * sin(u_time * 2.0);
                float st = sin(twistAngle), ct = cos(twistAngle);
                mat2 rot = mat2(ct, -st, st, ct);
                vec2 p_distorted = m + rot * delta;
                
                // Slow global fabric drift
                p_distorted += vec2(sin(u_time * 0.1), cos(u_time * 0.08)) * 0.2;
                
                // Compute Normals via Heightfield Derivatives
                vec2 eps = vec2(0.003, 0.0);
                float h0 = map(p_distorted);
                float hX = map(p_distorted + eps.xy);
                float hY = map(p_distorted + eps.yx);
                vec3 N = normalize(vec3(h0 - hX, h0 - hY, eps.x * 1.5));
                
                Surface surf = mapSur(p_distorted);
                
                // Lighting Setup (Slowly shifting silk shimmer)
                vec3 L = normalize(vec3(sin(u_time * 0.4) * 0.6, cos(u_time * 0.25) * 0.6, 1.0));
                vec3 V = normalize(vec3(0.0, 0.0, 1.0));
                vec3 H = normalize(L + V);
                
                // Anisotropic Specular Tangent
                vec3 T;
                if (surf.threadDir < 0.5) {
                    T = vec3(1.0, 0.0, 0.0); // Weft (Horizontal)
                } else if (surf.threadDir < 1.5) {
                    T = vec3(0.0, 1.0, 0.0); // Warp (Vertical)
                } else {
                    T = normalize(vec3(1.0, -1.0, 0.0)); // Embroidery (Diagonal)
                }
                T = normalize(T - N * dot(N, T)); // Project tangent onto surface normal
                
                float TH = dot(T, H);
                float sinTH = sqrt(max(0.0, 1.0 - TH * TH));
                float spec = pow(sinTH, 18.0); 
                
                float diff = max(dot(N, L), 0.0);
                float ao = clamp(surf.h * 15.0 + 0.5, 0.0, 1.0); 
                
                // --- Palette Application ---
                
                // Silk Base: Ultraviolet shadows to Hot Pink highlights
                vec3 baseColor = mix(vec3(0.25, 0.0, 0.5), vec3(1.0, 0.1, 0.55), diff); 
                vec3 specColor = vec3(0.0, 0.9, 1.0); // Cyan thread highlights
                
                // Metallic Embroidery
                if (surf.embMask > 0.0) {
                    float ndotv = max(dot(N, V), 0.0);
                    // Structural color iridescence (Bragg reflection proxy)
                    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vec3(1.0, 1.0, 1.0) * ndotv + vec3(0.0, 0.33, 0.67)));
                    
                    // Acid Yellow to Orange
                    vec3 embBase = mix(vec3(1.0, 0.3, 0.0), vec3(0.8, 1.0, 0.0), diff);
                    baseColor = mix(baseColor, embBase * irid, surf.embMask);
                    specColor = mix(specColor, vec3(1.0, 0.9, 0.8), surf.embMask); // White-hot sparkle
                }
                
                // Orange Micro-glints (Procedural scintillation)
                float glint = fract(sin(dot(p_distorted, vec2(12.9898, 78.233))) * 43758.5453);
                float glintSpec = step(0.96, glint) * pow(max(dot(N, H), 0.0), 10.0);
                vec3 glintColor = vec3(1.0, 0.6, 0.0) * glintSpec * surf.embMask * 4.0;
                
                vec3 color = baseColor * ao + specColor * spec * 1.8 + glintColor;
                
                // Velvet-like Rim Light
                float rim = 1.0 - max(dot(N, V), 0.0);
                color += vec3(0.6, 0.0, 0.9) * pow(rim, 2.5) * (1.0 - surf.embMask) * 0.8;
                
                // ACES Tone Mapping for cinematic lux
                color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
                
                fragColor = vec4(color, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector3() }
            },
            vertexShader,
            fragmentShader
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

if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Invert Y for correct WebGL UV space mapping
    const mouseX = mouse.x;
    const mouseY = grid.height - mouse.y;
    const isPressed = mouse.isPressed ? 1.0 : 0.0;
    
    material.uniforms.u_mouse.value.set(mouseX, mouseY, isPressed);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);