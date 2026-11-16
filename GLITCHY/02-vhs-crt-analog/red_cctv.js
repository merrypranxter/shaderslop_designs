if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        
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
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                
                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }
                
                float lineGrid(vec2 uv, float scale, vec2 offset) {
                    vec2 st = uv * scale + offset;
                    vec2 grid = abs(fract(st) - 0.5);
                    float lines = smoothstep(0.12, 0.0, min(grid.x, grid.y));
                    return lines;
                }
                
                void main() {
                    vec2 uv = vUv;
                    
                    // Tape Tracking Tear (Random horizontal shifts)
                    float tearY = hash(vec2(floor(u_time * 3.0), 1.0));
                    if (abs(uv.y - tearY) < 0.015) {
                        uv.x += hash(vec2(u_time, uv.y)) * 0.04 - 0.02;
                    }
                    
                    // Head switching noise
                    float headSwitch = 0.0;
                    if (uv.y < 0.05) {
                        uv.x += (hash(vec2(u_time * 10.0, uv.y)) - 0.5) * 0.02;
                        headSwitch = hash(uv * vec2(200.0, 10.0) + u_time * 5.0);
                    }
                    
                    vec2 centerUv = uv - 0.5;
                    centerUv.x *= u_resolution.x / u_resolution.y;
                    
                    // 1. Moiré Crimson Grid
                    float g1 = lineGrid(centerUv, 90.0, vec2(0.0));
                    vec2 offset = vec2(sin(u_time * 0.03) * 0.08, cos(u_time * 0.02) * 0.08);
                    float g2 = lineGrid(centerUv, 92.0, offset);
                    float moireAdd = g1 + g2;
                    
                    // 2. Scanlines & Interlace
                    float scanlines = sin(uv.y * u_resolution.y * 2.0 + u_time * 15.0) * 0.5 + 0.5;
                    float interlace = sin(uv.y * u_resolution.y * 0.5 - u_time * 5.0) * 0.5 + 0.5;
                    float raster = mix(0.4, 1.0, scanlines * interlace);
                    
                    // 3. Timestamp Burn-in
                    vec2 timeUv = uv - vec2(0.7, 0.05);
                    timeUv.x *= u_resolution.x / u_resolution.y;
                    
                    float timeBurn = 0.0;
                    float scar = 0.0;
                    
                    if (timeUv.x > 0.0 && timeUv.x < 0.25 && timeUv.y > 0.0 && timeUv.y < 0.04) {
                        vec2 charUv = timeUv * vec2(60.0, 20.0);
                        vec2 iCharUv = floor(charUv);
                        float charMask = step(0.2, fract(timeUv.x * 5.0)); 
                        
                        if (charMask > 0.0) {
                            // Permanent phosphor scar from 72 hours of operation
                            float persistentShape = hash(iCharUv + 123.0); 
                            scar = step(0.5, persistentShape) * 0.4;
                            
                            // Active flickering text
                            float activeText = hash(iCharUv + floor(u_time * 2.0)); 
                            float flicker = step(0.85, hash(vec2(u_time * 12.0, iCharUv.x))); 
                            if (flicker > 0.0) {
                                timeBurn = step(0.4, activeText) * 0.9;
                            }
                        }
                    }
                    
                    // Phosphor smear / chroma bleed
                    float smear = 0.0;
                    for(int i = 1; i < 10; i++) {
                        vec2 sUv = timeUv - vec2(float(i) * 0.004, 0.0);
                        if (sUv.x > 0.0 && sUv.x < 0.25 && sUv.y > 0.0 && sUv.y < 0.04) {
                            float charMask = step(0.2, fract(sUv.x * 5.0));
                            if (charMask > 0.0) {
                                vec2 charUv = sUv * vec2(60.0, 20.0);
                                float activeText = hash(floor(charUv) + floor(u_time * 2.0));
                                float flicker = step(0.85, hash(vec2(u_time * 12.0, floor(charUv).x)));
                                smear += step(0.4, activeText) * flicker * (1.0 / float(i));
                            }
                        }
                    }
                    
                    // Colors
                    vec3 baseCol = vec3(0.015, 0.0, 0.0);
                    vec3 crimson = vec3(0.45, 0.0, 0.05);
                    vec3 brightRed = vec3(1.0, 0.1, 0.1);
                    vec3 darkScar = vec3(0.2, 0.0, 0.0);
                    
                    vec3 col = baseCol;
                    col += moireAdd * crimson;
                    col += headSwitch * crimson * 0.8;
                    
                    col *= raster;
                    
                    // Heavy Sensor Noise Grain
                    float n1 = hash(uv * u_time * 100.0);
                    float n2 = hash(uv * u_time * 110.0);
                    float noiseG = mix(0.4, 1.6, n1);
                    col *= noiseG;
                    col += vec3(0.2, 0.0, 0.0) * n2 * smoothstep(0.2, 0.0, col.r);
                    
                    // Vignette
                    float vig = 1.0 - smoothstep(0.3, 1.3, length(centerUv));
                    col *= vig;
                    
                    // Add burn-in and smear
                    col += scar * darkScar;
                    col += timeBurn * brightRed;
                    col += smear * crimson * 0.7;
                    
                    // Overall flicker
                    col *= mix(0.9, 1.0, hash(vec2(u_time, 0.0)));
                    
                    // Dark edge framing
                    col *= smoothstep(0.0, 0.02, uv.x) * smoothstep(1.0, 0.98, uv.x);
                    col *= smoothstep(0.0, 0.02, uv.y) * smoothstep(1.0, 0.98, uv.y);
                    
                    fragColor = vec4(col, 1.0);
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
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);