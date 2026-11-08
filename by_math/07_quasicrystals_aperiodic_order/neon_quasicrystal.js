if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
        camera.position.z = 1;
        
        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            
            // Complex arithmetic for Mobius transform
            vec2 cx_mul(vec2 a, vec2 b) { 
                return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); 
            }
            vec2 cx_div(vec2 a, vec2 b) { 
                float d = dot(b, b); 
                return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d; 
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Void black background falloff
                float r_uv = length(uv);
                float vignette = exp(-pow(r_uv * 1.1, 4.0));

                // 1. Medium Drift: Mobius Transform (Alchemical L07)
                // Creates the slow, non-linear panning through the quasicrystal manifold
                vec2 a = vec2(sin(u_time * 0.13) * 0.6, cos(u_time * 0.17) * 0.6);
                vec2 num = uv - a;
                vec2 den = vec2(1.0, 0.0) - cx_mul(vec2(a.x, -a.y), uv);
                vec2 z = cx_div(num, den);

                // Medium Rotation
                float theta = u_time * 0.05;
                mat2 rot = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
                vec2 p = rot * z * 18.0;

                float edge5 = 0.0;
                float hash5 = 0.0;
                float density5 = 0.0;

                // Irreconcilable Symmetry 1: 5-fold Pentagrid (Penrose Basis)
                for(int i = 0; i < 5; i++) {
                    float fi = float(i);
                    float angle = fi * 3.14159265359 / 5.0;
                    vec2 dir = vec2(cos(angle), sin(angle));

                    // 2. Slow Morphing: Phason drift via phase modulation
                    float phase = u_time * 0.2 * sin(fi * 1.618033);
                    float val = dot(p, dir) + phase;

                    float cell = floor(val);
                    float dist = fract(val);

                    // 3. Fast Shimmer: Edge thickness oscillation
                    float shimmer = 0.02 + 0.015 * sin(u_time * 20.0 + cell * 7.31);
                    float e = smoothstep(shimmer, shimmer + 0.02, dist) * smoothstep(1.0 - shimmer, 1.0 - shimmer - 0.02, dist);
                    edge5 += (1.0 - e);
                    
                    hash5 += cell * fract(sin(fi * 12.345) * 456.78);
                    density5 += cos(val * 3.14159); // Interference wave field
                }

                float edge7 = 0.0;
                float hash7 = 0.0;
                float density7 = 0.0;
                
                // Scale and rotate the 7-fold space to prevent exact harmonic alignment
                vec2 p7 = p * 1.618033; 
                mat2 rot7 = mat2(cos(1.0), -sin(1.0), sin(1.0), cos(1.0));
                p7 = rot7 * p7;

                // Irreconcilable Symmetry 2: 7-fold Heptagrid
                for(int i = 0; i < 7; i++) {
                    float fi = float(i);
                    float angle = fi * 3.14159265359 / 7.0;
                    vec2 dir = vec2(cos(angle), sin(angle));

                    float phase = u_time * 0.15 * cos(fi * 1.414213);
                    float val = dot(p7, dir) + phase;

                    float cell = floor(val);
                    float dist = fract(val);

                    float shimmer = 0.015 + 0.01 * cos(u_time * 25.0 + cell * 5.23);
                    float e = smoothstep(shimmer, shimmer + 0.015, dist) * smoothstep(1.0 - shimmer, 1.0 - shimmer - 0.015, dist);
                    edge7 += (1.0 - e);
                    
                    hash7 += cell * fract(cos(fi * 98.765) * 123.45);
                    density7 += cos(val * 3.14159);
                }

                // Combine structural hashes to define specific tile identities
                float combined_hash = fract(hash5 * 0.618 + hash7 * 0.382);

                // Fully Saturated Neon Palette
                vec3 neon_cyan = vec3(0.0, 1.0, 0.9);
                vec3 neon_mag  = vec3(1.0, 0.0, 0.8);
                vec3 neon_yg   = vec3(0.6, 1.0, 0.0);
                vec3 void_blk  = vec3(0.02, 0.0, 0.04);

                vec3 base_color;
                if(combined_hash < 0.33) base_color = neon_cyan;
                else if(combined_hash < 0.66) base_color = neon_mag;
                else base_color = neon_yg;

                // Solid Matter Texture: Color modulated by unique tile ID and interference depth
                float matter_density = smoothstep(-2.0, 4.0, density5 + density7 * 0.5);
                base_color *= 0.3 + 0.7 * fract(combined_hash * 13.73); 
                base_color *= 0.4 + 0.6 * matter_density; 

                // Edge rendering
                float edge_total = clamp(edge5 + edge7, 0.0, 1.0);
                vec3 final_color = mix(base_color, void_blk, edge_total);

                // 3. Fast Shimmer: Edge highlight/energy pulse based on tile hash
                float is_edge = step(0.1, edge_total);
                float edge_shimmer = is_edge * pow(0.5 + 0.5 * sin(u_time * 35.0 + combined_hash * 100.0), 4.0);
                final_color += edge_shimmer * base_color * 2.5;

                // Rare internal tile crystallization flicker
                float tile_shimmer = (1.0 - is_edge) * pow(0.5 + 0.5 * sin(u_time * 12.0 + combined_hash * 50.0), 15.0);
                final_color += tile_shimmer * vec3(0.8, 1.0, 0.9);

                // Apply void boundary fade
                final_color *= vignette;

                fragColor = vec4(final_color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            }
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

if (canvas.__three && canvas.__three.material && canvas.__three.material.uniforms) {
    canvas.__three.material.uniforms.u_time.value = time;
    canvas.__three.material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    canvas.__three.renderer.setSize(grid.width, grid.height, false);
    canvas.__three.renderer.render(canvas.__three.scene, canvas.__three.camera);
}