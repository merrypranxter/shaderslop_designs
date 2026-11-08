try {
    if (!canvas.__three) {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
        if (!gl) throw new Error("WebGL2 required for reaction-diffusion ping-pong");

        const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
        
        // We use FloatType for the Gray-Scott simulation to prevent precision collapse
        const rtOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // --- SIMULATION SHADER ---
        // Marries Repo 1 (Tessellations) and Repo 2 (Reaction-Diffusion).
        // Gray-Scott runs on a Euclidean plane, but the F/K parameters are 
        // warped by a Euclidean Hexagonal Tessellation {6,3}.
        // The centers breed Turing Spots, the edges breed U-Skate gliders.
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(grid.width, grid.height) },
                uMouse: { value: new THREE.Vector3() },
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
                precision highp float;
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform vec3 uMouse;
                uniform float uTime;
                in vec2 vUv;
                out vec4 fragColor;

                // Hash for seeding
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                // Hexagonal Tessellation distance field
                float hexDistance(vec2 uv, float scale) {
                    const float sqrt3 = 1.7320508;
                    vec2 hex = vec2(uv.x * 2.0 / sqrt3, uv.y + uv.x / sqrt3) * scale;
                    vec2 hexLocal = fract(hex) - 0.5;
                    return max(abs(hexLocal.x), abs(hexLocal.y * sqrt3 + hexLocal.x) / 2.0);
                }

                void main() {
                    vec2 texel = 1.0 / uResolution;
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;

                    // Karl Sims 9-Point Laplacian
                    vec2 sum = vec2(0.0);
                    sum += texture(uState, vUv + vec2(-1.0, 0.0)*texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2(1.0, 0.0)*texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2(0.0, -1.0)*texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2(0.0, 1.0)*texel).rg * 0.2;
                    sum += texture(uState, vUv + vec2(-1.0, -1.0)*texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2(1.0, -1.0)*texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2(-1.0, 1.0)*texel).rg * 0.05;
                    sum += texture(uState, vUv + vec2(1.0, 1.0)*texel).rg * 0.05;
                    sum -= state * 1.0;

                    float reaction = u * v * v;

                    // Spatial Parameter Warping (Tessellation dictates biology)
                    // Scale hex grid slowly over time
                    float hd = hexDistance(vUv + uTime*0.005, 12.0 + sin(uTime*0.2)*2.0);
                    
                    // Core: Turing Spots (delta) | Borders: U-Skate World (pi)
                    float F = mix(0.030, 0.062, smoothstep(0.3, 0.48, hd));
                    float K = mix(0.055, 0.061, smoothstep(0.3, 0.48, hd));

                    float du = 1.0 * sum.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * sum.g + reaction - (F + K) * v;

                    float nextU = clamp(u + du, 0.0, 1.0);
                    float nextV = clamp(v + dv, 0.0, 1.0);

                    // User Interaction: Mouse injects spores (V)
                    if (uMouse.z > 0.0) {
                        float dist = length(vUv - uMouse.xy) * max(uResolution.x, uResolution.y);
                        if (dist < 15.0) {
                            nextV = 0.9;
                            nextU = 0.1;
                        }
                    }

                    // Genesis Seed
                    if (uTime < 0.1) {
                        if (hash(vUv * 100.0) > 0.99 || length(vUv - 0.5) < 0.05) {
                            nextU = 0.5;
                            nextV = 0.25;
                        } else {
                            nextU = 1.0;
                            nextV = 0.0;
                        }
                    }

                    fragColor = vec4(nextU, nextV, 0.0, 1.0);
                }
            `
        });

        // --- DISPLAY SHADER ---
        // Marries Repo 3 (Lisa Frank) and Repo 4 (Psychedelic Collage).
        // Takes the raw RD output, folds it through a kaleidoscope, maps it
        // to an Acid Vibration palette, and applies Xerox/CMYK misregistration.
        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(grid.width, grid.height) },
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
                precision highp float;
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uTime;
                in vec2 vUv;
                out vec4 fragColor;

                // Psychedelic Collage: Kaleidoscope Fold
                vec2 kaleidoscope(vec2 uv, float folds, float time) {
                    vec2 p = uv * 2.0 - 1.0;
                    float a = atan(p.y, p.x);
                    float r = length(p);
                    a += time * 0.15; // Hypnotic rotation
                    float sector = 6.2831853 / folds;
                    a = mod(a, sector);
                    a = abs(a - sector * 0.5);
                    return vec2(cos(a), sin(a)) * r * 0.5 + 0.5;
                }

                // Lisa Frank / Acid Vibration Color Mapping
                vec3 getAcidColor(vec2 uv) {
                    vec2 state = texture(uState, uv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    vec3 voidBlack = vec3(0.02, 0.01, 0.05);
                    vec3 neonCyan  = vec3(0.0, 1.0, 0.94);
                    vec3 hotMagenta = vec3(1.0, 0.0, 0.8);
                    vec3 acidLime  = vec3(0.66, 1.0, 0.0);
                    vec3 elecOrange = vec3(1.0, 0.4, 0.0);

                    // Base is deep void. U adds cyan structure.
                    vec3 col = mix(neonCyan, voidBlack, smoothstep(0.3, 1.0, u));
                    
                    // V (fungal growth) overrides with hot neon
                    col = mix(col, hotMagenta, smoothstep(0.1, 0.4, v));
                    col = mix(col, elecOrange, smoothstep(0.4, 0.7, v));
                    col = mix(col, acidLime, smoothstep(0.7, 0.95, v));
                    
                    return col;
                }

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    // 1. Kaleidoscope Fold
                    vec2 kUv = kaleidoscope(vUv, 6.0, uTime);
                    
                    // 2. CMYK Misregistration (Psychedelic Collage artifact)
                    vec2 offsetR = vec2(3.0, -2.0) / uResolution.xy;
                    vec2 offsetB = vec2(-2.0, 3.0) / uResolution.xy;
                    
                    float r = getAcidColor(kUv + offsetR).r;
                    float g = getAcidColor(kUv).g;
                    float b = getAcidColor(kUv + offsetB).b;
                    vec3 color = vec3(r, g, b);
                    
                    // 3. Halftone Screen
                    float freq = 200.0;
                    vec2 cell = fract(vUv * freq) - 0.5;
                    float dist = length(cell);
                    float luma = dot(color, vec3(0.299, 0.587, 0.114));
                    float radius = sqrt(luma) * 0.6;
                    float halftone = smoothstep(radius + 0.1, radius - 0.1, dist);
                    
                    // Multiply halftone (simulates ink on paper)
                    color *= mix(0.15, 1.0, halftone);
                    
                    // 4. Paper Grain / Xerox Noise Overlay
                    color *= 0.85 + 0.15 * hash(vUv * uTime);

                    fragColor = vec4(color, 1.0);
                }
            `
        });

        const sceneSim = new THREE.Scene();
        const meshSim = new THREE.Mesh(geometry, simMaterial);
        sceneSim.add(meshSim);

        const sceneDisp = new THREE.Scene();
        const meshDisp = new THREE.Mesh(geometry, displayMaterial);
        sceneDisp.add(meshDisp);

        canvas.__three = {
            renderer, rtA, rtB, camera, sceneSim, sceneDisp, simMaterial, displayMaterial
        };
    }

    const { renderer, rtA, rtB, camera, sceneSim, sceneDisp, simMaterial, displayMaterial } = canvas.__three;

    // Handle Resize
    if (rtA.width !== grid.width || rtA.height !== grid.height) {
        rtA.setSize(grid.width, grid.height);
        rtB.setSize(grid.width, grid.height);
        renderer.setSize(grid.width, grid.height, false);
        simMaterial.uniforms.uResolution.value.set(grid.width, grid.height);
        displayMaterial.uniforms.uResolution.value.set(grid.width, grid.height);
    }

    // Update Uniforms
    simMaterial.uniforms.uTime.value = time;
    simMaterial.uniforms.uMouse.value.set(
        mouse.x / grid.width, 
        1.0 - (mouse.y / grid.height), 
        mouse.isPressed ? 1.0 : 0.0
    );
    displayMaterial.uniforms.uTime.value = time;

    // Ping-Pong RD Simulation Loop (12 steps per frame for organic speed)
    let currentRT = canvas.__three.rtA;
    let nextRT = canvas.__three.rtB;
    
    for (let i = 0; i < 12; i++) {
        simMaterial.uniforms.uState.value = currentRT.texture;
        renderer.setRenderTarget(nextRT);
        renderer.render(sceneSim, camera);
        
        let temp = currentRT;
        currentRT = nextRT;
        nextRT = temp;
    }
    
    // Save state for next frame
    canvas.__three.rtA = currentRT;
    canvas.__three.rtB = nextRT;

    // Render to Screen Display
    renderer.setRenderTarget(null);
    displayMaterial.uniforms.uState.value = currentRT.texture;
    renderer.render(sceneDisp, camera);

} catch (e) {
    console.error("Fungal Tessellation Initialization Failed:", e);
    // Fallback if WebGL2 is not supported
    if (typeof ctx !== 'undefined' && ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#FF00C8';
        ctx.font = '14px monospace';
        ctx.fillText("WebGL2 Context Failed/Lost. Acid Fungi requires GPU.", 20, 40);
    }
}