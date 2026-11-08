try {
    // Feral Mechanism: Acid-Warped Cyclic Symmetry Turing Morphogenesis
    // We reject standard Gray-Scott spots. Instead, we build a wet engine where 
    // the feed (F) and kill (k) rates are warped by a rotating cyclic domain (kaleidoscope),
    // driving the simulation into different Pearson classifications simultaneously 
    // (U-Skate World in the center, Wavelet Chaos at the edges). 
    // We then render this through a Cyberdelic Neon / Acid Vibration palette,
    // offset by CMYK misregistration and halftone print artifacts.

    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;
        
        const sceneSim = new THREE.Scene();
        const sceneRender = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // FloatType is crucial for Reaction-Diffusion precision
        const rtOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
            depthBuffer: false,
            stencilBuffer: false
        };

        let rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        let rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);

        const plane = new THREE.PlaneGeometry(2, 2);

        // 1. SEEDING SHADER: Full canvas cellular noise + occult radial glyphs
        const initMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
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
                
                void main() {
                    // Cellular full-canvas seed
                    vec2 gv = fract(vUv * 30.0) - 0.5;
                    vec2 id = floor(vUv * 30.0);
                    float n = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
                    float v = smoothstep(0.4, 0.1, length(gv)) * step(0.6, n);
                    
                    // Macro sacred geometry / radial rings
                    vec2 centered = vUv - 0.5;
                    float d = length(centered);
                    v += smoothstep(0.02, 0.0, abs(d - 0.15));
                    v += smoothstep(0.01, 0.0, abs(d - 0.35)) * step(0.0, sin(atan(centered.y, centered.x) * 12.0));
                    
                    // Cross cut
                    v += smoothstep(0.005, 0.0, abs(vUv.x - 0.5)) * smoothstep(0.0, 0.3, 0.5 - abs(vUv.y - 0.5));
                    v += smoothstep(0.005, 0.0, abs(vUv.y - 0.5)) * smoothstep(0.0, 0.3, 0.5 - abs(vUv.x - 0.5));
                    
                    fragColor = vec4(1.0, clamp(v, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        // Initialize FBO A with the seed
        const initMesh = new THREE.Mesh(plane, initMaterial);
        sceneSim.add(initMesh);
        renderer.setRenderTarget(rtA);
        renderer.render(sceneSim, camera);
        sceneSim.remove(initMesh);

        // 2. SIMULATION SHADER: Cyclic warped Gray-Scott with gradient advection
        const simMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: rtA.texture },
                uRes: { value: new THREE.Vector2(grid.width, grid.height) },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uMousePress: { value: 0.0 }
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
                uniform vec2 uRes;
                uniform float uTime;
                uniform vec2 uMouse;
                uniform float uMousePress;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                void main() {
                    vec2 texel = 1.0 / uRes;
                    
                    // Gradient Advection: The fluid smears itself down its own concentration gradient
                    float uR = texture(uState, vUv + vec2(texel.x, 0.0)).r;
                    float uL = texture(uState, vUv - vec2(texel.x, 0.0)).r;
                    float uT = texture(uState, vUv + vec2(0.0, texel.y)).r;
                    float uB = texture(uState, vUv - vec2(0.0, texel.y)).r;
                    vec2 grad = vec2(uR - uL, uT - uB);
                    
                    // Swirling advection offset
                    vec2 advectUv = vUv + grad * 0.005 * sin(uTime * 0.5 + length(vUv-0.5)*10.0);
                    
                    vec2 state = texture(uState, advectUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Karl Sims 9-point Laplacian
                    vec2 sum = vec2(0.0);
                    sum += texture(uState, advectUv + vec2(-1.0,  0.0) * texel).rg * 0.2;
                    sum += texture(uState, advectUv + vec2( 1.0,  0.0) * texel).rg * 0.2;
                    sum += texture(uState, advectUv + vec2( 0.0, -1.0) * texel).rg * 0.2;
                    sum += texture(uState, advectUv + vec2( 0.0,  1.0) * texel).rg * 0.2;
                    sum += texture(uState, advectUv + vec2(-1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(uState, advectUv + vec2( 1.0, -1.0) * texel).rg * 0.05;
                    sum += texture(uState, advectUv + vec2(-1.0,  1.0) * texel).rg * 0.05;
                    sum += texture(uState, advectUv + vec2( 1.0,  1.0) * texel).rg * 0.05;
                    sum -= state * 1.0;
                    
                    // Domain Warping: Cyclic folding for diatom/mandala morphology
                    vec2 centered = vUv - 0.5;
                    float r = length(centered);
                    float theta = atan(centered.y, centered.x);
                    
                    // Feral Math: 7-fold symmetry interacting with a radial wave
                    float fold = cos(theta * 7.0 + sin(r * 15.0 - uTime));
                    
                    // Map spatial coordinates to Pearson Classification regimes
                    // F transitions from Unstable Stripes (0.022) to U-Skate World (0.062)
                    float F = mix(0.022, 0.062, abs(fold) * smoothstep(0.0, 0.6, r) + 0.1);
                    // k transitions from Wavelet Chaos (0.047) to Inert Solitons (0.067)
                    float k = mix(0.047, 0.067, r + 0.2 * sin(uTime * 0.2));
                    
                    float reaction = u * v * v;
                    
                    // Diffuse, React, Feed, Kill
                    float du = 1.0 * sum.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * sum.g + reaction - (F + k) * v;
                    
                    // Interactive Infection: Mouse injects activator (V)
                    float mDist = length(vUv - uMouse);
                    if (uMousePress > 0.5 && mDist < 0.05) {
                        dv += 0.2 * smoothstep(0.05, 0.0, mDist);
                    }
                    
                    fragColor = vec4(clamp(u + du, 0.0, 1.0), clamp(v + dv, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        const simMesh = new THREE.Mesh(plane, simMaterial);
        sceneSim.add(simMesh);

        // 3. RENDER SHADER: Psychedelic Collage / Acid Vibration Print Artifacts
        const renderMaterial = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: rtA.texture },
                uRes: { value: new THREE.Vector2(grid.width, grid.height) },
                uTime: { value: 0 }
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
                uniform vec2 uRes;
                uniform float uTime;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                // Cyberdelic Neon / Acid Vibration Palette
                vec3 getPalette(float v) {
                    vec3 voidBlack = vec3(0.01, 0.02, 0.04);
                    vec3 uvBlue = vec3(0.1, 0.0, 0.8);
                    vec3 hotMagenta = vec3(1.0, 0.0, 0.8);
                    vec3 acidLime = vec3(0.7, 1.0, 0.0);
                    
                    vec3 c = mix(voidBlack, uvBlue, smoothstep(0.0, 0.3, v));
                    c = mix(c, hotMagenta, smoothstep(0.2, 0.6, v));
                    c = mix(c, acidLime, smoothstep(0.5, 1.0, v));
                    return c;
                }
                
                void main() {
                    vec2 texel = 1.0 / uRes;
                    
                    // CMYK Misregistration (RGB split for scan/glitch artifact)
                    vec2 uvR = vUv + vec2(texel.x * 6.0, 0.0);
                    vec2 uvB = vUv - vec2(texel.x * 4.0, texel.y * 5.0);
                    
                    float vC = texture(uState, vUv).g;
                    float vR = texture(uState, uvR).g;
                    float vB = texture(uState, uvB).g;
                    
                    // Structural Color / Ridge Extraction (gradient magnitude)
                    float lap = 4.0 * vC 
                              - texture(uState, vUv + vec2(texel.x, 0.0)).g
                              - texture(uState, vUv - vec2(texel.x, 0.0)).g
                              - texture(uState, vUv + vec2(0.0, texel.y)).g
                              - texture(uState, vUv - vec2(0.0, texel.y)).g;
                    float edge = smoothstep(0.05, 0.25, abs(lap));
                    
                    vec3 colBase = getPalette(vC);
                    vec3 colR = getPalette(vR);
                    vec3 colB = getPalette(vB);
                    
                    // Glitch RGB Recombination
                    vec3 finalCol = vec3(colR.r, colBase.g, colB.b);
                    
                    // Add Electric Orange highlight to high-tension ridges
                    vec3 electricOrange = vec3(1.0, 0.42, 0.0);
                    finalCol = mix(finalCol, electricOrange, edge * 0.8);
                    
                    // Print Artifact: Halftone Screen overlay
                    float luma = dot(finalCol, vec3(0.299, 0.587, 0.114));
                    float freq = 90.0;
                    vec2 cell = fract(vUv * uRes.y / (100.0 / freq)) - 0.5;
                    float dotRadius = luma * 0.8;
                    float dots = smoothstep(dotRadius + 0.15, dotRadius - 0.15, length(cell));
                    
                    // Screen/Multiply blend the halftone for a risograph texture feel
                    finalCol = mix(finalCol * (dots + 0.2), finalCol, 0.4);
                    
                    // Print Artifact: Paper Grain & Photocopy Noise
                    float noise = fract(sin(dot(vUv * uRes, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
                    finalCol += (noise - 0.5) * 0.12;
                    
                    // Vignette burn
                    float vignette = length(vUv - 0.5);
                    finalCol *= smoothstep(0.8, 0.3, vignette);
                    
                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });

        const renderMesh = new THREE.Mesh(plane, renderMaterial);
        sceneRender.add(renderMesh);

        canvas.__three = { renderer, sceneSim, sceneRender, camera, simMaterial, renderMaterial, rtA, rtB };
    }

    const { renderer, sceneSim, sceneRender, camera, simMaterial, renderMaterial } = canvas.__three;
    let { rtA, rtB } = canvas.__three;

    // Guard against context loss / undefined materials
    if (!simMaterial || !simMaterial.uniforms || !renderMaterial || !renderMaterial.uniforms) return;

    // Update dimensions if resized
    if (renderer.getSize(new THREE.Vector2()).x !== grid.width) {
        renderer.setSize(grid.width, grid.height, false);
        rtA.setSize(grid.width, grid.height);
        rtB.setSize(grid.width, grid.height);
        simMaterial.uniforms.uRes.value.set(grid.width, grid.height);
        renderMaterial.uniforms.uRes.value.set(grid.width, grid.height);
    }

    // Update Uniforms
    simMaterial.uniforms.uTime.value = time;
    renderMaterial.uniforms.uTime.value = time;
    
    // Normalize mouse coordinates for the shader
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    simMaterial.uniforms.uMouse.value.set(mx, my);
    simMaterial.uniforms.uMousePress.value = mouse.isPressed ? 1.0 : 0.0;

    // Multi-pass simulation step (Ping-Pong Framebuffers)
    // 12 iterations per frame creates a rapid, fluid morphing speed
    const ITERATIONS = 12;
    for (let i = 0; i < ITERATIONS; i++) {
        simMaterial.uniforms.uState.value = rtA.texture;
        renderer.setRenderTarget(rtB);
        renderer.render(sceneSim, camera);
        
        // Swap buffers
        let temp = rtA;
        rtA = rtB;
        rtB = temp;
    }
    
    // Save the swapped state back to the canvas context object
    canvas.__three.rtA = rtA;
    canvas.__three.rtB = rtB;

    // Final Render Pass to Screen
    renderer.setRenderTarget(null);
    renderMaterial.uniforms.uState.value = rtA.texture;
    renderer.render(sceneRender, camera);

} catch (e) {
    console.error("Feral Morphogenesis Engine Error:", e);
}