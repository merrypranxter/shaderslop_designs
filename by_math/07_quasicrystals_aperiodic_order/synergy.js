const initFeralQuasicrystalPipeline = () => {
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
        // Force pixelated rendering at the canvas level
        renderer.setPixelRatio(1); 
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // THE MECHANISM: Phason-Corrupted 5D Cut-and-Project Ditherpunk
        // We simulate the continuous density field of a 5D hypercubic lattice projected to 2D.
        // We then infect it with a strict Bayer 4x4 dither and force it through a 5-color biological palette.
        const fragmentShader = `
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_isPressed;

            // pxv.technique.bayer_4x4.v1
            const float bayer4x4[16] = float[16](
                0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
               12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
                3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
               15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
            );

            // pxv.palette.endesga_32.v1 (Flesh/Bone subset)
            const vec3 PAL_VOID  = vec3(0.102, 0.110, 0.173); // #1a1c2c
            const vec3 PAL_TISSUE= vec3(0.365, 0.153, 0.365); // #5d275d
            const vec3 PAL_BLOOD = vec3(0.694, 0.243, 0.325); // #b13e53
            const vec3 PAL_NERVE = vec3(0.937, 0.490, 0.341); // #ef7d57
            const vec3 PAL_BONE  = vec3(1.000, 0.804, 0.459); // #ffcd75

            // math/golden_ratio_constants.json
            const float PHI = 1.6180339887;
            const float PI = 3.14159265359;

            // Calculates the quasiperiodic density field at point p
            float getQuasicrystalField(vec2 p, vec2 phasonStrain) {
                float field = 0.0;
                // 5-fold symmetry (Penrose projection)
                for(int i = 0; i < 5; i++) {
                    float angle = float(i) * PI * 2.0 / 5.0;
                    vec2 dir = vec2(cos(angle), sin(angle));
                    
                    // The "Strange Mechanism": Phason shift
                    // We project the strain vector into the perpendicular space (3*angle)
                    float perpAngle = float(i) * 3.0 * PI * 2.0 / 5.0;
                    vec2 perpDir = vec2(cos(perpAngle), sin(perpAngle));
                    float phase = dot(phasonStrain, perpDir);
                    
                    // Accumulate plane waves
                    field += cos(dot(p, dir) + phase);
                }
                return field;
            }

            void main() {
                // pxv.shader.pixelate_grid_lock.v1
                // Brutal low-res lock
                float virtWidth = 320.0; 
                float virtHeight = virtWidth * (u_resolution.y / u_resolution.x);
                vec2 pixelSize = 1.0 / vec2(virtWidth, virtHeight);
                vec2 virtualUV = floor(gl_FragCoord.xy / u_resolution.xy * vec2(virtWidth, virtHeight));
                vec2 uv = virtualUV * pixelSize;

                // Center coordinates and scale
                vec2 p = uv * 2.0 - 1.0;
                p.x *= u_resolution.x / u_resolution.y;
                
                // Zoom out over time, pulsing with PHI
                float scale = 30.0 + sin(u_time * 0.2) * 10.0;
                p *= scale;

                // Phason strain driven by mouse (diffusion in perpendicular space)
                // If pressed, we violently "anneal" the structure by forcing a rational phase
                vec2 mouseStrain = (u_mouse * 2.0 - 1.0) * 15.0;
                vec2 phasonStrain = mix(
                    vec2(u_time * PHI, u_time / PHI) + mouseStrain, 
                    floor(mouseStrain * PHI), // Annealing collapse
                    u_isPressed
                );

                // Domain warping: the crystal is infected
                vec2 warp = vec2(
                    sin(p.y * 0.1 + u_time),
                    cos(p.x * 0.1 - u_time)
                ) * (2.0 + u_isPressed * 5.0);
                
                // Sample the hyper-lattice
                float rawField = getQuasicrystalField(p + warp, phasonStrain);
                
                // Normalize field roughly to [0, 1] range (max sum of 5 cosines is 5, min is -~1.25)
                float lum = (rawField + 1.5) / 6.5;
                lum = clamp(lum, 0.0, 1.0);

                // pxv.shader.ordered_dither.v1
                int bx = int(mod(virtualUV.x, 4.0));
                int by = int(mod(virtualUV.y, 4.0));
                float bayerVal = bayer4x4[by * 4 + bx];

                // Dither spread matches the quantization steps
                float spread = 0.25; 
                float dithered = lum + (bayerVal - 0.5) * spread;

                // pxv.shader.palette_map_nearest.v1
                // Quantize to 5 levels
                float q = floor(dithered * 4.99); 
                
                vec3 col;
                if(q <= 0.0) col = PAL_VOID;
                else if(q <= 1.0) col = PAL_TISSUE;
                else if(q <= 2.0) col = PAL_BLOOD;
                else if(q <= 3.0) col = PAL_NERVE;
                else col = PAL_BONE;

                // Procedural Contour / Edge Detection (pxv.shader.outline_sobel.v1 analog)
                // We use the mathematical gradient of the field to draw structural lines
                float dFdx = getQuasicrystalField(p + warp + vec2(0.1, 0.0), phasonStrain) - rawField;
                float dFdy = getQuasicrystalField(p + warp + vec2(0.0, 0.1), phasonStrain) - rawField;
                float gradMag = length(vec2(dFdx, dFdy));
                
                // If gradient is sharp and we aren't annealing, draw a dark structural vein
                if (gradMag > 0.4 && u_isPressed < 0.5) {
                    col = mix(col, PAL_VOID, 0.8);
                }

                gl_FragColor = vec4(col, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_isPressed: { value: 0.0 }
            },
            depthWrite: false,
            depthTest: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    // Update Uniforms
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth mouse interpolation for organic phason drag
    const targetMouseX = mouse.x / grid.width;
    const targetMouseY = 1.0 - (mouse.y / grid.height); // Flip Y for GLSL
    material.uniforms.u_mouse.value.x += (targetMouseX - material.uniforms.u_mouse.value.x) * 0.1;
    material.uniforms.u_mouse.value.y += (targetMouseY - material.uniforms.u_mouse.value.y) * 0.1;
    
    material.uniforms.u_isPressed.value += ( (mouse.isPressed ? 1.0 : 0.0) - material.uniforms.u_isPressed.value ) * 0.2;

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
};

initFeralQuasicrystalPipeline();