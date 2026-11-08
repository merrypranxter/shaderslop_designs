if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        // 1. Initialize Offscreen Canvas for Kinetic Type Storm
        const offCanvas = document.createElement('canvas');
        offCanvas.width = grid.width;
        offCanvas.height = grid.height;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        
        const offTex = new THREE.CanvasTexture(offCanvas);
        offTex.minFilter = THREE.LinearFilter;
        offTex.magFilter = THREE.LinearFilter;
        
        canvas.__offscreen = { canvas: offCanvas, ctx: offCtx, tex: offTex };
        canvas.__lastWidth = grid.width;
        canvas.__lastHeight = grid.height;

        // 2. Initialize Kinetic Typography Physics
        const initPhysics = () => {
            const chars = ['D', 'E', 'R', 'E', 'K', 'S', 'U', 'X'];
            const w = grid.width;
            const h = grid.height;
            const cy1 = h * 0.35;
            const cy2 = h * 0.65;
            
            const w1 = w * 0.7;
            const sx1 = (w - w1) / 2;
            const dx1 = w1 / 4;
            
            const w2 = w * 0.45;
            const sx2 = (w - w2) / 2;
            const dx2 = w2 / 2;
            
            let letters = [];
            let idx = 0;
            
            // D E R E K
            for(let i = 0; i < 5; i++) {
                letters.push({
                    char: chars[idx++],
                    x: sx1 + dx1 * i, y: cy1,
                    ox: sx1 + dx1 * i, oy: cy1,
                    vx: 0, vy: 0,
                    rot: 0, vrot: 0,
                    mass: 1.0 + Math.random() * 0.8
                });
            }
            // S U X
            for(let i = 0; i < 3; i++) {
                letters.push({
                    char: chars[idx++],
                    x: sx2 + dx2 * i, y: cy2,
                    ox: sx2 + dx2 * i, oy: cy2,
                    vx: 0, vy: 0,
                    rot: 0, vrot: 0,
                    mass: 1.0 + Math.random() * 0.8
                });
            }
            canvas.__physics = letters;
            
            // Clear offscreen to black initially
            offCtx.fillStyle = '#000000';
            offCtx.fillRect(0, 0, w, h);
        };
        
        initPhysics();
        canvas.__initPhysics = initPhysics;

        // 3. Initialize WebGL Procedural Substance
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_textTex: { value: offTex },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
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
                uniform sampler2D u_textTex;
                uniform vec2 u_resolution;

                mat2 rot2(float a) {
                    float s = sin(a), c = cos(a);
                    return mat2(c, -s, s, c);
                }

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 5; i++) {
                        v += a * noise(p);
                        p = p * 2.0 * rot2(0.5);
                        a *= 0.5;
                    }
                    return v;
                }

                void main() {
                    vec2 uv = vUv;
                    
                    // The Three Simultaneous Time Scales
                    float tSlow = u_time * 0.05;
                    float tMed  = u_time * 0.2;
                    float tFast = u_time * 2.0;
                    
                    // 1. Slow global drift (Domain Warp)
                    vec2 warp1 = vec2(fbm(uv * 2.0 + tSlow), fbm(uv * 2.0 - tSlow + 10.0));
                    vec2 warp2 = vec2(fbm(uv * 4.0 + warp1 + tMed), fbm(uv * 4.0 - warp1 + tMed));
                    
                    // 2. Medium structural motion (Fluid contours & ridges)
                    float fluid = fbm(uv * 6.0 + warp2 * 3.0 - tMed);
                    float fluidEdges = abs(fract(fluid * 5.0) - 0.5) * 2.0; 
                    
                    // 3. Fast detail shimmer (High-frequency noise)
                    float shimmer = noise(uv * 150.0 + tFast + warp1 * 20.0) * 0.5 + 0.5;
                    
                    // Sample Kinetic Text with chromatic aberration driven by fluid warp
                    vec2 textUv = uv + warp2 * 0.03;
                    float aberration = 0.015 * shimmer;
                    float txtR = texture(u_textTex, textUv + vec2(aberration, 0.0)).r;
                    float txtG = texture(u_textTex, textUv).r;
                    float txtB = texture(u_textTex, textUv - vec2(aberration, 0.0)).r;
                    float txtMask = (txtR + txtG + txtB) / 3.0;
                    
                    // Cyberdelic Neon / Psychedelic Collage Palette
                    vec3 voidBlack = vec3(0.015, 0.023, 0.031);
                    vec3 neonCyan  = vec3(0.0, 1.0, 0.94);
                    vec3 neonMag   = vec3(1.0, 0.0, 0.8);
                    vec3 acidYel   = vec3(0.8, 1.0, 0.0);
                    
                    vec3 col = voidBlack;
                    
                    // Build the Physical Substance
                    // Deep magenta organic veins
                    col = mix(col, neonMag * 0.4, smoothstep(0.3, 0.7, fluid) * (1.0 - fluidEdges));
                    // Cyan structural ridges
                    col = mix(col, neonCyan, smoothstep(0.85, 0.95, 1.0 - fluidEdges) * shimmer);
                    // Acid yellow nodes
                    col = mix(col, acidYel, smoothstep(0.75, 0.9, fbm(uv * 20.0 + tFast)) * fluid);
                    
                    // Integrate Kinetic Typography (Language as Weather)
                    // Trails/Aura map to Cyan -> Core maps to Magenta/Yellow
                    vec3 textAura = mix(vec3(0.0), neonCyan, smoothstep(0.0, 0.3, txtMask));
                    textAura = mix(textAura, neonMag, smoothstep(0.3, 0.7, txtMask));
                    textAura = mix(textAura, acidYel, smoothstep(0.7, 1.0, txtMask));
                    
                    // The text physically displaces the background substance, burning through it
                    col = mix(col, voidBlack, smoothstep(0.0, 0.5, txtMask)); // Carve out space
                    col += textAura * (0.8 + shimmer * 0.4);
                    
                    // Raw RGB split on the edges for violent glitch feel
                    col += vec3(txtR, 0.0, 0.0) * neonMag * 0.5 * (1.0 - txtMask);
                    col += vec3(0.0, 0.0, txtB) * neonCyan * 0.5 * (1.0 - txtMask);
                    
                    // Physical Film Grain / Noise
                    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + tFast) * 43758.5453);
                    col += (grain - 0.5) * 0.15;
                    
                    // Vignette
                    float dist = length(uv - 0.5);
                    col *= smoothstep(0.8, 0.2, dist);
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

// Ensure resize is handled
if (canvas.__lastWidth !== grid.width || canvas.__lastHeight !== grid.height) {
    canvas.__lastWidth = grid.width;
    canvas.__lastHeight = grid.height;
    canvas.__offscreen.canvas.width = grid.width;
    canvas.__offscreen.canvas.height = grid.height;
    if (canvas.__three?.material?.uniforms?.u_resolution) {
        canvas.__three.material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    if (canvas.__initPhysics) canvas.__initPhysics();
}

const { renderer, scene, camera, material } = canvas.__three;
const off = canvas.__offscreen;
const oCtx = off.ctx;
const letters = canvas.__physics;

// Update Kinetic Typography Physics (Word as Force Field / Fluid Typography)
// 1. Motion blur fade
oCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
oCtx.fillRect(0, 0, grid.width, grid.height);

oCtx.fillStyle = '#FFFFFF';
oCtx.font = `bold ${Math.floor(grid.width * 0.15)}px "Impact", "Helvetica Neue", sans-serif`;
oCtx.textAlign = 'center';
oCtx.textBaseline = 'middle';

letters.forEach((l, i) => {
    // Structural Spring Force
    l.vx += (l.ox - l.x) * 0.015;
    l.vy += (l.oy - l.y) * 0.015;
    
    // Divergence-free noise flow
    l.vx += Math.sin(time * 2.0 + l.oy * 0.01) * 0.6;
    l.vy += Math.cos(time * 1.7 + l.ox * 0.01) * 0.6;
    
    // Mouse Repulsion (Observer Effect)
    if (mouse.isPressed || true) { 
        let dx = l.x - mouse.x;
        let dy = l.y - mouse.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let influence = grid.width * 0.25;
        if (dist < influence && dist > 0) {
            let force = (influence - dist) / influence;
            l.vx += (dx/dist) * force * 12.0 * (mouse.isPressed ? 2.0 : 1.0);
            l.vy += (dy/dist) * force * 12.0 * (mouse.isPressed ? 2.0 : 1.0);
            l.vrot += (Math.random() - 0.5) * force * 0.2;
        }
    }
    
    // Inter-letter collision and semantic repulsion
    for (let j = i + 1; j < letters.length; j++) {
        let l2 = letters[j];
        let dx = l.x - l2.x;
        let dy = l.y - l2.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let minDist = grid.width * 0.12;
        if (dist > 0 && dist < minDist) {
            let force = Math.pow((minDist - dist) / minDist, 2.0) * 3.0;
            l.vx += (dx/dist) * force / l.mass;
            l.vy += (dy/dist) * force / l.mass;
            l2.vx -= (dx/dist) * force / l2.mass;
            l2.vy -= (dy/dist) * force / l2.mass;
        }
    }
    
    // Damping (Viscosity)
    l.vx *= 0.85;
    l.vy *= 0.85;
    l.vrot *= 0.92;
    
    // Spring rotation back to equilibrium
    l.vrot += (0 - l.rot) * 0.08;
    
    l.x += l.vx;
    l.y += l.vy;
    l.rot += l.vrot;
    
    // Draw Physical Glyph
    oCtx.save();
    oCtx.translate(l.x, l.y);
    oCtx.rotate(l.rot);
    
    // Breathe scaling
    let scale = 1.0 + Math.sin(time * 4.0 + i) * 0.08;
    oCtx.scale(scale, scale);
    
    oCtx.fillText(l.char, 0, 0);
    oCtx.restore();
});

// Sync texture to GPU
off.tex.needsUpdate = true;

// Render Procedural Substance Shader
if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);