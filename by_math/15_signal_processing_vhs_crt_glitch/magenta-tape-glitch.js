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
                uniform float u_time;
                uniform vec2 u_resolution;
                out vec4 fragColor;

                // Hash for noise
                float hash11(float p) {
                    p = fract(p * .1031);
                    p *= p + 33.33;
                    p *= p + p;
                    return fract(p);
                }

                float hash12(vec2 p) {
                    vec3 p3  = fract(vec3(p.xyx) * .1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }

                // Continuous sinusoidal grid for soft interference
                float sineGrid(vec2 uv, float angle, float scale) {
                    float c = cos(angle), s = sin(angle);
                    vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
                    return (sin(rotUV.x * scale) * 0.5 + 0.5) * (sin(rotUV.y * scale) * 0.5 + 0.5);
                }

                // Woven moire pattern from two diagonal grids
                float moirePattern(vec2 uv) {
                    float a1 = 3.14159 / 4.0;
                    float a2 = a1 + 0.052; // ~3 degrees offset
                    
                    // Slow, desynchronized drift
                    vec2 o1 = vec2(u_time * 0.02, -u_time * 0.015);
                    vec2 o2 = vec2(-u_time * 0.01, u_time * 0.025);
                    
                    // Tape wobble affects the scale slightly
                    float tapeWobble = sin(u_time * 0.7) * 1.5;
                    float s1 = 180.0 + tapeWobble;
                    float s2 = 182.0 + tapeWobble;
                    
                    float g1 = sineGrid(uv + o1, a1, s1);
                    float g2 = sineGrid(uv + o2, a2, s2);
                    
                    // Multiplicative blending for woven textile quality
                    return pow(g1 * g2, 0.8);
                }

                void main() {
                    vec2 uv = vUv;
                    
                    // Tracking glitch logic (Tape Damage)
                    float gTime = u_time * 4.0;
                    float blockY = floor(uv.y * 24.0 - gTime);
                    float isGlitch = step(0.88, hash11(blockY)) * step(0.4, sin(uv.y * 4.0 - u_time * 1.5));
                    
                    // Horizontal tearing
                    float tear = (hash12(vec2(blockY, u_time)) - 0.5) * 0.2 * isGlitch;
                    vec2 distUv = uv + vec2(tear, 0.0);
                    
                    // RGB Separation (Chromatic aberration)
                    float rSpread = 0.012 + isGlitch * 0.05;
                    vec2 uvR = distUv + vec2(rSpread, 0.0);
                    vec2 uvG = distUv;
                    vec2 uvB = distUv - vec2(0.006, 0.0);
                    
                    // Smear Red (Analog Drag / Chroma Bleed)
                    float mR = 0.0;
                    float weightSum = 0.0;
                    for(int i = 0; i < 7; i++) {
                        float w = 1.0 - float(i) / 7.0;
                        mR += moirePattern(uvR - vec2(float(i) * 0.007, 0.0)) * w;
                        weightSum += w;
                    }
                    mR /= weightSum;
                    
                    float mG = moirePattern(uvG);
                    float mB = moirePattern(uvB);
                    
                    // Base color palette
                    vec3 baseColor = vec3(0.06, 0.01, 0.12); // Deep dark purple
                    vec3 moireColor = vec3(mR, mG, mB);
                    
                    // Blend moire into base
                    vec3 mixed = mix(baseColor, vec3(0.9, 0.7, 0.85), moireColor);
                    
                    // Magenta-shifted noise grain
                    float noiseVal = hash12(uv * u_resolution + u_time);
                    vec3 grain = vec3(noiseVal) * vec3(0.9, 0.1, 0.8) * 0.25;
                    
                    // Scanlines in deep violet
                    float sl = sin(uv.y * u_resolution.y * 0.45) * 0.5 + 0.5;
                    vec3 scanColor = mix(vec3(0.3, 0.0, 0.45), vec3(1.0), sl * 0.5 + 0.5);
                    
                    // Hot pink tracking band
                    vec3 pinkBand = vec3(1.0, 0.05, 0.5) * isGlitch * (noiseVal * 0.6 + 0.4);
                    
                    // Composite all layers
                    vec3 finalColor = mixed * scanColor + grain + pinkBand * 0.85;
                    
                    // Vignette
                    vec2 p = -1.0 + 2.0 * vUv;
                    float vig = length(p);
                    finalColor *= smoothstep(1.6, 0.5, vig);
                    
                    fragColor = vec4(finalColor, 1.0);
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