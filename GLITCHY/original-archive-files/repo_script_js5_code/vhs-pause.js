try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    if (!canvas.__three) {
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
            
            // Hash and Noise
            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            
            float noise(float x) {
                float i = floor(x);
                float f = fract(x);
                float u = f * f * (3.0 - 2.0 * f);
                return mix(hash(i), hash(i + 1.0), u);
            }
            
            // Distance field for a box
            float box(vec2 uv, vec2 pos, vec2 size) {
                vec2 d = abs(uv - pos) - size;
                return smoothstep(0.005, 0.0, max(d.x, d.y));
            }
            
            // Abstract pattern (looks like paused video UI or fragmented content)
            float pattern(vec2 p) {
                float b = 0.0;
                for(int i = 0; i < 6; i++) {
                    float y = 0.8 - float(i) * 0.09;
                    float w = 0.15 + hash(float(i)) * 0.25;
                    b += box(p, vec2(0.5, y), vec2(w, 0.012));
                }
                b += box(p, vec2(0.5, 0.25), vec2(0.3, 0.12));
                return clamp(b, 0.0, 1.0);
            }
            
            // Tape dropout - thin horizontal bands that strobe irregularly
            float tapeDropout(vec2 uv, float t) {
                float y = uv.y * u_resolution.y * 0.2;
                float strobe = hash(vec2(floor(y), floor(t * 24.0)));
                float band = step(0.98, strobe);
                float chunk = step(0.96, hash(vec2(floor(y * 0.05), floor(t * 12.0))));
                float tear = step(0.998, hash(vec2(uv.y * 10.0, t)));
                return clamp(band * chunk + tear, 0.0, 1.0);
            }
            
            // Moire interference mesh
            float moire(vec2 uv, float t) {
                float scale = 150.0;
                vec2 st1 = uv * scale;
                vec2 grid1 = abs(fract(st1) - 0.5);
                float d1 = smoothstep(0.1, 0.0, max(grid1.x, grid1.y));
                
                float angle = 0.02 * sin(t * 0.3);
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                vec2 st2 = rot * uv * (scale + 2.0) + vec2(t * 0.05);
                vec2 grid2 = abs(fract(st2) - 0.5);
                float d2 = smoothstep(0.1, 0.0, max(grid2.x, grid2.y));
                
                return d1 + d2;
            }
            
            void main() {
                vec2 uv = vUv;
                
                // Pause tracking jitter
                float t_step = floor(u_time * 15.0);
                float jitterX = (hash(t_step) - 0.5) * 0.005;
                float jitterY = (hash(t_step + 10.0) - 0.5) * 0.002;
                uv += vec2(jitterX, jitterY);
                
                // Tracking band / Head switching noise at bottom
                float trackingBand = smoothstep(0.08, 0.0, uv.y);
                uv.x += trackingBand * (hash(vec2(floor(uv.y * u_resolution.y * 0.5), u_time)) - 0.5) * 0.08;
                
                // Base near-white color
                vec3 col = vec3(0.95, 0.96, 0.95);
                
                // Moire interference mesh (faint grey)
                float m = moire(uv, u_time);
                col -= m * 0.06;
                
                // Scanlines
                float scanline = sin(uv.y * u_resolution.y * 0.5) * 0.5 + 0.5;
                col -= scanline * 0.08;
                
                // Tracking band noise
                col -= trackingBand * hash(vec2(uv.x * 200.0, u_time)) * 0.15;
                
                // Chromatic Aberration Pattern (bleeds pink/cyan)
                float offset = 0.004 + noise(u_time * 10.0) * 0.004;
                float patCyan = pattern(uv + vec2(offset, 0.0)); 
                float patPink = pattern(uv - vec2(offset, 0.0)); 
                float patBase = pattern(uv); 
                
                col.r -= patCyan * 0.4;
                col.g -= patPink * 0.4;
                col.b -= patBase * 0.4;
                
                // Ghosting / Temporal memory residue
                float patGhost = pattern(uv + vec2(0.02, 0.0));
                col -= patGhost * 0.08;
                
                // High brightness, low contrast color grading
                col = col * 0.5 + 0.45;
                
                // Tape Dropout (burns to pure white)
                float dropout = tapeDropout(uv, u_time);
                dropout += tapeDropout(uv + vec2(0.01, 0.0), u_time) * 0.5;
                dropout += tapeDropout(uv + vec2(0.02, 0.0), u_time) * 0.25;
                dropout = clamp(dropout, 0.0, 1.0);
                
                col = mix(col, vec3(1.0), dropout);
                
                // Edge vignette
                vec2 p = vUv * 2.0 - 1.0;
                col *= 1.0 - length(p) * 0.15;
                
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
            fragmentShader
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
    console.error("WebGL Initialization Failed:", e);
}