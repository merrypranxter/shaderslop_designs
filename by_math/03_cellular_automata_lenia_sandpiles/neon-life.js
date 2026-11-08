if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;
        
        // Use a fixed resolution for the CA simulation to ensure consistent behavior
        const SW = Math.min(1024, grid.width);
        const SH = Math.min(1024, grid.height);
        
        const rtOpts = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        const fbo = [
            new THREE.WebGLRenderTarget(SW, SH, rtOpts),
            new THREE.WebGLRenderTarget(SW, SH, rtOpts)
        ];
        
        // Seed initial CA state
        const seedData = new Float32Array(SW * SH * 4);
        for(let i = 0; i < SW * SH; i++) {
            seedData[i*4] = Math.random() < 0.25 ? 1.0 : 0.0; // R: Alive state
            seedData[i*4+1] = 0.0;                            // G: Age
            seedData[i*4+2] = seedData[i*4];                  // B: Heat/Trail
            seedData[i*4+3] = Math.random();                  // A: Random seed
        }
        const seedTex = new THREE.DataTexture(seedData, SW, SH, THREE.RGBAFormat, THREE.FloatType);
        seedTex.needsUpdate = true;
        
        const quadGeo = new THREE.PlaneGeometry(2, 2);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Blit material to initialize FBO 0 and 1
        const blitMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { u_tex: { value: seedTex } },
            vertexShader: `
                out vec2 vUv;
                void main() { 
                    vUv = uv; 
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform sampler2D u_tex;
                in vec2 vUv;
                out vec4 fragColor;
                void main() { 
                    fragColor = texture(u_tex, vUv); 
                }
            `
        });
        
        const blitScene = new THREE.Scene();
        blitScene.add(new THREE.Mesh(quadGeo, blitMat));
        
        renderer.setRenderTarget(fbo[0]);
        renderer.render(blitScene, camera);
        renderer.setRenderTarget(fbo[1]);
        renderer.render(blitScene, camera);
        
        // Update Material: Conway's Game of Life + Auto-Injecting Wands
        const updateMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(SW, SH) },
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0, 0) },
                u_isPressed: { value: 0 }
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
                uniform sampler2D u_state;
                uniform vec2 u_res;
                uniform float u_time;
                uniform vec2 u_mouse;
                uniform float u_isPressed;
                in vec2 vUv;
                out vec4 fragColor;
                
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {
                    vec4 current = texture(u_state, vUv);
                    float alive = current.r;
                    float age = current.g;
                    float heat = current.b;
                    float seed = current.a;
                    
                    // Sample Moore neighborhood
                    float neighbors = 0.0;
                    for(int y = -1; y <= 1; y++) {
                        for(int x = -1; x <= 1; x++) {
                            if(x == 0 && y == 0) continue;
                            vec2 offset = vec2(float(x), float(y)) / u_res;
                            neighbors += texture(u_state, fract(vUv + offset)).r;
                        }
                    }
                    
                    // Apply Conway's Game of Life rules (B3/S23)
                    float nextAlive = alive;
                    if(alive > 0.5) {
                        if(neighbors < 1.5 || neighbors > 3.5) nextAlive = 0.0;
                    } else {
                        if(neighbors > 2.5 && neighbors < 3.5) nextAlive = 1.0;
                    }
                    
                    // Mouse interaction
                    vec2 pixelCoord = vUv * u_res;
                    if(u_isPressed > 0.5 && distance(pixelCoord, u_mouse) < 45.0) {
                        if(hash(vUv + u_time) > 0.4) nextAlive = 1.0;
                    }
                    
                    // Auto-injecting chaotic wands to keep the ecosystem active
                    vec2 w1 = u_res * 0.5 + vec2(sin(u_time*1.2 + sin(u_time*0.5)), cos(u_time*0.8)) * u_res * 0.4;
                    vec2 w2 = u_res * 0.5 + vec2(cos(u_time*1.5), sin(u_time*1.1 + cos(u_time*0.3))) * u_res * 0.3;
                    if(distance(pixelCoord, w1) < 25.0 || distance(pixelCoord, w2) < 25.0) {
                        if(hash(vUv - u_time) > 0.6) nextAlive = 1.0;
                    }
                    
                    // Update metadata channels
                    float nextAge = nextAlive > 0.5 ? age + 0.02 : 0.0;
                    float nextHeat = nextAlive > 0.5 ? 1.0 : heat * 0.985; // Slow decay for neon trails
                    
                    fragColor = vec4(nextAlive, clamp(nextAge, 0.0, 1.0), nextHeat, seed);
                }
            `
        });
        
        const updateScene = new THREE.Scene();
        updateScene.add(new THREE.Mesh(quadGeo, updateMat));
        
        // Display Material: Lisa Frank Rainbow Palette + Zebra/Leopard Print + Cyberdelic Bloom
        const displayMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_state: { value: null },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 }
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
                uniform sampler2D u_state;
                uniform vec2 u_res;
                uniform float u_time;
                in vec2 vUv;
                out vec4 fragColor;
                
                // Lisa Frank / Acid Vibration Color Palette
                vec3 getLisaFrankColor(float t) {
                    t = fract(t);
                    if(t < 0.166) return mix(vec3(1.0, 0.0, 0.8), vec3(1.0, 0.42, 0.0), t * 6.0);       // Hot Pink to Electric Orange
                    if(t < 0.333) return mix(vec3(1.0, 0.42, 0.0), vec3(1.0, 0.9, 0.0), (t - 0.166) * 6.0); // Orange to Yellow
                    if(t < 0.5) return mix(vec3(1.0, 0.9, 0.0), vec3(0.69, 1.0, 0.0), (t - 0.333) * 6.0);   // Yellow to Acid Lime
                    if(t < 0.666) return mix(vec3(0.69, 1.0, 0.0), vec3(0.0, 1.0, 0.94), (t - 0.5) * 6.0);  // Lime to Neon Cyan
                    if(t < 0.833) return mix(vec3(0.0, 1.0, 0.94), vec3(0.33, 0.0, 1.0), (t - 0.666) * 6.0);// Cyan to UV Blue
                    return mix(vec3(0.33, 0.0, 1.0), vec3(1.0, 0.0, 0.8), (t - 0.833) * 6.0);               // UV Blue to Pink
                }
                
                // Procedural animal print texture (zebra/tiger stripes)
                float stripes(vec2 p) {
                    float n = sin(p.x * 12.0 + sin(p.y * 6.0) * 2.0 + u_time * 0.3) * cos(p.y * 15.0);
                    return smoothstep(0.3, 0.7, n);
                }
                
                void main() {
                    vec4 state = texture(u_state, vUv);
                    float alive = state.r;
                    float heat = state.b;
                    
                    // Sample neighbors for cyberdelic bloom and chromatic aberration
                    vec2 texel = 1.0 / u_res;
                    float hL = texture(u_state, vUv + vec2(-texel.x, 0.0)).b;
                    float hR = texture(u_state, vUv + vec2(texel.x, 0.0)).b;
                    float hU = texture(u_state, vUv + vec2(0.0, texel.y)).b;
                    float hD = texture(u_state, vUv + vec2(0.0, -texel.y)).b;
                    float bloom = (heat + hL + hR + hU + hD) / 5.0;
                    
                    // Radial rainbow gradient for the Lisa Frank aesthetic
                    float distCenter = distance(vUv, vec2(0.5));
                    float angleCenter = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float colorOffset = angleCenter / 6.28318 + distCenter * 1.5 - u_time * 0.5;
                    
                    vec3 baseColor = getLisaFrankColor(colorOffset + bloom * 0.5);
                    
                    // Generate animal print overlay
                    float st = stripes(vUv * vec2(1.0, u_res.y / u_res.x) * 1.5);
                    vec3 stripeColor = vec3(0.08, 0.0, 0.18); // Deep magenta/purple
                    
                    // Mix base neon with animal print
                    vec3 patternColor = mix(baseColor, stripeColor, st * 0.75);
                    
                    // Background void (dark animal print)
                    vec3 bg = mix(vec3(0.02, 0.0, 0.05), vec3(0.15, 0.0, 0.25), st * 0.4);
                    
                    // Reveal the neon pattern based on the CA trail heat
                    vec3 finalColor = mix(bg, patternColor, smoothstep(0.01, 0.25, bloom));
                    
                    // Render alive cells as blazing white sparks
                    if(alive > 0.5) {
                        finalColor = mix(finalColor, vec3(1.0), 0.85);
                    }
                    
                    // Apply directional chromatic aberration to the trail edges
                    float ca = (hR - hL);
                    finalColor.r += ca * 1.5;
                    finalColor.b -= ca * 1.5;
                    
                    // Soft vignette
                    finalColor *= smoothstep(0.95, 0.35, distCenter);
                    
                    // Slight contrast/saturation boost for the neon feel
                    finalColor = pow(finalColor, vec3(0.85));
                    
                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });
        
        const displayScene = new THREE.Scene();
        displayScene.add(new THREE.Mesh(quadGeo, displayMat));
        
        canvas.__three = {
            renderer,
            camera,
            updateScene,
            updateMat,
            displayScene,
            displayMat,
            fbo,
            ping: 0,
            SW,
            SH
        };
    } catch (e) {
        console.error("WebGL Init Failed:", e);
        return;
    }
}

const sys = canvas.__three;
if (!sys) return;

// Run the CA simulation multiple steps per frame for faster, more chaotic growth
const STEPS_PER_FRAME = 2;

for (let i = 0; i < STEPS_PER_FRAME; i++) {
    const nextPing = 1 - sys.ping;
    
    if (sys.updateMat?.uniforms) {
        sys.updateMat.uniforms.u_state.value = sys.fbo[sys.ping].texture;
        sys.updateMat.uniforms.u_time.value = time;
        
        // Map mouse coordinates to the FBO resolution
        const mx = (mouse.x / grid.width) * sys.SW;
        const my = (1.0 - mouse.y / grid.height) * sys.SH; // Invert Y for WebGL
        sys.updateMat.uniforms.u_mouse.value.set(mx, my);
        sys.updateMat.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
    }
    
    sys.renderer.setRenderTarget(sys.fbo[nextPing]);
    sys.renderer.render(sys.updateScene, sys.camera);
    
    sys.ping = nextPing;
}

// Render final output to canvas
sys.renderer.setRenderTarget(null);
sys.renderer.setSize(grid.width, grid.height, false);

if (sys.displayMat?.uniforms) {
    sys.displayMat.uniforms.u_state.value = sys.fbo[sys.ping].texture;
    sys.displayMat.uniforms.u_time.value = time;
    sys.displayMat.uniforms.u_res.value.set(grid.width, grid.height);
}

sys.renderer.render(sys.displayScene, sys.camera);