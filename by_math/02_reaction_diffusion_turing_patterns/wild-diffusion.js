/**
 * FERAL DESIGN-BRAIN: OVERCLOCKED LISA FRANK REACTION-DIFFUSION
 * 
 * CORE MECHANISM:
 * - A Gray-Scott reaction-diffusion system seeded densely across the entire canvas (no blank spots).
 * - Spatial modulation of feed (F) and kill (k) rates to simultaneously generate Turing Spots (leopard print) 
 *   and Growing Worms (tiger stripes) that drift and evolve over time.
 * - A display shader that interprets the chemical concentrations as thin-film structural color,
 *   strictly clamped to a garish 80s/90s neon palette (Magenta, Cyan, Lime, Purple).
 * - Gradients of the 'V' chemical are used to calculate non-Euclidean surface normals,
 *   creating iridescent topological outlines and masking a synthetic "glitter" effect.
 * - STRICTLY NO BLACK, NO WHITE. Everything is pushed into maximum saturation and high brightness.
 */

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setSize(grid.width, grid.height, false);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        // Ping-pong targets for RD simulation
        const rtOpts = {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
            depthBuffer: false,
            stencilBuffer: false
        };

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);

        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        // INITIALIZATION SHADER: Dense random seeding
        const initMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader: `
                out vec4 fragColor;
                in vec2 vUv;
                
                float hash(vec2 p) { 
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); 
                }
                
                void main() {
                    // High frequency noise for seeding
                    float n = hash(vUv * 150.0);
                    // Medium frequency spatial clumping
                    float clump = sin(vUv.x * 20.0) * cos(vUv.y * 20.0);
                    
                    // Threshold to create dense, scattered seeds (no blank spots)
                    float v = step(0.92, n + clump * 0.1); 
                    
                    // Initial state: U is 1.0 everywhere, V is 1.0 at seeds
                    fragColor = vec4(1.0, v, 0.0, 1.0);
                }
            `
        });

        // SIMULATION SHADER: Gray-Scott with spatial parameter modulation
        const simMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uResolution: { value: new THREE.Vector2(grid.width, grid.height) },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader: `
                out vec4 fragColor;
                in vec2 vUv;
                uniform sampler2D uState;
                uniform vec2 uResolution;
                uniform float uTime;
                
                void main() {
                    vec2 texel = 1.0 / uResolution;
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Karl Sims 9-point Laplacian
                    vec2 lap = vec2(0.0);
                    lap += texture(uState, vUv + vec2(-1.0, 0.0) * texel).rg * 0.2;
                    lap += texture(uState, vUv + vec2( 1.0, 0.0) * texel).rg * 0.2;
                    lap += texture(uState, vUv + vec2( 0.0,-1.0) * texel).rg * 0.2;
                    lap += texture(uState, vUv + vec2( 0.0, 1.0) * texel).rg * 0.2;
                    lap += texture(uState, vUv + vec2(-1.0,-1.0) * texel).rg * 0.05;
                    lap += texture(uState, vUv + vec2( 1.0,-1.0) * texel).rg * 0.05;
                    lap += texture(uState, vUv + vec2(-1.0, 1.0) * texel).rg * 0.05;
                    lap += texture(uState, vUv + vec2( 1.0, 1.0) * texel).rg * 0.05;
                    lap -= state * 1.0;
                    
                    // Spatial modulation: mix between Turing Spots and Growing Worms
                    float nx = sin(vUv.x * 4.0 + uTime * 0.1) * cos(vUv.y * 4.0 - uTime * 0.08);
                    float F = mix(0.030, 0.046, nx * 0.5 + 0.5);
                    float k = mix(0.055, 0.065, nx * 0.5 + 0.5);
                    
                    // Reaction-Diffusion equations
                    float reaction = u * v * v;
                    float du = 1.0 * lap.r - reaction + F * (1.0 - u);
                    float dv = 0.5 * lap.g + reaction - (F + k) * v;
                    
                    fragColor = vec4(clamp(u + du, 0.0, 1.0), clamp(v + dv, 0.0, 1.0), 0.0, 1.0);
                }
            `
        });

        // DISPLAY SHADER: Lisa Frank Structural Color Iridescence
        const dispMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uState: { value: null },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader: `
                out vec4 fragColor;
                in vec2 vUv;
                uniform sampler2D uState;
                uniform float uTime;
                
                // Pure garish neon color mapping (No Black, No White)
                vec3 getNeon(float t) {
                    t = fract(t);
                    vec3 c1 = vec3(1.0, 0.2, 0.8); // Hot Pink
                    vec3 c2 = vec3(0.2, 1.0, 1.0); // Cyan
                    vec3 c3 = vec3(0.9, 1.0, 0.2); // Lime/Yellow
                    vec3 c4 = vec3(0.6, 0.2, 1.0); // Purple
                    
                    if(t < 0.25) return mix(c1, c2, t * 4.0);
                    if(t < 0.50) return mix(c2, c3, (t - 0.25) * 4.0);
                    if(t < 0.75) return mix(c3, c4, (t - 0.50) * 4.0);
                    return mix(c4, c1, (t - 0.75) * 4.0);
                }

                void main() {
                    vec2 state = texture(uState, vUv).rg;
                    float u = state.r;
                    float v = state.g;
                    
                    // Compute gradients for structural color normals
                    float e = 0.003;
                    float vx = texture(uState, vUv + vec2(e, 0.0)).g - texture(uState, vUv - vec2(e, 0.0)).g;
                    float vy = texture(uState, vUv + vec2(0.0, e)).g - texture(uState, vUv - vec2(0.0, e)).g;
                    
                    // Fake 3D normal from chemical gradient
                    vec3 normal = normalize(vec3(vx * 40.0, vy * 40.0, 1.0));
                    float cosTheta = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
                    
                    // Thin-film iridescence phase shift
                    float phase = v * 2.5 + cosTheta * 1.5 - uTime * 0.2;
                    float warp = sin(vUv.x * 10.0 + uTime) * cos(vUv.y * 10.0 - uTime) * 0.2;
                    
                    vec3 col = getNeon(phase + warp);
                    
                    // Topological outlines (animal print borders)
                    float edge = length(vec2(vx, vy)) * 20.0;
                    vec3 edgeColor = vec3(0.3, 0.0, 0.8); // Deep purple, NOT black
                    col = mix(col, edgeColor, smoothstep(0.2, 0.8, edge));
                    
                    // Feral Glitter Effect
                    float glitterNoise = fract(sin(dot(vUv * 400.0, vec2(12.9898, 78.233))) * 43758.5453);
                    float glitterMask = smoothstep(0.4, 0.6, v) * smoothstep(0.96, 1.0, glitterNoise);
                    vec3 glitterColor = mix(vec3(1.0, 0.9, 0.9), vec3(0.2, 1.0, 1.0), fract(uTime * 2.0));
                    col = mix(col, glitterColor, glitterMask);
                    
                    // Final clamp to absolutely prevent pure black or pure white
                    col = clamp(col, 0.15, 0.95);
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, initMat);
        scene.add(mesh);

        // Render initial seed state into RenderTarget A
        renderer.setRenderTarget(rtA);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        canvas.__three = { renderer, scene, camera, mesh, simMat, dispMat, rtA, rtB };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const t = canvas.__three;
if (!t) return;

// Handle canvas resizing gracefully
if (t.rtA.width !== grid.width || t.rtA.height !== grid.height) {
    t.renderer.setSize(grid.width, grid.height, false);
    t.rtA.setSize(grid.width, grid.height);
    t.rtB.setSize(grid.width, grid.height);
    t.simMat.uniforms.uResolution.value.set(grid.width, grid.height);
}

// Update time uniforms
t.simMat.uniforms.uTime.value = time;
t.dispMat.uniforms.uTime.value = time;

// Overclocked Ping-Pong Simulation Loop
const STEPS_PER_FRAME = 16; 
t.mesh.material = t.simMat;

for (let i = 0; i < STEPS_PER_FRAME; i++) {
    t.simMat.uniforms.uState.value = t.rtA.texture;
    t.renderer.setRenderTarget(t.rtB);
    t.renderer.render(t.scene, t.camera);
    
    // Swap buffers
    let temp = t.rtA;
    t.rtA = t.rtB;
    t.rtB = temp;
}

// Render final state to screen using Display Shader
t.mesh.material = t.dispMat;
t.dispMat.uniforms.uState.value = t.rtA.texture;
t.renderer.setRenderTarget(null);
t.renderer.render(t.scene, t.camera);