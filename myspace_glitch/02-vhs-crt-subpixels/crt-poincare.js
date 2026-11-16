if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
        camera.position.z = 1;

        const geometry = new THREE.PlaneGeometry(2, 2);
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
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_resolution;
                
                #define PI 3.14159265359
                
                // Complex Arithmetic
                vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
                vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
                vec2 conj(vec2 z) { return vec2(z.x, -z.y); }
                
                // Möbius Transform (Translate p to origin)
                vec2 mobius(vec2 z, vec2 p) {
                    return cdiv(z - p, vec2(1.0, 0.0) - cmul(conj(p), z));
                }
                
                // Hyperbolic Distance (safe atanh)
                float hyp_atanh(float x) {
                    return 0.5 * log((1.0 + x) / (1.0 - x));
                }
                
                void main() {
                    // Map to centered coordinates, aspect corrected
                    vec2 z = (vUv - 0.5) * 2.0;
                    z.x *= u_resolution.x / u_resolution.y;
                    
                    // Scale down so boundary is soft and visually infinite
                    z *= 0.85; 
                    
                    float r_raw = length(z);
                    float safe_r = clamp(r_raw, 0.0, 0.999);
                    vec2 z_safe = (r_raw > 0.0) ? (z / r_raw) * safe_r : z;
                    
                    // Orbiting center of the hyperbolic manifold
                    vec2 p = vec2(sin(u_time * 0.15) * 0.4, cos(u_time * 0.11) * 0.4);
                    vec2 z_m = mobius(z_safe, p);
                    
                    float center_dist = length(z_m);
                    float hyp_dist = 2.0 * hyp_atanh(center_dist);
                    float theta = atan(z_m.y, z_m.x);
                    
                    // Hyperbolic Tiling / Exponential Crowding
                    float ring_freq = 14.0;
                    float web = cos(hyp_dist * ring_freq - u_time * 0.5) * cos(theta * 6.0);
                    float hyp_pattern = smoothstep(-0.5, 0.8, web);
                    
                    // CRT Scanlines with gravitational curve near the singularity
                    float curve_weight = exp(-center_dist * 4.0);
                    vec2 scan_uv = vUv;
                    scan_uv.y += curve_weight * 0.02 * sin(theta);
                    
                    float scan_freq = u_resolution.y * 0.8;
                    float scanline = 0.5 + 0.5 * sin(scan_uv.y * scan_freq * PI);
                    scanline = smoothstep(0.2, 0.8, scanline);
                    
                    // Analog Noise
                    float noise = fract(sin(dot(vUv + u_time * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
                    
                    // Base Neutral Grey Composition
                    float luma = 0.16 + noise * 0.04;
                    luma *= mix(0.4, 1.0, scanline); // Scanline gaps
                    luma += hyp_pattern * 0.06; // Faint hyperbolic overlay
                    
                    // Moiré Interference at the boundary
                    float moire = cos(hyp_dist * ring_freq * 1.5) * sin(scan_uv.y * scan_freq * 0.5);
                    luma += moire * 0.03 * smoothstep(0.0, 3.0, hyp_dist);
                    
                    vec3 color = vec3(luma);
                    
                    // --- ONE CMYK HIT: MAGENTA AT THE DISK CENTER ---
                    // Misregister the geometry slightly for the magenta channel
                    vec2 p_mag = p + vec2(0.015, -0.01);
                    vec2 z_mag = mobius(z_safe, p_mag);
                    float dist_mag = length(z_mag);
                    float hyp_dist_mag = 2.0 * hyp_atanh(dist_mag);
                    float web_mag = cos(hyp_dist_mag * ring_freq - u_time * 0.5) * cos(atan(z_mag.y, z_mag.x) * 6.0);
                    float mag_pattern = smoothstep(-0.5, 0.8, web_mag);
                    
                    // Offset the scanline phase for the magenta pass
                    float mag_scanline = 0.5 + 0.5 * sin((scan_uv.y - 0.003) * scan_freq * PI);
                    mag_scanline = smoothstep(0.2, 0.8, mag_scanline);
                    
                    float mag_luma = 0.16 + noise * 0.04;
                    mag_luma *= mix(0.4, 1.0, mag_scanline);
                    mag_luma += mag_pattern * 0.12; 
                    
                    vec3 pure_magenta = vec3(1.0, 0.0, 1.0);
                    
                    // Create a mask that isolates the center of the Möbius transform
                    float mag_mask = smoothstep(0.6, 0.0, center_dist);
                    
                    // Blend the base grey with vibrant CMYK magenta where the geometry aligns
                    vec3 mag_layer = mix(vec3(mag_luma), pure_magenta, mag_pattern * 0.7 + 0.1);
                    
                    // Hard singularity glow at absolute zero
                    float singularity = exp(-center_dist * 40.0);
                    mag_layer += pure_magenta * singularity * 1.2;
                    
                    // Composite the magenta hit over the neutral grey
                    color = mix(color, mag_layer, mag_mask * 0.85);
                    
                    // CRT Vignette / Edge Falloff
                    color *= smoothstep(1.8, 0.4, r_raw);
                    
                    fragColor = vec4(color, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
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