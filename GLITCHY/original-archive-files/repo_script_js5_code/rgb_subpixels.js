try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
            uniform float u_time;
            uniform vec2 u_resolution;
            out vec4 fragColor;

            void main() {
                // Calculate grid scaling based on resolution to maintain square cells
                float density = 180.0;
                vec2 st = vUv * vec2(u_resolution.x / u_resolution.y * density, density);
                vec2 cell = fract(st);

                // Subpixel triad centers within the cell
                vec2 r_pos = vec2(0.1666, 0.5);
                vec2 g_pos = vec2(0.5000, 0.5);
                vec2 b_pos = vec2(0.8333, 0.5);

                // Aspect correction for the subpixels so they render as circular dots 
                // instead of horizontal ovals within the square cell
                vec2 cell_asp = vec2(3.0, 1.0);
                
                float r_dist = length((cell - r_pos) * cell_asp);
                float g_dist = length((cell - g_pos) * cell_asp);
                float b_dist = length((cell - b_pos) * cell_asp);

                // Soft gaussian bloom function: exp(-d^2 * sigma)
                float sigma = 60.0;
                float r_dot = exp(-r_dist * r_dist * sigma) * 0.35;
                float g_dot = exp(-g_dist * g_dist * sigma) * 0.20;
                float b_dot = exp(-b_dist * b_dist * sigma) * 1.60;

                // Combine into a single RGB triad emission
                vec3 triad = vec3(r_dot, g_dot, b_dot);

                // Faint horizontal scan banding drifting slowly upward (rolling shutter)
                // We use two frequencies: a tight scanline and a broader rolling band
                float tight_scan = sin(vUv.y * u_resolution.y * 0.8 - u_time * 5.0) * 0.5 + 0.5;
                float broad_roll = sin(vUv.y * 20.0 - u_time * 1.2) * 0.5 + 0.5;
                
                float scan_mask = mix(0.85, 1.0, tight_scan) * mix(0.75, 1.0, broad_roll);

                // Deep blue-purple base color (the void between the phosphor dots)
                vec3 base = vec3(0.01, 0.00, 0.06);

                // Composite the final color
                vec3 color = base + (triad * scan_mask);

                // Subtle edge darkening to seat the texture in the viewport
                float vignette = 1.0 - length(vUv - 0.5) * 1.2;
                color *= smoothstep(0.0, 0.8, vignette);

                fragColor = vec4(color, 1.0);
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
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        if (material.uniforms.u_time) material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL System Failure:", e);
}