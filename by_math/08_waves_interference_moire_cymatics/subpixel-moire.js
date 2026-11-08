try {
    if (!ctx) throw new Error("WebGL context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        // THE WEIRD CODE GUY: CHROMATIC CANNIBALISM & SILICON NECROSIS
        // We do not just overlay grids. We extract the interferential cross-products.
        const fragmentShader = `
            uniform float u_time;
            uniform vec2 u_resolution;

            in vec2 vUv;
            out vec4 fragColor;

            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // The Hostile Substrate: A perfect RGB triad LED structure
            // Returns raw binary channel activation (1.0 or 0.0)
            vec3 ledGridRaw(vec2 uv, float scale, vec2 offset, float angle) {
                vec2 st = rot(angle) * uv * scale + offset;
                vec2 local = fract(st);

                // Triad Subpixel Separation (Shadow Mask / Trinitron)
                // R: 0.00-0.33, G: 0.33-0.66, B: 0.66-1.00
                float r = smoothstep(0.00, 0.05, local.x) - smoothstep(0.28, 0.33, local.x);
                float g = smoothstep(0.33, 0.38, local.x) - smoothstep(0.61, 0.66, local.x);
                float b = smoothstep(0.66, 0.71, local.x) - smoothstep(0.95, 1.00, local.x);

                // Horizontal Scanline Gap
                float scan = smoothstep(0.1, 0.3, local.y) - smoothstep(0.7, 0.9, local.y);

                return vec3(r, g, b) * scan;
            }

            void main() {
                // Normalize UVs
                vec2 uv = (vUv - 0.5) * (u_resolution.xy / u_resolution.y);

                // LITHOGENESIS: Scale Chirp & Domain Warp
                // Slight hyperbolic lens distortion so the moiré tapers towards the edges
                float r2 = dot(uv, uv);
                vec2 warpedUV = uv * (1.0 + r2 * 0.15);

                // Feral breathing (Machine Hesitation)
                warpedUV.x += sin(warpedUV.y * 3.0 + u_time * 0.2) * 0.004;
                warpedUV.y += cos(warpedUV.x * 2.5 - u_time * 0.15) * 0.004;

                // Resolution-aware scaling (approx 300 subpixels across height)
                float baseScale = 300.0;
                
                // Moiré requires a slight scale mismatch to create breathing macro-waves
                float scale1 = baseScale;
                float scale2 = baseScale * 1.01; 

                // 2 degrees offset = ~0.035 radians. We modulate it slightly to make the moiré "breathe"
                float angle1 = u_time * 0.015;
                float angle2 = angle1 + 0.035 + sin(u_time * 0.2) * 0.005;

                // Independent drift offsets
                vec2 off1 = vec2(sin(u_time * 0.05), cos(u_time * 0.03)) * 3.0;
                vec2 off2 = vec2(cos(u_time * 0.04), -sin(u_time * 0.06)) * 3.0;

                // Generate the two overlapping raw structures
                vec3 raw1 = ledGridRaw(warpedUV, scale1, off1, angle1);
                vec3 raw2 = ledGridRaw(warpedUV, scale2, off2, angle2);

                // LIGHT STARVATION: Base grids are heavily blue-dominant
                vec3 tint = vec3(0.05, 0.2, 1.0);

                // The Substrate: What you see if you look closely (quiet, blue, structural)
                vec3 base = (raw1 + raw2) * tint * 0.15;

                // THE MOIRÉ ENGINE: Chromatic Interference
                // 1. Direct Alignment: Where identical colors overlap (boosted white/blue)
                vec3 direct = raw1 * raw2 * tint * 4.0;

                // 2. Chromatic Cannibalism: Where mismatched colors overlap
                // This is the mathematical magic of Repo 07. Red overlapping Green creates Yellow fringes.
                float rg = raw1.r * raw2.g + raw1.g * raw2.r; // Yellow interference
                float rb = raw1.r * raw2.b + raw1.b * raw2.r; // Magenta interference
                float gb = raw1.g * raw2.b + raw1.b * raw2.g; // Cyan interference

                // We map these cross-beats to their respective secondary colors
                vec3 cross = vec3(rg + rb, rg + gb, rb + gb) * 2.5;

                // Combine: The moiré (direct + cross) totally dominates the base substrate
                vec3 color = base + direct + cross;

                // Aggressive tonal curve to make the fringes pop and simulate screen glow
                color = pow(color, vec3(1.1));
                
                // Abyssal Vignette (L13)
                color *= smoothstep(1.2, 0.2, r2);

                fragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (err) {
    console.error("Feral System Collapse (WebGL Error):", err);
}