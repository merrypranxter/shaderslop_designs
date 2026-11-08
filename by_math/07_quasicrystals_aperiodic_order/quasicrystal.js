if (typeof THREE !== 'undefined') {
    if (!canvas.__three) {
        try {
            if (!ctx) throw new Error("WebGL 2 context not available");

            const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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

            const fragmentShader = `
                in vec2 vUv;
                out vec4 fragColor;
                uniform float u_time;
                uniform vec2 u_resolution;

                #define PI 3.14159265359

                // Safe hyperbolic arctangent for projective unrolling
                float safe_atanh(float x) {
                    x = clamp(x, -0.9999, 0.9999);
                    return 0.5 * log((1.0 + x) / (1.0 - x));
                }

                // Feral neon palette: Cyan, Magenta, Yellow-Green
                vec3 getNeon(float t) {
                    vec3 c1 = vec3(0.0, 1.0, 1.0); 
                    vec3 c2 = vec3(1.0, 0.0, 1.0); 
                    vec3 c3 = vec3(0.5, 1.0, 0.0); 
                    t = fract(t);
                    if(t < 0.333) return mix(c1, c2, smoothstep(0.0, 1.0, t * 3.0));
                    if(t < 0.666) return mix(c2, c3, smoothstep(0.0, 1.0, (t - 0.333) * 3.0));
                    return mix(c3, c1, smoothstep(0.0, 1.0, (t - 0.666) * 3.0));
                }

                mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

                // Complex math for Mobius translation
                vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
                vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
                vec2 mobius_translate(vec2 z, vec2 p) {
                    return cdiv(z - p, vec2(1.0, 0.0) - cmul(vec2(p.x, -p.y), z));
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    uv.x *= u_resolution.x / u_resolution.y;

                    // 3 Time scales: slow morph, medium drift, fast shimmer
                    float t_slow = u_time * 0.15;
                    // Machine hesitation: temporal stutter in the medium time scale
                    float t_med = u_time * 0.4 + 0.05 * sin(u_time * 12.0); 
                    float t_fast = u_time * 4.0;

                    uv *= 1.15; 

                    float r_len = length(uv);
                    if (r_len > 0.995) {
                        fragColor = vec4(0.0, 0.0, 0.0, 1.0); // Void black background
                        return;
                    }

                    // Mobius drift (orbiting the origin of the Poincaré disk)
                    vec2 center = vec2(sin(t_med)*0.3, cos(t_med * 0.8)*0.3);
                    vec2 z = mobius_translate(uv, center);
                    z *= rot(t_med * 0.3);

                    // Hyperbolic unrolling (projects the disk onto an infinite plane)
                    float h_dist = safe_atanh(length(z));
                    vec2 p_uv = normalize(z) * h_dist;

                    float scale = 3.5;
                    float sum_cos = 0.0;
                    float index_sum = 0.0;
                    vec3 edge_glow = vec3(0.0);
                    float interference = 1.0;

                    // 7-fold irreconcilable symmetry (Heptagrid projection)
                    for(int i = 0; i < 7; i++) {
                        float fi = float(i);
                        float angle = fi * PI * 2.0 / 7.0;
                        vec2 dir = vec2(cos(angle), sin(angle));

                        // Slow morphing cut window delaminating from 7D
                        float gamma = sin(t_slow * 1.3 + fi * 1.618) * 2.0;

                        // Project to 1D axis
                        float p = dot(p_uv, dir) * scale + gamma;

                        float w = cos(p * PI * 2.0);
                        sum_cos += w;
                        interference *= w; // Moiré multiplication

                        // 7D cell index hash
                        float cell = floor(p);
                        index_sum += cell * sin(fi * 123.456);

                        // Edge proximity
                        float edge_dist = abs(fract(p) - 0.5);

                        // Fast shimmer on the edges (phase modulation)
                        float shimmer = sin(p * 25.0 - t_fast + fi) * 0.5 + 0.5;
                        float intensity = 0.01 / (edge_dist + 0.002) * shimmer;

                        edge_glow += getNeon(fi / 7.0 + t_slow) * intensity;
                    }

                    // Tile color driven by 7D topological index
                    vec3 base_color = getNeon(index_sum * 4.33);

                    // Solid matter representation via interference contours
                    float matter = smoothstep(-0.2, 0.5, interference);
                    matter *= 0.6 + 0.4 * sin(interference * 30.0 - t_fast * 0.5); // Topographical ridges

                    // Depth in the projection
                    float depth = sum_cos / 7.0;

                    vec3 final_color = base_color * matter * (0.8 + 0.5 * depth);

                    // Add shimmering edges, weighted by depth
                    final_color += edge_glow * smoothstep(-0.8, 0.8, depth);

                    // Contrast push and void mask blending
                    final_color = pow(final_color, vec3(1.3, 1.3, 1.3));
                    final_color *= smoothstep(0.995, 0.95, r_len); // Anti-alias disk boundary

                    fragColor = vec4(final_color, 1.0);
                }
            `;

            const material = new THREE.ShaderMaterial({
                glslVersion: THREE.GLSL3,
                uniforms: {
                    u_time: { value: 0 },
                    u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
                },
                vertexShader,
                fragmentShader
            });

            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
            scene.add(mesh);

            canvas.__three = { renderer, scene, camera, material };
        } catch (e) {
            console.error("Feral Quasicrystal Initialization Failed:", e);
            return;
        }
    }

    const { renderer, scene, camera, material } = canvas.__three;
    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
        }
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
} else {
    // Graceful fallback if THREE is not available, though directives demand WebGL via THREE.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, grid.width, grid.height);
    ctx.fillStyle = '#0ff';
    ctx.font = '20px monospace';
    ctx.fillText('THREE.js is required for 7D Heptagrid Shader', 20, 40);
}