try {
    if (!ctx) throw new Error("WebGL2 context not available");

    // Feral Setup: Cache check to prevent re-initialization
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance on heavy shaders
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // KINETIC TYPE STORM: Physics State Initialization
        const glyphs = [];
        // D E R E K
        //  S U X
        const targets = [
            [-0.6, 0.25], [-0.3, 0.25], [0.0, 0.25], [0.3, 0.25], [0.6, 0.25], // D E R E K
            [-0.3, -0.25], [0.0, -0.25], [0.3, -0.25]                          // S U X
        ];

        for (let i = 0; i < 8; i++) {
            glyphs.push({
                pos: new THREE.Vector2(targets[i][0] + (Math.random() - 0.5) * 2.0, targets[i][1] + (Math.random() - 0.5) * 2.0),
                vel: new THREE.Vector2(0, 0),
                target: new THREE.Vector2(targets[i][0], targets[i][1])
            });
        }

        const uniforms = {
            u_time: { value: 0 },
            u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            u_glyphs: { value: glyphs.map(g => g.pos) },
            u_entropy: { value: 0.0 }
        };

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
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

                uniform float u_time;
                uniform vec2 u_resolution;
                uniform vec2 u_glyphs[8];
                uniform float u_entropy;

                #define PI 3.14159265359

                // ALCHEMICAL MATH: Hash & Noise
                vec2 hash2(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453123);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123);
                    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453123);
                    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);
                    float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453123);
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                float fbm(vec2 p) {
                    float v = 0.0; float a = 0.5;
                    for(int i=0; i<4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
                    return v;
                }

                // FERROFLUID DANCE: Rosensweig Instability (Voronoi Spikes)
                float voronoi(vec2 x) {
                    vec2 n = floor(x);
                    vec2 f = fract(x);
                    float res = 8.0;
                    for(int j=-1; j<=1; j++)
                    for(int i=-1; i<=1; i++) {
                        vec2 b = vec2(float(i), float(j));
                        vec2 r = vec2(b) - f + hash2(n + b);
                        float d = dot(r, r);
                        res = min(res, d);
                    }
                    return sqrt(res);
                }

                // KINETIC TYPE STORM: Glyph SDFs
                float seg(vec2 p, vec2 a, vec2 b) {
                    vec2 pa = p - a, ba = b - a;
                    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                    return length(pa - ba * h);
                }

                float glyphSDF(vec2 p, int index) {
                    float d = 100.0;
                    // D E R E K
                    // S U X
                    if (index == 0) { // D
                        d = seg(p, vec2(-.1, .15), vec2(-.1, -.15));
                        vec2 pD = p - vec2(-.1, 0.0);
                        d = min(d, pD.x < 0.0 ? length(pD - vec2(0.0, clamp(pD.y, -.15, .15))) : abs(length(pD) - .15));
                    } else if (index == 1 || index == 3) { // E
                        d = min(seg(p, vec2(-.1,.15), vec2(-.1,-.15)), seg(p, vec2(-.1,.15), vec2(.1,.15)));
                        d = min(d, min(seg(p, vec2(-.1,0.0), vec2(.05,0.0)), seg(p, vec2(-.1,-.15), vec2(.1,-.15))));
                    } else if (index == 2) { // R
                        d = seg(p, vec2(-.1,.15), vec2(-.1,-.15));
                        vec2 pR = p - vec2(-.1, .075);
                        d = min(d, pR.x < 0.0 ? length(pR - vec2(0.0, clamp(pR.y, -.075, .075))) : abs(length(pR) - .075));
                        d = min(d, seg(p, vec2(-.05,0.0), vec2(.1,-.15)));
                    } else if (index == 4) { // K
                        d = min(seg(p, vec2(-.1,.15), vec2(-.1,-.15)), min(seg(p, vec2(-.1,0.0), vec2(.1,.15)), seg(p, vec2(-.1,0.0), vec2(.1,-.15))));
                    } else if (index == 5) { // S
                        d = min(seg(p, vec2(.1,.15), vec2(-.1,.15)), seg(p, vec2(-.1,.15), vec2(-.1,0.0)));
                        d = min(d, min(seg(p, vec2(-.1,0.0), vec2(.1,0.0)), seg(p, vec2(.1,0.0), vec2(.1,-.15))));
                        d = min(d, seg(p, vec2(.1,-.15), vec2(-.1,-.15)));
                    } else if (index == 6) { // U
                        d = min(seg(p, vec2(-.1,.15), vec2(-.1,-.05)), seg(p, vec2(.1,.15), vec2(.1,-.05)));
                        vec2 pU = p - vec2(0.0, -.05);
                        d = min(d, pU.y > 0.0 ? length(pU - vec2(clamp(pU.x, -.1, .1), 0.0)) : abs(length(pU) - .1));
                    } else if (index == 7) { // X
                        d = min(seg(p, vec2(-.1,.15), vec2(.1,-.15)), seg(p, vec2(.1,.15), vec2(-.1,-.15)));
                    }
                    return d - 0.035; // Stroke thickness
                }

                // MAGNETIC FIELD TOPOLOGY
                float fluidHeight(vec2 p) {
                    // Slow structural drift
                    vec2 warp = p + vec2(fbm(p * 2.0 + u_time * 0.1), fbm(p * 2.0 - u_time * 0.15)) * 0.15;
                    
                    // XOR-Ghost Manifold (Glitch Prophet logic)
                    warp = mix(warp, floor(warp * 40.0) / 40.0, u_entropy * 0.8);

                    float magField = 0.0;
                    for(int i = 0; i < 8; i++) {
                        float dist = glyphSDF(warp - u_glyphs[i], i);
                        // Magnetic flux concentration around the glyphs
                        magField += exp(-dist * 15.0) * (0.8 + 0.2 * sin(dist * 40.0 - u_time * 4.0));
                    }

                    // Fast Shimmer (Rosensweig spikes)
                    float spikes = 1.0 - voronoi(warp * 18.0 - u_time * 2.0);
                    spikes = pow(spikes, 3.0); // Sharpen spikes

                    // Fluid height: base pool + magnetic lift + spikes on the peaks
                    float base = 0.05 + 0.05 * fbm(warp * 3.0 + u_time * 0.2);
                    float h = max(base, magField * 0.6);
                    h += smoothstep(0.2, 0.8, magField) * spikes * 0.4;
                    
                    return h;
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;

                    // Metric Competition: Poincaré Hyperbolic Projection
                    float r2 = dot(uv, uv);
                    vec2 p = uv / (1.0 + r2 * 0.15 * (1.0 - u_entropy));

                    // Normal Calculation via central difference
                    float e = 0.005;
                    float h = fluidHeight(p);
                    float hx = fluidHeight(p + vec2(e, 0.0));
                    float hy = fluidHeight(p + vec2(0.0, e));
                    vec3 normal = normalize(vec3(h - hx, h - hy, e * 2.0));

                    // THIN FILM IRIDESCENCE (Structural Color)
                    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
                    float cosTheta = max(0.0, dot(normal, viewDir));
                    
                    // Film thickness modulated by height and fast noise
                    float thickness = 300.0 + h * 800.0 + noise(p * 10.0 + u_time) * 150.0;
                    float n_film = 1.56; // Beetle cuticle / thick oil
                    
                    // Optical path difference
                    float pathDiff = 2.0 * n_film * thickness * sqrt(1.0 - pow(sin(acos(cosTheta))/n_film, 2.0));

                    // Psychedelic Collage Palette: Void Black, Neon Cyan, Magenta, Yellow
                    vec3 voidBlack = vec3(0.015, 0.023, 0.031);
                    vec3 cyan = vec3(0.0, 1.0, 0.94);
                    vec3 magenta = vec3(1.0, 0.0, 0.8);
                    vec3 yellow = vec3(1.0, 0.9, 0.0);

                    // Phase shifts for CMYK structural color
                    float intC = 0.5 + 0.5 * cos((pathDiff / 480.0) * PI * 2.0);
                    float intM = 0.5 + 0.5 * cos((pathDiff / 580.0) * PI * 2.0);
                    float intY = 0.5 + 0.5 * cos((pathDiff / 680.0) * PI * 2.0);

                    // Acid Vibration: Non-linear response to make it neon
                    intC = smoothstep(0.5, 1.0, intC);
                    intM = smoothstep(0.5, 1.0, intM);
                    intY = smoothstep(0.5, 1.0, intY);

                    // Composite
                    vec3 color = voidBlack;
                    float slope = length(normal.xy);
                    
                    // Only apply iridescence where the fluid slopes (the spikes/letters)
                    float iridMask = smoothstep(0.05, 0.8, slope + h * 0.5);
                    color = mix(color, cyan, intC * iridMask);
                    color = mix(color, magenta, intM * iridMask);
                    color = mix(color, yellow, intY * iridMask);

                    // Specular Highlight (Wet Engine Protocol)
                    float spec = pow(max(0.0, dot(reflect(-viewDir, normal), viewDir)), 64.0);
                    color += vec3(1.0) * spec * iridMask;

                    // Glitch/Print Artifacts (Psychedelic Collage)
                    float grain = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
                    color += (grain - 0.5) * 0.15 * iridMask;
                    
                    // Entropy burn
                    color += vec3(1.0, 0.0, 0.2) * u_entropy * step(0.98, grain);

                    // Deep contrast
                    color = pow(max(color, 0.0), vec3(1.1));

                    fragColor = vec4(color, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material, glyphs, uniforms };
        canvas.__lastTime = time;
    }

    const { renderer, scene, camera, material, glyphs, uniforms } = canvas.__three;

    // Time delta for physics
    const dt = Math.min(time - (canvas.__lastTime || time), 0.1);
    canvas.__lastTime = time;

    // KINETIC TYPE STORM: Physics Engine
    const explosionCycle = 12.0;
    const phase = time % explosionCycle;
    const exploding = phase < 1.0;
    const reassembling = phase >= 1.0 && phase < 4.0;
    
    // Glitch Prophet: Math corruption during explosion
    uniforms.u_entropy.value = exploding ? Math.max(0, 1.0 - phase) : 0.0;

    for (let i = 0; i < 8; i++) {
        let g = glyphs[i];
        let fx = 0, fy = 0;

        if (exploding) {
            // Catastrophic destruction (Curl noise / radial burst)
            let angle = Math.atan2(g.pos.y, g.pos.x);
            let dist = Math.max(Math.sqrt(g.pos.x**2 + g.pos.y**2), 0.1);
            fx += Math.cos(angle) * 15.0 / dist;
            fy += Math.sin(angle) * 15.0 / dist;
            
            // Add chaos
            fx += (Math.random() - 0.5) * 50.0;
            fy += (Math.random() - 0.5) * 50.0;
        } else {
            // Spring back to target
            let stiffness = reassembling ? 2.0 : 8.0;
            fx += (g.target.x - g.pos.x) * stiffness;
            fy += (g.target.y - g.pos.y) * stiffness;

            // Fluid drag / slow wander
            fx += Math.sin(time * 2.0 + i) * 0.5;
            fy += Math.cos(time * 1.5 + i) * 0.5;

            // Semantic Repulsion (prevent overlap)
            for (let j = 0; j < 8; j++) {
                if (i === j) continue;
                let dx = g.pos.x - glyphs[j].pos.x;
                let dy = g.pos.y - glyphs[j].pos.y;
                let distSq = dx*dx + dy*dy;
                if (distSq < 0.04 && distSq > 0.0001) {
                    let rep = 0.005 / distSq;
                    fx += dx * rep;
                    fy += dy * rep;
                }
            }
        }

        // Integrate (Verlet-ish)
        g.vel.x += fx * dt;
        g.vel.y += fy * dt;
        
        // Damping
        let damping = exploding ? 0.95 : 0.85;
        g.vel.x *= damping;
        g.vel.y *= damping;

        g.pos.x += g.vel.x * dt;
        g.pos.y += g.vel.y * dt;
        
        // Bounds constraint
        if(g.pos.x > 2.0) g.pos.x = 2.0; if(g.pos.x < -2.0) g.pos.x = -2.0;
        if(g.pos.y > 2.0) g.pos.y = 2.0; if(g.pos.y < -2.0) g.pos.y = -2.0;

        // Update uniform array
        uniforms.u_glyphs.value[i].copy(g.pos);
    }

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral Render Engine Failure:", e);
}