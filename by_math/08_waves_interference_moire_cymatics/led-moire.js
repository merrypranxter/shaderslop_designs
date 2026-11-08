if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            precision highp float;

            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;

            // Generates a continuous sine-wave based LED triad grid
            vec3 ledGridWave(vec2 uv, float scale, float angle, vec2 offset) {
                float c = cos(angle);
                float s = sin(angle);
                mat2 rot = mat2(c, -s, s, c);
                vec2 st = rot * uv * scale + offset;
                
                // Spatial phase shift for RGB subpixels (0, 120, 240 degrees)
                float rx = sin(st.x * 6.2831853) * 0.5 + 0.5;
                float gx = sin(st.x * 6.2831853 - 2.0943951) * 0.5 + 0.5;
                float bx = sin(st.x * 6.2831853 - 4.1887902) * 0.5 + 0.5;
                
                // Y-axis scanline gap
                float yMask = sin(st.y * 6.2831853) * 0.5 + 0.5;
                
                // Shape into rounded, distinct diodes
                rx = pow(rx, 1.5);
                gx = pow(gx, 1.5);
                bx = pow(bx, 1.5);
                yMask = pow(yMask, 1.2);
                
                // Blue-dominant intensity weighting
                return vec3(rx * 0.35, gx * 0.65, bx * 1.0) * yMask;
            }

            void main() {
                // Centered, aspect-corrected UV
                vec2 uv = (vUv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y));
                
                // 20-second perfect loop
                float theta = (u_time / 20.0) * 6.2831853;
                
                // Domain warp: gently curves the grids to create fluid, organic moiré waves
                vec2 uv1 = uv + vec2(sin(uv.y * 4.0 + theta), cos(uv.x * 4.0 - theta)) * 0.005;
                vec2 uv2 = uv + vec2(cos(uv.y * 3.0 - theta * 2.0), sin(uv.x * 3.0 + theta * 2.0)) * 0.005;
                
                // High frequency scales, breathing slightly
                float scale1 = 220.0 + sin(theta) * 3.0;
                float scale2 = 220.0 + cos(theta * 2.0) * 3.0;
                
                // Base rotation + ~2 degree offset (0.035 rad) for large-scale moiré
                float angle1 = sin(theta) * 0.15; 
                float angle2 = angle1 + 0.035 + cos(theta) * 0.015;
                
                // Sub-pixel drifting to animate the interference fringes
                vec2 offset1 = vec2(sin(theta), cos(theta)) * 4.0;
                vec2 offset2 = vec2(sin(theta * 2.0), cos(theta * 2.0)) * 2.0;
                
                vec3 g1 = ledGridWave(uv1, scale1, angle1, offset1);
                vec3 g2 = ledGridWave(uv2, scale2, angle2, offset2);
                
                // Hybrid blending: Additive for glowing intersections, Multiplicative for dark fringes
                vec3 moireAdd = g1 + g2;
                vec3 moireMult = g1 * g2;
                
                // Contrast push specific to the max values of each channel to extract pure chromatic beats
                vec3 normAdd = vec3(
                    smoothstep(0.10, 0.70, moireAdd.r),
                    smoothstep(0.20, 1.30, moireAdd.g),
                    smoothstep(0.40, 2.00, moireAdd.b)
                );
                
                vec3 normMult = vec3(
                    smoothstep(0.01, 0.12, moireMult.r),
                    smoothstep(0.04, 0.42, moireMult.g),
                    smoothstep(0.10, 1.00, moireMult.b)
                );
                
                vec3 color = mix(normAdd, normMult, 0.7);
                
                // Saturation boost to emphasize the emergent CMY colors from RGB interference
                float lum = dot(color, vec3(0.299, 0.587, 0.114));
                color = mix(vec3(lum), color, 1.7);
                
                // Deepen the overall image, letting the moiré bands act as light sources
                color = pow(color, vec3(1.2));
                
                // Inject a faint ambient blue into the dark substrate
                color += vec3(0.0, 0.05, 0.15) * (1.0 - lum);
                
                // Vignette
                float vignette = 1.0 - length(uv) * 0.6;
                color *= smoothstep(-0.2, 1.2, vignette);
                
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