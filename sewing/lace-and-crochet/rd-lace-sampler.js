try {
    if (!ctx) throw new Error("WebGL context not available");

    // Initialize Three.js WebGL environment if not present or resized
    if (!canvas.__three || canvas.__three.width !== grid.width || canvas.__three.height !== grid.height) {
        
        // Clean up previous instances if resizing
        if (canvas.__three) {
            canvas.__three.renderer.dispose();
            canvas.__three.rtA.dispose();
            canvas.__three.rtB.dispose();
        }

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: false, antialias: false });
        renderer.setSize(grid.width, grid.height, false);
        
        // Use FloatType for precise reaction-diffusion simulation
        const rtOptions = {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const simScene = new THREE.Scene();
        const renderScene = new THREE.Scene();

        // --- INIT SHADER: Seeds the initial RD state ---
        const initMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { u_res: { value: new THREE.Vector2(grid.width, grid.height) } },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2 u_res;
                in vec2 vUv;
                out vec4 fragColor;
                
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    p.x *= u_res.x / u_res.y;
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    
                    float v = 0.0;
                    
                    // Central seed
                    if (r < 0.1) v = 1.0;
                    
                    // Radial seeds for lace medallions
                    if (abs(r - 0.4) < 0.05 && mod(a, 0.523) < 0.1) v = 1.0;
                    if (abs(r - 0.8) < 0.05 && mod(a + 0.261, 0.523) < 0.1) v = 1.0;
                    
                    // Random noise seeds
                    if (hash(vUv * 100.0) > 0.99) v = 1.0;
                    
                    // R = U (Activator), G = V (Inhibitor/Reagent), B = Reaction Rate
                    fragColor = vec4(1.0, clamp(v, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        // Render init state to rtA
        const initQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMat);
        simScene.add(initQuad);
        renderer.setRenderTarget(rtA);
        renderer.render(simScene, camera);
        simScene.remove(initQuad);

        // --- SIMULATION SHADER: Gray-Scott + Cyclic Symmetry Fold ---
        const simMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_tex: { value: rtA.texture },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mouse_pressed: { value: 0.0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D u_tex;
                uniform vec2 u_res;
                uniform float u_time;
                uniform vec2 u_mouse;
                uniform float u_mouse_pressed;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                // 9-point Laplacian for isotropic diffusion
                vec2 laplacian(vec2 uv, vec2 texel) {
                    vec2 sum = vec2(0.0);
                    sum += texture(u_tex, uv + vec2(-1.0, 0.0)*texel).rg * 0.2;
                    sum += texture(u_tex, uv + vec2(1.0, 0.0)*texel).rg * 0.2;
                    sum += texture(u_tex, uv + vec2(0.0, -1.0)*texel).rg * 0.2;
                    sum += texture(u_tex, uv + vec2(0.0, 1.0)*texel).rg * 0.2;
                    sum += texture(u_tex, uv + vec2(-1.0, -1.0)*texel).rg * 0.05;
                    sum += texture(u_tex, uv + vec2(1.0, -1.0)*texel).rg * 0.05;
                    sum += texture(u_tex, uv + vec2(-1.0, 1.0)*texel).rg * 0.05;
                    sum += texture(u_tex, uv + vec2(1.0, 1.0)*texel).rg * 0.05;
                    sum -= texture(u_tex, uv).rg * 1.0;
                    return sum;
                }
                
                void main() {
                    vec2 texel = 1.0 / u_res;
                    vec2 state = texture(u_tex, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Coordinate fold for cyclic lace medallions
                    vec2 p = vUv * 2.0 - 1.0;
                    p.x *= u_res.x / u_res.y;
                    
                    // Slow crawl drift
                    p += vec2(sin(u_time * 0.1), cos(u_time * 0.15)) * 0.2;
                    
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    
                    // 12-fold cyclic symmetry
                    float sym = 12.0;
                    float a_fold = mod(a, 6.28318 / sym) - (3.14159 / sym);
                    
                    // Petal scaffold
                    float petal = cos(r * 22.0) * cos(a_fold * sym);
                    
                    // Modulate feed (F) and kill (k) rates to force lace patterns
                    // F bounds [0.023, 0.053] -> Spot/Maze/Dead zones
                    float F = 0.038 + 0.015 * petal; 
                    
                    // Breathing kill rate
                    float k = 0.059 + 0.003 * sin(r * 10.0 - u_time * 0.5);
                    
                    // Organic noise perturbation
                    F += 0.002 * sin(vUv.x * 50.0 + u_time);
                    
                    vec2 lap = laplacian(vUv, texel);
                    float reaction = u * v * v;
                    
                    // Diffusion constants
                    float Du = 1.0;
                    float Dv = 0.5;
                    
                    float du = Du * lap.r - reaction + F * (1.0 - u);
                    float dv = Dv * lap.g + reaction - (F + k) * v;
                    
                    u += du;
                    v += dv;
                    
                    // Mouse injection (drops reagent)
                    if (u_mouse_pressed > 0.5) {
                        vec2 dMouse = vUv - u_mouse;
                        dMouse.x *= u_res.x / u_res.y;
                        if (length(dMouse) < 0.03) {
                            v = 1.0;
                            u = 0.0;
                        }
                    }
                    
                    fragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), reaction, 1.0);
                }
            `
        });

        const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat);
        simScene.add(simQuad);

        // --- RENDER SHADER: Rave Lace Material & Lighting ---
        const renderMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_tex: { value: rtA.texture },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D u_tex;
                uniform vec2 u_res;
                uniform float u_time;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                // Blue noise / Sparkle hash
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                
                void main() {
                    vec2 texel = 1.0 / u_res;
                    
                    // Read current state
                    vec4 state = texture(u_tex, vUv);
                    float u = state.r;
                    float v = state.g;
                    float reaction = state.b;
                    
                    // Compute gradients for normal & edge detection
                    float vx1 = texture(u_tex, vUv + vec2(texel.x, 0.0)).g;
                    float vx0 = texture(u_tex, vUv - vec2(texel.x, 0.0)).g;
                    float vy1 = texture(u_tex, vUv + vec2(0.0, texel.y)).g;
                    float vy0 = texture(u_tex, vUv - vec2(0.0, texel.y)).g;
                    
                    float dx = (vx1 - vx0) * 0.5;
                    float dy = (vy1 - vy0) * 0.5;
                    float gradMag = length(vec2(dx, dy));
                    
                    // Generate normals for embroidery relief
                    vec3 N = normalize(vec3(dx * 15.0, dy * 15.0, 0.15));
                    vec3 L = normalize(vec3(0.5, 0.5, 1.0));
                    vec3 V = vec3(0.0, 0.0, 1.0);
                    vec3 H = normalize(L + V);
                    
                    float diff = max(dot(N, L), 0.0);
                    float spec = pow(max(dot(N, H), 0.0), 32.0);
                    
                    // Fake drop shadow
                    float shadow = texture(u_tex, vUv - vec2(0.008, 0.008)).g;
                    
                    // Masks
                    // Breathing fabric holes
                    float laceThreshold = 0.12 + 0.04 * sin(u_time * 1.5);
                    float isLace = smoothstep(laceThreshold, laceThreshold + 0.1, v);
                    float isEdge = smoothstep(0.005, 0.03, gradMag);
                    float isGrowth = smoothstep(0.002, 0.015, reaction);
                    
                    // Palettes
                    vec3 baseViolet = vec3(0.06, 0.0, 0.15);
                    vec3 cyanInt = vec3(0.0, 0.8, 1.0);
                    vec3 acidGreen = vec3(0.5, 1.0, 0.0);
                    vec3 hotPink = vec3(1.0, 0.05, 0.5);
                    vec3 bloomOrange = vec3(1.0, 0.5, 0.0);
                    
                    // Background with shadow
                    vec3 col = mix(baseViolet, vec3(0.0), smoothstep(0.05, 0.3, shadow) * 0.7);
                    
                    // Lace Interior (Cyan to Acid Green)
                    vec3 laceCol = mix(cyanInt, acidGreen, v);
                    laceCol *= (0.4 + 0.6 * diff);
                    
                    // Lace Edges / Thread rims (Hot Pink + Anisotropic shimmer)
                    float aniso = 0.5 + 0.5 * sin(gradMag * 100.0 - u_time * 5.0);
                    vec3 edgeCol = hotPink * (1.0 + spec * 2.5 + aniso * 0.5);
                    
                    // Reaction Front Bloom
                    laceCol = mix(laceCol, bloomOrange, isGrowth * 1.5);
                    
                    // Composite Layering
                    vec3 finalLace = mix(laceCol, edgeCol, isEdge);
                    col = mix(col, finalLace, isLace);
                    
                    // Sparkles (Dense at thread junctions)
                    float isJunction = smoothstep(0.3, 0.6, v) * (1.0 - smoothstep(0.0, 0.02, gradMag));
                    float sparkHash = hash(vUv * 900.0 + fract(u_time * 2.0));
                    float spark = step(0.98, sparkHash) * isJunction * isLace;
                    col += vec3(1.0) * spark * 3.0; // White bead sparkle
                    
                    // Optical Vignette
                    float dist = length(vUv - 0.5);
                    col *= smoothstep(0.8, 0.3, dist);
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });

        const renderQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), renderMat);
        renderScene.add(renderQuad);

        canvas.__three = { 
            renderer, rtA, rtB, 
            simScene, simMat, 
            renderScene, renderMat, 
            camera, width: grid.width, height: grid.height 
        };
    }

    const tData = canvas.__three;

    // Update Mouse Uniforms
    if (tData.simMat && tData.simMat.uniforms) {
        tData.simMat.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - (mouse.y / grid.height));
        tData.simMat.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
        tData.simMat.uniforms.u_time.value = time;
    }
    
    if (tData.renderMat && tData.renderMat.uniforms) {
        tData.renderMat.uniforms.u_time.value = time;
    }

    // Ping-Pong Simulation Loop (12 steps per frame for organic crawling speed)
    const SIM_STEPS = 12;
    for (let i = 0; i < SIM_STEPS; i++) {
        tData.simMat.uniforms.u_tex.value = tData.rtA.texture;
        tData.renderer.setRenderTarget(tData.rtB);
        tData.renderer.render(tData.simScene, tData.camera);

        // Swap buffers
        let temp = tData.rtA;
        tData.rtA = tData.rtB;
        tData.rtB = temp;
    }

    // Final Render Pass to Canvas
    tData.renderMat.uniforms.u_tex.value = tData.rtA.texture;
    tData.renderer.setRenderTarget(null);
    tData.renderer.render(tData.renderScene, tData.camera);

} catch (e) {
    console.error("Reaction-Diffusion Lace Init Failed:", e);
}