try {
    // FERAL DESIGN MECHANISM: "Aperiodic Ditherpunk Diffraction Bloom"
    // Fuses the rigorous 5-fold wave interference of quasicrystals (quasicrystals repo)
    // with brutalist pixel-locked screen-space dithering (pixel_voxel repo)
    // and hyper-saturated, eye-bleeding neon colorways (lisa_frank_aesthetic).
    // The result is a mathematically pure, infinitely non-repeating structure 
    // forced through a low-fi retro rendering pipeline.

    if (!canvas.__three) {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
        if (!gl) throw new Error("WebGL 2 not supported or context occupied");

        const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
        const scene = new THREE.Scene();
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
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            
            // PIXEL_VOXEL REPO: Bayer 4x4 Dither Matrix
            const float bayer[16] = float[16](
                0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
               12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
                3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
               15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
            );

            // LISA_FRANK_AESTHETIC REPO: Hyper-saturated 6-step palette
            const vec3 pal[6] = vec3[6](
                vec3(0.10, 0.04, 0.18), // Deep Void Purple
                vec3(0.54, 0.17, 0.89), // Electric Violet
                vec3(1.00, 0.08, 0.58), // Deep Pink
                vec3(1.00, 0.00, 1.00), // Magenta
                vec3(0.00, 1.00, 1.00), // Cyan
                vec3(1.00, 1.00, 0.00)  // Neon Yellow
            );

            // QUASICRYSTALS REPO: 5-Fold Penrose Diffraction Field
            float quasicrystal(vec2 p) {
                float v = 0.0;
                // Sum 5 plane waves oriented at multiples of pi/5
                for(int i = 0; i < 5; i++) {
                    float a = float(i) * 3.1415926535 / 5.0;
                    vec2 d = vec2(cos(a), sin(a));
                    // Add phase shifting over time to make the structure "boil"
                    float phase = u_time * (0.2 + float(i) * 0.05);
                    v += cos(dot(p, d) + phase);
                }
                return v;
            }

            // Evaluate a specific point in the dithered palette space
            float getPaletteIndex(vec2 p, float bayerVal, float defect) {
                // Domain warp the space slightly for organic feel
                vec2 warpedP = p + vec2(sin(p.y * 2.0 - u_time), cos(p.x * 2.0 + u_time)) * 0.15;
                
                // Scale field
                float field = quasicrystal(warpedP * 15.0 + defect * 3.0);
                
                // Normalize from roughly [-5, 5] to [0, 1]
                field = (field + 5.0) / 10.0;
                
                // Non-linear shaping to cluster values at extremes (creates harder shapes)
                field = smoothstep(0.1, 0.9, field);
                
                // Dither offset
                float spread = 0.25; // Matching pixel_voxel recommended spread
                float dithered = field + (bayerVal - 0.5) * spread;
                
                // Quantize to 6 palette indices
                return clamp(floor(dithered * 6.0), 0.0, 5.0);
            }

            void main() {
                // PIXEL_VOXEL REPO: Stable Pixel Grid Lock
                float pixelScale = 4.0; // Size of virtual pixels
                vec2 virtRes = floor(u_resolution / pixelScale);
                vec2 lockedUV = floor(vUv * virtRes) / virtRes;
                
                // Aspect correct coordinates for math
                vec2 p = (lockedUV - 0.5) * (virtRes / virtRes.y);
                vec2 mouseP = (u_mouse - 0.5) * (u_resolution / u_resolution.y);
                
                // Compute defect based on mouse proximity (warps the quasicrystal)
                float dist = length(p - mouseP);
                float defect = sin(dist * 15.0 - u_time * 4.0) * exp(-dist * 3.0);
                
                // Dither matrix coordinates based on virtual pixel grid
                int bx = int(mod(floor(vUv.x * virtRes.x), 4.0));
                int by = int(mod(floor(vUv.y * virtRes.y), 4.0));
                float bVal = bayer[by * 4 + bx];
                
                // Get base color index
                float idx = getPaletteIndex(p, bVal, defect);
                vec3 col = pal[int(idx)];
                
                // PIXEL_VOXEL REPO: Sobel/Edge-Detect Hard Outline
                // Sample 1 virtual pixel right and up
                vec2 px = vec2(1.0 / virtRes.x, 0.0) * (virtRes / virtRes.y);
                vec2 py = vec2(0.0, 1.0 / virtRes.y) * (virtRes / virtRes.y);
                
                float idxR = getPaletteIndex(p + px, bVal, defect);
                float idxU = getPaletteIndex(p + py, bVal, defect);
                
                // If neighbor crosses a palette threshold, draw black outline
                if(abs(idx - idxR) > 0.1 || abs(idx - idxU) > 0.1) {
                    col = vec3(0.02, 0.01, 0.05); // Deep space outline
                }
                
                fragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
            },
            depthWrite: false,
            depthTest: false
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(plane);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    // Guard uniform access
    if (material?.uniforms) {
        material.uniforms.u_time.value = time;
        
        // Handle resizing
        if (material.uniforms.u_resolution.value.x !== grid.width || 
            material.uniforms.u_resolution.value.y !== grid.height) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
            renderer.setSize(grid.width, grid.height, false);
        }

        // Smoothly interpolate mouse to avoid jerky domain warping
        const targetX = mouse.x / grid.width;
        const targetY = 1.0 - (mouse.y / grid.height); // Flip Y for GLSL
        
        if (mouse.isPressed) {
             material.uniforms.u_mouse.value.x += (targetX - material.uniforms.u_mouse.value.x) * 0.1;
             material.uniforms.u_mouse.value.y += (targetY - material.uniforms.u_mouse.value.y) * 0.1;
        } else {
             // Drift slowly when not pressed
             material.uniforms.u_mouse.value.x += (0.5 + Math.sin(time * 0.5) * 0.3 - material.uniforms.u_mouse.value.x) * 0.02;
             material.uniforms.u_mouse.value.y += (0.5 + Math.cos(time * 0.3) * 0.3 - material.uniforms.u_mouse.value.y) * 0.02;
        }
    }

    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral Quasicrystal Initialization Failed:", e);
    // Fallback to basic visual if WebGL2 fails
    if (ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, grid.width, grid.height);
        ctx.fillStyle = '#FF00FF';
        ctx.font = '20px monospace';
        ctx.fillText('WEBGL2 REQUIRED FOR QUASICRYSTAL BLOOM', 20, 40);
    }
}