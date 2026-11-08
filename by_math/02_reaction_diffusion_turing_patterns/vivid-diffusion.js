try {
    if (!ctx) throw new Error("WebGL context required");

    // Initialize Three.js environment if it doesn't exist
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1.0); // Keep 1:1 for simulation stability
        
        // Use HalfFloat for high precision reaction-diffusion without performance death
        const targetConfig = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        const simSize = 512; // Fixed simulation resolution
        const targetA = new THREE.WebGLRenderTarget(simSize, simSize, targetConfig);
        const targetB = new THREE.WebGLRenderTarget(simSize, simSize, targetConfig);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(2, 2);

        // --- SEED SHADER ---
        const seedMaterial = new THREE.ShaderMaterial({
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
                
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    float r = length(p);
                    float u = 1.0;
                    float v = 0.0;

                    // Feral chaotic injection seed
                    float noise = hash(vUv * 15.0);
                    float angle = atan(p.y, p.x);
                    float star = cos(angle * 5.0) * 0.2;
                    
                    if (r < 0.2 + star + noise * 0.1 || (r > 0.4 && r < 0.45 && hash(vUv) > 0.7)) {
                        u = 0.5;
                        v = 0.25 + noise * 0.1;
                    }

                    fragColor = vec4(u, v, 0.0, 1.0);
                }
            `
        });

        // --- SIMULATION SHADER (Gray-Scott + Advection) ---
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(simSize, simSize) },
                uF: { value: 0.0545 },
                uk: { value: 0.0620 },
                uTime: { value: 0.0 }
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
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uF;
                uniform float uk;
                uniform float uTime;

                void main() {
                    vec2 texel = 1.0 / uResolution;
                    
                    // Reaction-advection (fluid warp based on V gradient)
                    float dx = texture(uState, vUv + vec2(texel.x, 0.0)).g - texture(uState, vUv - vec2(texel.x, 0.0)).g;
                    float dy = texture(uState, vUv + vec2(0.0, texel.y)).g - texture(uState, vUv - vec2(0.0, texel.y)).g;
                    vec2 advect = vec2(dx, dy) * texel * 2.0;
                    
                    vec2 fetchUv = fract(vUv - advect); // Toroidal wrap
                    vec4 state = texture(uState, fetchUv);
                    float u = state.r;
                    float v = state.g;

                    // Karl Sims 9-point Laplacian
                    vec2 sum = vec2(0.0);
                    sum += texture(uState, fract(fetchUv + vec2(-1.0,  0.0) * texel)).rg * 0.2;
                    sum += texture(uState, fract(fetchUv + vec2( 1.0,  0.0) * texel)).rg * 0.2;
                    sum += texture(uState, fract(fetchUv + vec2( 0.0, -1.0) * texel)).rg * 0.2;
                    sum += texture(uState, fract(fetchUv + vec2( 0.0,  1.0) * texel)).rg * 0.2;
                    sum += texture(uState, fract(fetchUv + vec2(-1.0, -1.0) * texel)).rg * 0.05;
                    sum += texture(uState, fract(fetchUv + vec2( 1.0, -1.0) * texel)).rg * 0.05;
                    sum += texture(uState, fract(fetchUv + vec2(-1.0,  1.0) * texel)).rg * 0.05;
                    sum += texture(uState, fract(fetchUv + vec2( 1.0,  1.0) * texel)).rg * 0.05;
                    sum -= state.rg; // center weight -1.0

                    float uvv = u * v * v;
                    
                    // Domain warping on parameters for parasitic growth
                    float warp = sin(vUv.x * 20.0 + uTime) * cos(vUv.y * 20.0 - uTime) * 0.003;
                    float F = uF + warp;
                    float K = uk - warp;

                    float du = 1.0 * sum.r - uvv + F * (1.0 - u);
                    float dv = 0.5 * sum.g + uvv - (F + K) * v;

                    fragColor = vec4(clamp(u + du, 0.0, 1.0), clamp(v + dv, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        // --- DISPLAY SHADER (Structural Color & Acid Palettes, NO BLACK/WHITE) ---
        const displayMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(simSize, simSize) },
                uTime: { value: 0.0 }
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
                in vec2 vUv;
                out vec4 fragColor;
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uTime;

                // Cyberdelic / Acid Vibration palette interpolation
                vec3 getAcidColor(float t) {
                    t = fract(t);
                    vec3 c1 = vec3(1.0, 0.0, 0.4);   // Hot Magenta
                    vec3 c2 = vec3(0.0, 0.3, 1.0);   // Cobalt Blue
                    vec3 c3 = vec3(0.6, 1.0, 0.0);   // Acid Lime
                    vec3 c4 = vec3(1.0, 0.4, 0.0);   // Electric Orange
                    vec3 c5 = vec3(0.0, 1.0, 0.9);   // Neon Cyan
                    
                    vec3 col = mix(c1, c2, smoothstep(0.0, 0.25, t));
                    col = mix(col, c3, smoothstep(0.25, 0.5, t));
                    col = mix(col, c4, smoothstep(0.5, 0.75, t));
                    col = mix(col, c5, smoothstep(0.75, 1.0, t));
                    return col;
                }

                void main() {
                    vec2 texel = 1.0 / uResolution;
                    vec4 state = texture(uState, vUv);
                    float u = state.r;
                    float v = state.g;

                    // Compute pseudo-normals for Bragg reflection/thin film interference
                    float dx = texture(uState, vUv + vec2(texel.x, 0.0)).g - texture(uState, vUv - vec2(texel.x, 0.0)).g;
                    float dy = texture(uState, vUv + vec2(0.0, texel.y)).g - texture(uState, vUv - vec2(0.0, texel.y)).g;
                    vec3 normal = normalize(vec3(dx * 20.0, dy * 20.0, 1.0));
                    float cosTheta = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));

                    // Structural color phase shift (Repo 2)
                    float thickness = 100.0 + v * 800.0;
                    float phase = (2.0 * 1.5 * thickness * cosTheta) / 400.0;

                    // Chromatic aberration split (Repo 3)
                    float shift = 0.05 * (1.0 - u);
                    vec3 color;
                    color.r = getAcidColor(phase + uTime * 0.2).r;
                    color.g = getAcidColor(phase * 1.05 + uTime * 0.2 + shift).g;
                    color.b = getAcidColor(phase * 1.1 + uTime * 0.2 - shift).b;

                    // Inject raw neon highlights based on rate of change
                    float activity = abs(dx) + abs(dy);
                    color = mix(color, vec3(1.0, 0.9, 0.0), smoothstep(0.02, 0.08, activity)); // Yellow/Gold spikes

                    // STRICT AVOIDANCE OF BLACK AND WHITE
                    // Clamp and push luminance into mid-high vibrant ranges
                    float lum = dot(color, vec3(0.299, 0.587, 0.114));
                    if (lum < 0.2) color = mix(color, vec3(0.8, 0.0, 1.0), 0.8); // Push darks to violet
                    if (lum > 0.8) color = mix(color, vec3(0.0, 1.0, 0.8), 0.8); // Push brights to cyan
                    
                    // Final clamp to absolutely prevent #000000 or #FFFFFF
                    color = clamp(color, vec3(0.05, 0.1, 0.1), vec3(0.95, 0.9, 0.95));

                    fragColor = vec4(color, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, seedMaterial);
        scene.add(mesh);

        // Seed the simulation
        renderer.setRenderTarget(targetA);
        renderer.render(scene, camera);
        renderer.setRenderTarget(targetB);
        renderer.render(scene, camera);

        // Swap material to simulation for the loop
        mesh.material = simMaterial;

        canvas.__three = {
            renderer,
            scene,
            camera,
            mesh,
            targetA,
            targetB,
            simMaterial,
            displayMaterial
        };
    }

    const { renderer, scene, camera, mesh, simMaterial, displayMaterial } = canvas.__three;
    let { targetA, targetB } = canvas.__three;

    // Ensure size matches canvas geometry
    renderer.setSize(grid.width, grid.height, false);

    // Oscillate Gray-Scott parameters to traverse Pearson types (Spots <-> Chaos <-> U-Skate)
    // F: 0.025 to 0.060
    // k: 0.050 to 0.065
    const dynamicF = 0.042 + Math.sin(time * 0.1) * 0.017;
    const dynamick = 0.058 + Math.cos(time * 0.13) * 0.007;

    if (simMaterial.uniforms) {
        simMaterial.uniforms.uF.value = dynamicF;
        simMaterial.uniforms.uk.value = dynamick;
        simMaterial.uniforms.uTime.value = time;
    }

    // Ping-pong simulation loop (16 steps per frame for fast feral growth)
    mesh.material = simMaterial;
    for (let i = 0; i < 16; i++) {
        simMaterial.uniforms.uState.value = targetA.texture;
        renderer.setRenderTarget(targetB);
        renderer.render(scene, camera);

        // Swap
        const temp = targetA;
        targetA = targetB;
        targetB = temp;
    }

    // Save swapped targets back to cache
    canvas.__three.targetA = targetA;
    canvas.__three.targetB = targetB;

    // Render to screen using Display Shader
    mesh.material = displayMaterial;
    if (displayMaterial.uniforms) {
        displayMaterial.uniforms.uState.value = targetA.texture;
        displayMaterial.uniforms.uTime.value = time;
    }
    
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral WebGL Error:", e);
}