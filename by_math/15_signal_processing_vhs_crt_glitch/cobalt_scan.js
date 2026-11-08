if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ 
            canvas, 
            context: ctx, 
            alpha: true, 
            antialias: false // Disabled to preserve pristine pixel-level interference
        });
        renderer.setPixelRatio(1.0); // Force 1:1 pixel mapping for true moiré

        const scene = new THREE.Scene();
        
        // Orthographic camera is perfect for screen-space pixel shaders
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float u_time;
            uniform vec2 u_resolution;
            in vec2 vUv;
            out vec4 fragColor;

            #define PI 3.14159265359

            void main() {
                vec2 uv = vUv;
                vec2 fc = gl_FragCoord.xy;

                // 1. Pristine Cold Geometry (Subtle CRT Barrel Distortion)
                vec2 crtUv = uv * 2.0 - 1.0;
                float r2 = dot(crtUv, crtUv);
                crtUv *= 1.0 + r2 * 0.03; 
                vec2 screenUv = crtUv * 0.5 + 0.5;

                // Screen bounds mask
                float bounds = step(0.0, screenUv.x) * step(screenUv.x, 1.0) * 
                               step(0.0, screenUv.y) * step(screenUv.y, 1.0);

                // 2. Interlacing Shimmer (Strictly every other scanline)
                float isEven = step(1.0, mod(fc.y, 2.0));
                
                // Electric shimmer waves traveling across the interlaced lines
                float shimmerWave = sin(u_time * 8.0 - screenUv.y * 20.0) * 0.5 + 0.5;
                float secondaryWave = cos(u_time * 3.1 + screenUv.x * 8.0) * 0.5 + 0.5;
                float shimmer = isEven * (shimmerWave * 0.8 + secondaryWave * 0.2);

                // 3. Faint White Moiré Grid (Wave / Sinusoidal Interference)
                // We use frequencies extremely close to the pixel scale to create true interference beats
                float f1 = PI * 0.94; // X spatial frequency
                float f2 = PI * 0.96; // Y spatial frequency
                
                // Micro-drift to animate the interference pattern without moving the grid much
                float scaleDrift = 1.0 + sin(u_time * 0.15) * 0.01;
                
                // Grid A
                float g1 = sin(fc.x * f1 * scaleDrift + u_time * 0.4) * 
                           sin(fc.y * f2 * scaleDrift);
                           
                // Grid B (Slightly offset frequency to create the moiré beat)
                float g2 = sin(fc.x * (f1 * 0.985) - u_time * 0.2) * 
                           sin(fc.y * (f2 * 0.992) + u_time * 0.3);
                           
                // Multiplicative blending for natural wave interference
                float moire = max(0.0, g1 * g2);
                
                // Sharpen and faint the fringes
                moire = pow(moire, 4.0) * 0.25; 

                // 4. Palette (Deep Cobalt, Electric Blue, White)
                vec3 deepNavy = vec3(0.005, 0.02, 0.10);
                vec3 electricBlue = vec3(0.0, 0.35, 1.0);
                vec3 pureWhite = vec3(0.9, 0.95, 1.0);

                // 5. Composition
                vec3 col = deepNavy;
                
                // Add scanline shimmer
                col = mix(col, electricBlue, shimmer * 0.9);
                
                // Add moiré grid over the top
                col += pureWhite * moire;
                
                // Deep center phosphor glow
                float ambientGlow = exp(-r2 * 2.5) * 0.15;
                col += electricBlue * ambientGlow;

                // Apply bounds and cold vignette
                col *= bounds;
                col *= 1.0 - smoothstep(0.5, 1.4, length(crtUv));

                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
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
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);