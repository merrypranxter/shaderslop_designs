if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
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
                precision highp float;
                
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                
                // [COLOR FIELDS] - Acid Neon Palette
                vec3 cosinePaletteNeon(float t) {
                    vec3 a = vec3(0.5, 0.5, 0.5);
                    vec3 b = vec3(0.5, 0.5, 0.33);
                    vec3 c = vec3(2.0, 1.0, 1.0);
                    vec3 d = vec3(0.5, 0.2, 0.25);
                    return a + b * cos(6.2831853 * (c * t + d));
                }
                
                // [STRUCTURAL COLOR] - Thin Film Interference
                vec3 thinFilm(float thickness) {
                    float pathDiff = 2.0 * 1.5 * thickness;
                    vec3 phase = vec3(0.0, 0.33, 0.67);
                    return 0.5 + 0.5 * cos(6.2831853 * (pathDiff / 500.0 + phase));
                }
                
                // [FRACTALS] - Celtic / Burning Ship Hybrid
                vec3 renderFractal(vec2 uv) {
                    vec2 z = uv * 2.2;
                    
                    // [MYCELIAL NETWORKS] - Morphogenesis Domain Warp
                    z += 0.12 * vec2(sin(z.y * 3.0 + u_time * 1.2), cos(z.x * 3.0 - u_time * 1.1));
                    
                    // [PSYCHEDELIC COLLAGE] - Kaleidoscope Fold
                    float angle = atan(z.y, z.x);
                    float radius = length(z);
                    float folds = 7.0;
                    float sector = 6.2831853 / folds;
                    angle = mod(angle + u_time * 0.15, sector);
                    if (angle > sector * 0.5) angle = sector - angle;
                    z = vec2(cos(angle), sin(angle)) * radius;
                    
                    // Julia seed morphing
                    vec2 c = vec2(-0.85, 0.156) + vec2(sin(u_time * 0.25), cos(u_time * 0.35)) * 0.08;
                    
                    float trap1 = 1e10;
                    float trap2 = 1e10;
                    float iter = 0.0;
                    
                    for(int i = 0; i < 120; i++) {
                        // Celtic absolute value fold
                        float rx = z.x * z.x - z.y * z.y;
                        z = vec2(abs(rx), 2.0 * z.x * z.y) + c;
                        
                        trap1 = min(trap1, length(z - vec2(0.5, 0.0)));
                        trap2 = min(trap2, abs(z.x * z.y));
                        
                        if(dot(z, z) > 256.0) {
                            iter = float(i) - log2(log2(dot(z, z))) + 4.0;
                            break;
                        }
                    }
                    
                    vec3 col = vec3(0.0);
                    if(iter > 0.0) {
                        // Escaped: highly acidic neon
                        col = cosinePaletteNeon(iter * 0.05 - u_time * 0.8);
                        // Structural color iridescence near escape boundaries
                        col += thinFilm(trap1 * 900.0) * 0.9 * exp(-trap1 * 5.0);
                    } else {
                        // Interior: dark cosmic void with glowing mycelial veins
                        col = cosinePaletteNeon(trap2 * 12.0 + u_time) * 0.15;
                        col += thinFilm(trap2 * 1800.0) * 2.0 * exp(-trap2 * 12.0);
                    }
                    
                    return col;
                }
                
                // [DITHER] - Hash noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                
                void main() {
                    vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
                    
                    // [DAMAGE AESTHETICS] - VHS Tracking Tear
                    float tear = step(0.97, sin(vUv.y * 25.0 + u_time * 12.0)) * sin(u_time * 40.0) * 0.04;
                    vec2 distortedUV = uv + vec2(tear, 0.0);
                    
                    // [PSYCHEDELIC COLLAGE] - Chromatic Aberration
                    float aberration = 0.015 + 0.01 * sin(u_time * 3.0);
                    vec3 col;
                    col.r = renderFractal(distortedUV + vec2(aberration, 0.0)).r;
                    col.g = renderFractal(distortedUV).g;
                    col.b = renderFractal(distortedUV - vec2(aberration, 0.0)).b;
                    
                    // [DAMAGE AESTHETICS] - CRT Scanlines & Raster
                    float scanline = 0.5 + 0.5 * sin(vUv.y * u_resolution.y * 2.0);
                    col *= 0.85 + 0.15 * scanline;
                    
                    // Phosphor bloom
                    col += col * col * 0.4;
                    
                    // Film Grain / Print Artifact
                    float grain = hash(vUv * u_time);
                    col += (grain - 0.5) * 0.15;
                    
                    // CMYK Misregistration glitch burst
                    if(hash(vec2(u_time * 0.1)) > 0.98) {
                        col.g = renderFractal(distortedUV + vec2(0.0, 0.06)).g;
                    }
                    
                    // Vignette
                    float vignette = length(vUv - 0.5);
                    col *= smoothstep(0.85, 0.2, vignette);
                    
                    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
                }
            `
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);