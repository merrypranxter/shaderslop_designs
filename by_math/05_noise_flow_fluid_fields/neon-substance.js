if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
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
        
        // Hash function for pseudo-randomness
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        // 2D Value Noise
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }
        
        // Fractional Brownian Motion (FBM)
        float fbm(vec2 p, float t) {
            float v = 0.0;
            float a = 0.5;
            mat2 rot = mat2(0.87758, 0.47942, -0.47942, 0.87758);
            for (int i = 0; i < 6; i++) {
                v += a * noise(p + t);
                p = rot * p * 2.0;
                a *= 0.5;
            }
            return v;
        }
        
        // Exact Voronoi with border distance
        vec3 voronoi(vec2 p, float t) {
            vec2 n = floor(p);
            vec2 f = fract(p);
            float md = 8.0;
            vec2 mr = vec2(0.0);
            vec2 mg = vec2(0.0);
            
            // First pass: find closest cell center
            for(int y=-1; y<=1; y++) {
                for(int x=-1; x<=1; x++) {
                    vec2 g = vec2(float(x), float(y));
                    vec2 o = vec2(hash(n + g), hash(n + g + 123.4));
                    o = 0.5 + 0.5 * sin(t + 6.2831 * o);
                    vec2 r = g + o - f;
                    float d = dot(r, r);
                    if(d < md) {
                        md = d;
                        mr = r;
                        mg = g;
                    }
                }
            }
            
            md = 8.0;
            // Second pass: compute exact distance to the cell border
            for(int y=-2; y<=2; y++) {
                for(int x=-2; x<=2; x++) {
                    vec2 g = mg + vec2(float(x), float(y));
                    vec2 o = vec2(hash(n + g), hash(n + g + 123.4));
                    o = 0.5 + 0.5 * sin(t + 6.2831 * o);
                    vec2 r = g + o - f;
                    if(dot(mr - r, mr - r) > 0.00001) {
                        md = min(md, dot(0.5*(mr+r), normalize(r-mr)));
                    }
                }
            }
            return vec3(md, mr);
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
            vec2 p = uv * aspect * 5.0;
            
            // Three simultaneous time scales
            float t_slow = u_time * 0.15;
            float t_med  = u_time * 0.5;
            float t_fast = u_time * 2.0;
            
            // Machine hesitation / stutter for the fast layer
            float t_stutter = t_fast + 0.15 * noise(vec2(t_fast * 15.0, 0.0));
            
            // 1. Domain Warp (Slow Global Drift)
            vec2 q = vec2(fbm(p + vec2(0.0,0.0), t_slow),
                          fbm(p + vec2(5.2,1.3), t_slow));
                          
            vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7,9.2), t_med),
                          fbm(p + 4.0*q + vec2(8.3,2.8), t_med));
                          
            float n_val = fbm(p + 4.0*r, t_slow);
            
            // 2. Cellular Structure (Medium Structural Motion)
            vec2 cell_p = p * 1.5 + r * 2.5;
            vec3 cell = voronoi(cell_p, t_med);
            float border = cell.x; 
            vec2 toCenter = cell.yz; 
            float centerDist = length(toCenter);
            
            // 3. Physical Surface Approximation (Fake Normals & Lighting)
            vec3 normal = normalize(vec3(-toCenter * 3.0, 1.0));
            normal = normalize(normal + vec3(r * 0.6, 0.0)); // Distort normal with FBM
            
            vec3 lightDir = normalize(vec3(sin(t_slow)*0.5, cos(t_slow)*0.5, 1.0));
            float diffuse = max(0.0, dot(normal, lightDir));
            float specular = pow(max(0.0, dot(reflect(-lightDir, normal), vec3(0.0,0.0,1.0))), 24.0);
            
            // 4. Detail Shimmer (Fast Motion)
            float shimmer = noise(p * 25.0 + t_stutter + border * 15.0);
            shimmer = pow(shimmer, 6.0); 
            
            // 5. Material Grain
            float grain = fract(sin(dot(uv + t_fast, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
            
            // CMYK-inspired Neon Palette against Void Black
            vec3 neonCyan = vec3(0.0, 1.0, 0.9);
            vec3 neonMag  = vec3(1.0, 0.0, 0.8);
            vec3 neonYel  = vec3(1.0, 0.9, 0.0);
            vec3 voidBlk  = vec3(0.01, 0.0, 0.02);
            
            // 6. Layered Composition
            // Base void with magenta subsurface thermal bloom
            vec3 col = mix(voidBlk, neonMag * 0.5, smoothstep(0.2, 0.8, n_val) * diffuse);
            
            // Cyan webbing crystallized along the Voronoi borders
            float cyanMask = smoothstep(0.12, 0.0, border);
            col = mix(col, neonCyan * (0.7 + 0.5 * diffuse), cyanMask * (0.4 + 0.6 * noise(r * 20.0 + t_med)));
            
            // Yellow structural cores glowing from deep inside
            float yelMask = smoothstep(0.4, 0.0, centerDist) * smoothstep(0.3, 0.8, r.y);
            col += neonYel * yelMask * 0.9 * (0.8 + 0.2 * sin(t_fast + centerDist * 10.0));
            
            // High-frequency shimmer highlights trapped in the crevices
            float crevice = smoothstep(0.06, 0.0, border);
            col += neonCyan * crevice * shimmer * 4.0;
            col += neonMag * smoothstep(0.4, 0.7, r.x) * shimmer * 2.5;
            
            // Wet specular highlights on the cyan webbing
            col += vec3(1.0) * specular * cyanMask * 0.8;
            
            // 7. Depth shading and Ambient Occlusion
            float ao = smoothstep(0.0, 0.35, border); 
            col *= mix(0.15, 1.0, ao); // Deepen crevices
            col *= mix(0.3, 1.0, smoothstep(0.1, 0.7, n_val)); // Macro shadows driven by FBM
            
            // 8. Post-processing (Contrast, Grain, Vignette)
            col = pow(col, vec3(1.15)); // Film-like contrast curve
            col += grain * 0.08; // Physical film grain
            
            vec2 vuv = uv - 0.5;
            col *= 1.0 - dot(vuv, vuv) * 1.5; // Heavy vignette to frame the void
            
            fragColor = vec4(col, 1.0);
        }
      `
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

if (material?.uniforms?.u_time) {
  material.uniforms.u_time.value = time;
}
if (material?.uniforms?.u_resolution) {
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);