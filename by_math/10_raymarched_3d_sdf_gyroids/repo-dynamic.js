if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.setPixelRatio(1); // Crucial for pixel art pipelines
        
        // Pass 1: SDF Raymarcher (Reaction-Diffusion Gyroid + Structural Color)
        const scene1 = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        
        const mat1 = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2() }
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

                mat2 rot(float a) {
                    float s = sin(a), c = cos(a);
                    return mat2(c, -s, s, c);
                }

                // Approximating Gray-Scott / Turing patterns via nested Gyroids
                float map(vec3 p) {
                    p.xy *= rot(u_time * 0.15);
                    p.yz *= rot(u_time * 0.1);
                    p *= 2.0;
                    
                    float g1 = abs(dot(sin(p), cos(p.zxy))) / 2.0;
                    float g2 = abs(dot(sin(p * 3.0), cos(p.zxy * 3.0))) / 6.0;
                    
                    return g1 + g2 - 0.25; // Morphing porous structure
                }

                vec3 getNormal(vec3 p) {
                    vec2 e = vec2(0.01, 0.0);
                    return normalize(vec3(
                        map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)
                    ));
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;
                    
                    vec3 ro = vec3(0.0, 0.0, -3.0);
                    vec3 rd = normalize(vec3(uv, 1.0));
                    
                    float t = 0.0;
                    float d = 0.0;
                    for(int i = 0; i < 80; i++) {
                        vec3 p = ro + rd * t;
                        d = map(p);
                        if(abs(d) < 0.001 || t > 10.0) break;
                        t += d * 0.5; // Scaled step to handle nested SDF distortion
                    }
                    
                    if(t > 10.0) {
                        // Lisa Frank Background: Rainbow Gradient + Leopard Spots
                        vec3 bg = vec3(
                            0.5 + 0.5 * sin(uv.x * 2.0 + u_time),
                            0.5 + 0.5 * sin(uv.y * 3.0 + u_time * 1.2),
                            0.5 + 0.5 * sin((uv.x + uv.y) * 2.0 + u_time * 0.8)
                        );
                        bg = pow(bg, vec3(0.6)); // Brighten
                        
                        vec2 suv = uv * 6.0;
                        vec2 id = floor(suv);
                        vec2 f = fract(suv);
                        
                        float nx = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
                        float ny = fract(sin(dot(id, vec2(39.346, 11.135))) * 43758.5453);
                        
                        float d_spot = length(f - vec2(0.5) + 0.3 * vec2(sin(u_time * 2.0 * nx), cos(u_time * 2.0 * ny)));
                        float spot = smoothstep(0.35, 0.3, d_spot) - smoothstep(0.15, 0.1, d_spot); // Ring shape
                        
                        bg = mix(bg, vec3(0.1, 0.0, 0.2), spot); // Dark purple leopard spots
                        
                        fragColor = vec4(bg, 100.0); // Output bg color + infinite depth
                        return;
                    }
                    
                    vec3 p = ro + rd * t;
                    vec3 n = getNormal(p);
                    vec3 v = -rd;
                    
                    // Structural Color Physics (Thin-Film Interference)
                    float cosTheta = max(0.0, dot(n, v));
                    float thickness = 400.0 + 300.0 * sin(p.x * 3.0 + p.y * 4.0 + p.z * 5.0 + u_time * 3.0);
                    float n_film = 1.4;
                    float sinThetaSq = 1.0 - cosTheta * cosTheta;
                    float pathDiff = 2.0 * n_film * thickness * sqrt(max(0.0, 1.0 - sinThetaSq / (n_film * n_film)));
                    
                    // Acid / Neon Iridescence Palette
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.5);
                    vec3 phase = vec3(0.8, 0.2, 0.5); 
                    vec3 col = a + b * cos(6.28318 * (pathDiff / 600.0 + phase));
                    
                    // Fake Ambient Occlusion
                    float ao = clamp(map(p + n * 0.15) * 6.0, 0.0, 1.0);
                    col *= ao * 0.7 + 0.3;
                    
                    fragColor = vec4(col, t); // Output color + depth for edge detection
                }
            `
        });
        
        const mesh1 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat1);
        scene1.add(mesh1);
        
        // FBO for ping-pong pipeline
        const target = new THREE.WebGLRenderTarget(grid.width, grid.height, {
            format: THREE.RGBAFormat,
            type: THREE.FloatType, // Float required for depth precision
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter
        });
        
        // Pass 2: Ditherpunk / Palette Snap / Edge Outline (Lisa Frank Style)
        const scene2 = new THREE.Scene();
        const mat2 = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_texture: { value: target.texture },
                u_resolution: { value: new THREE.Vector2() },
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
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform sampler2D u_texture;
                uniform vec2 u_resolution;
                uniform float u_time;

                // Bayer 4x4 Threshold Matrix
                const float bayer[16] = float[16](
                    0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
                   12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
                    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
                   15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
                );

                // Custom 12-Color Lisa Frank Neon Palette
                vec3 p[12] = vec3[12](
                    vec3(1.00, 0.00, 0.50), // Hot Pink
                    vec3(0.00, 0.80, 1.00), // Cyan
                    vec3(1.00, 0.90, 0.00), // Neon Yellow
                    vec3(0.60, 0.00, 1.00), // Purple
                    vec3(0.00, 1.00, 0.30), // Lime Green
                    vec3(1.00, 0.40, 0.00), // Bright Orange
                    vec3(1.00, 1.00, 1.00), // White
                    vec3(0.10, 0.00, 0.20), // Dark Purple
                    vec3(1.00, 0.60, 0.80), // Pastel Pink
                    vec3(0.10, 0.10, 0.80), // Deep Blue
                    vec3(0.30, 0.90, 0.70), // Mint
                    vec3(1.00, 0.70, 0.20)  // Golden Yellow
                );

                vec3 nearestPalette(vec3 col) {
                    float minDist = 10.0;
                    vec3 best = p[0];
                    for(int i = 0; i < 12; i++) {
                        // Luma-weighted Euclidean distance for better perceptual mapping
                        vec3 diff = col - p[i];
                        float d = dot(diff, diff * vec3(0.299, 0.587, 0.114));
                        if(d < minDist) {
                            minDist = d;
                            best = p[i];
                        }
                    }
                    return best;
                }

                void main() {
                    // 1. Pixel Grid Lock
                    float virtual_height = 144.0; // Gameboy chunkiness
                    vec2 virtual_res = vec2(floor(virtual_height * (u_resolution.x / u_resolution.y)), virtual_height);
                    vec2 puv = (floor(vUv * virtual_res) + 0.5) / virtual_res;
                    
                    vec4 scene = texture(u_texture, puv);
                    vec3 col = scene.rgb;
                    float depth = scene.a;
                    
                    // 2. Sobel Edge Detection (Depth-based)
                    vec2 px = 1.0 / virtual_res;
                    float dU = texture(u_texture, puv + vec2(0.0, px.y)).a;
                    float dD = texture(u_texture, puv - vec2(0.0, px.y)).a;
                    float dL = texture(u_texture, puv - vec2(px.x, 0.0)).a;
                    float dR = texture(u_texture, puv + vec2(px.x, 0.0)).a;
                    
                    bool outline = false;
                    if (abs(depth - dU) > 0.5 || abs(depth - dD) > 0.5 || abs(depth - dL) > 0.5 || abs(depth - dR) > 0.5) {
                        outline = true;
                    }
                    
                    // 3. Ordered Dithering
                    int bx = int(mod(floor(vUv.x * virtual_res.x), 4.0));
                    int by = int(mod(floor(vUv.y * virtual_res.y), 4.0));
                    float dither = bayer[by * 4 + bx] - 0.5;
                    
                    col += dither * 0.5; // Aggressive dither spread
                    
                    // 4. Palette Snap
                    col = nearestPalette(col);
                    
                    // 5. Apply Outline
                    if (outline) {
                        col = vec3(0.1, 0.0, 0.2); // Dark Purple outline
                    }
                    
                    fragColor = vec4(col, 1.0);
                }
            `
        });
        
        const mesh2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat2);
        scene2.add(mesh2);
        
        canvas.__three = { renderer, scene1, mat1, target, scene2, mat2, camera };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene1, mat1, target, scene2, mat2, camera } = canvas.__three;

if (mat1?.uniforms?.u_time) {
    mat1.uniforms.u_time.value = time;
    mat1.uniforms.u_resolution.value.set(grid.width, grid.height);
}

if (mat2?.uniforms?.u_time) {
    mat2.uniforms.u_time.value = time;
    mat2.uniforms.u_resolution.value.set(grid.width, grid.height);
}

if (target.width !== grid.width || target.height !== grid.height) {
    target.setSize(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);

// Render Pass 1: SDF Scene to FBO
renderer.setRenderTarget(target);
renderer.render(scene1, camera);

// Render Pass 2: Post-Processing to Screen
renderer.setRenderTarget(null);
renderer.render(scene2, camera);