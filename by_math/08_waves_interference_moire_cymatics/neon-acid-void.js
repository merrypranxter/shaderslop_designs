try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

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
      out vec4 fragColor;
      
      uniform float u_time;

      // 3D Hash
      vec3 hash33(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.xxy + p.yxx) * p.zyx);
      }

      // Value Noise
      float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
              mix(mix(hash33(i + vec3(0.0,0.0,0.0)).x, hash33(i + vec3(1.0,0.0,0.0)).x, f.x),
                  mix(hash33(i + vec3(0.0,1.0,0.0)).x, hash33(i + vec3(1.0,1.0,0.0)).x, f.x), f.y),
              mix(mix(hash33(i + vec3(0.0,0.0,1.0)).x, hash33(i + vec3(1.0,0.0,1.0)).x, f.x),
                  mix(hash33(i + vec3(0.0,1.0,1.0)).x, hash33(i + vec3(1.0,1.0,1.0)).x, f.x), f.y), 
              f.z
          );
      }

      // Fractal Brownian Motion
      float fbm(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i = 0; i < 5; i++) {
              f += amp * noise(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      // Cellular (Worley) F1/F2
      vec2 cellular(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          float d1 = 2.0, d2 = 2.0;
          for(int k = -1; k <= 1; k++) {
              for(int j = -1; j <= 1; j++) {
                  for(int x = -1; x <= 1; x++) {
                      vec3 g = vec3(float(x), float(j), float(k));
                      vec3 o = hash33(i + g);
                      vec3 r = g - f + o;
                      float d = dot(r, r);
                      if(d < d1) { d2 = d1; d1 = d; }
                      else if(d < d2) { d2 = d; }
                  }
              }
          }
          return vec2(sqrt(d1), sqrt(d2));
      }

      void main() {
          vec2 uv = vUv;
          
          // --- TIME SCALES ---
          // 1. Slow global drift (Geological/Mycelial growth)
          float t_slow = u_time * 0.04;
          // 2. Medium structural motion (Membrane shifting)
          float t_med  = u_time * 0.15;
          // 3. Fast detail shimmer (Interference, bitrot, scanning)
          float t_fast = u_time * 2.5;
          
          // --- DOMAIN WARP (Slow) ---
          vec3 p = vec3(uv * 5.0, t_slow);
          vec3 warp = vec3(
              fbm(p + vec3(1.2, 3.4, 5.6)),
              fbm(p + vec3(7.8, 9.0, 1.2)),
              fbm(p + vec3(3.4, 5.6, 7.8))
          ) * 2.0 - 1.0;
          
          // Aggressive warp for "psychedelic deep warp"
          vec3 p_warped = p + warp * 2.0; 
          
          // --- CRYSTALLINE / CELLULAR STRUCTURE (Medium) ---
          vec2 c = cellular(p_warped + vec3(0.0, 0.0, t_med));
          float edge = c.y - c.x; // F2 - F1 yields crack/vein network
          
          // --- FAST DETAIL: Fibers, Scanlines, Glitch (Fast) ---
          // Anisotropic fibrous striations aligned with the warp gradient
          float angle = warp.x * 6.28318;
          vec2 dir = vec2(cos(angle), sin(angle));
          float fiber = sin(dot(uv * 250.0, dir) + t_fast) * 0.5 + 0.5;
          
          // CRT scanline moire
          float scanline = sin(uv.y * 900.0 - t_fast * 2.0) * 0.5 + 0.5;
          
          // Bitrot lace / digital corruption
          float bitrot = step(0.96, hash33(vec3(floor(uv * 200.0), floor(t_fast * 6.0))).x);
          
          // --- PALETTE ---
          vec3 col_void = vec3(0.03, 0.01, 0.05);
          vec3 col_cyan = vec3(0.00, 1.00, 0.85);
          vec3 col_mag  = vec3(1.00, 0.00, 0.65);
          vec3 col_yel  = vec3(0.95, 1.00, 0.00);
          
          // --- STRUCTURAL MASKS ---
          float vein = smoothstep(0.12, 0.0, edge); 
          float membrane = smoothstep(0.0, 0.25, edge) * smoothstep(0.5, 0.25, edge);
          float interior = smoothstep(0.3, 0.8, edge);
          
          // --- THIN-FILM INTERFERENCE (Iridescence on the membrane) ---
          float opd = edge * 5.0 + fiber * 0.25;
          vec3 interference = 0.5 + 0.5 * cos(6.28318 * (opd * vec3(1.0, 1.2, 1.4) + vec3(0.0, 0.33, 0.67)));
          
          // --- COMPOSITING ---
          vec3 tex_col = col_void;
          
          // 1. Base Veins (Magenta + Gabor-like fibers)
          tex_col = mix(tex_col, col_mag * (0.3 + 0.7 * fiber), vein);
          
          // 2. Membrane (Cyan Structural Color Interference)
          tex_col = mix(tex_col, col_cyan * interference, membrane);
          
          // 3. Interior Toxic Pockets (Yellow + Scanline CRT effect)
          float yellow_mask = smoothstep(0.4, 0.8, fbm(p_warped * 3.0)) * interior;
          tex_col = mix(tex_col, col_yel * scanline, yellow_mask);
          
          // 4. Divine Data Corruption (Glitch / Bitrot puncturing the structure)
          tex_col += col_cyan * bitrot * vein;
          tex_col += col_mag * bitrot * yellow_mask;
          
          // 5. Micro-grain (Physical substance feel)
          float grain = hash33(vec3(uv * 3000.0, t_fast)).x * 0.06;
          tex_col += grain;
          
          // 6. Deep Void Vignette
          float vig = length(uv - 0.5) * 2.0;
          tex_col *= 1.0 - smoothstep(0.5, 1.3, vig);
          
          // High contrast punch
          tex_col = pow(max(tex_col, 0.0), vec3(0.85));
          
          fragColor = vec4(tex_col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 }
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;
  
  if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}