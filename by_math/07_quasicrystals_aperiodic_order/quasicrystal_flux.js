try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

      #define PI 3.14159265359
      #define N_WAVES 7.0

      // [Kiyoshi-Absorber: Noneuclidean]
      // Complex division and multiplication for Möbius transformation
      vec2 cdiv(vec2 a, vec2 b) {
          float d = dot(b, b);
          return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d;
      }
      vec2 cmul(vec2 a, vec2 b) {
          return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
      }
      vec2 mobius(vec2 z, vec2 a) {
          // T(z) = (z - a) / (1 - conj(a)*z) -> maps a to origin, preserves unit disk
          return cdiv(z - a, vec2(1.0, 0.0) - cmul(vec2(a.x, -a.y), z));
      }

      // [Entropy Mutator: Noise]
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
          // Normalize and aspect-correct UVs to [-1, 1]
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;

          // --- 15-SECOND PHENOMENOLOGICAL CYCLE ---
          // sin(t * 2PI / 15) -> full cycle every 15 seconds
          float cycle = sin(u_time * PI * 2.0 / 15.0);
          
          // smoothstep creates a non-linear hold at the extremes (Order vs Chaos)
          float dissolve = smoothstep(-0.4, 0.4, cycle);

          // --- DOMAIN WARPING (Hyperbolic / Möbius) ---
          // The center of the Möbius transform drifts smoothly in Order, jitters in Chaos
          vec2 m_center = vec2(
              sin(u_time * 0.2) * 0.5,
              cos(u_time * 0.31) * 0.5
          );
          
          // Inject "Semantic Rot" (noise jitter) as dissolution increases
          m_center += dissolve * 0.1 * vec2(noise(uv * 10.0 + u_time), noise(uv * 11.0 - u_time));
          vec2 z = mobius(uv, m_center);

          // --- DAMAGE AESTHETICS (State 2) ---
          vec2 p = z;
          if (dissolve > 0.0) {
              // Compression Hell: Macroblocking
              float block_size = mix(50.0, 15.0, dissolve);
              vec2 p_block = floor(z * block_size) / block_size;
              
              // Broadcast Signal Failure: Horizontal tracking tear
              float tear_mask = step(0.92, hash(vec2(floor(z.y * 20.0), floor(u_time * 8.0))));
              float tear_offset = tear_mask * sin(u_time * 40.0) * 0.15;

              // Spatial corruption map (only apply glitch in patches)
              float corruption = smoothstep(0.3, 0.7, noise(z * 3.0 + u_time));
              
              // Fracture the coordinate space
              p = mix(z, p_block, dissolve * corruption);
              p.x += tear_offset * dissolve;
          }

          // --- QUASICRYSTAL MATHEMATICS (Aperiodic 7-fold projection) ---
          vec3 q_val = vec3(0.0);
          // Scale increases during chaos to maximize maximalist density
          float scale = mix(10.0, 35.0, dissolve); 

          for(float i = 0.0; i < N_WAVES; i++) {
              // Incommensurate angles for 7-fold symmetry
              float theta = i * PI / N_WAVES;
              
              // Phase Desync: slightly perturb angles during structural dissolution
              theta += dissolve * 0.08 * noise(p * 8.0 + i);

              vec2 k = vec2(cos(theta), sin(theta));
              
              // Time-driven phase shift for breathing interference
              float phase = u_time * 0.4 + i * 1.61803398875; // Golden ratio offset

              // Cut-and-project plane wave
              float w = cos(dot(k, p) * scale + phase);

              // Automorphic Iridescence: Assign a structural color to each wave direction
              vec3 col_vec = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + theta * 2.0);
              q_val += col_vec * w;
          }

          // --- PHENOMENOLOGICAL STATE MAPPING ---

          // STATE 1: Crystalline Order (Full Spectrum)
          // Smooth interference contours with high symmetry
          vec3 col_order = 0.5 + 0.5 * sin(q_val * 1.2 - u_time * 0.5);
          col_order = pow(col_order, vec3(1.5)); // Contrast compression
          
          // Add crystalline caustic armor (sharp highlights)
          float caustic = smoothstep(0.85, 1.0, sin(length(q_val) * 2.5));
          col_order += caustic * vec3(0.9, 0.95, 1.0);

          // STATE 2: Structural Dissolution (Palette Collapse)
          // Average the quasicrystal vector to a scalar
          float q_mono = (q_val.x + q_val.y + q_val.z) / 3.0;
          
          // Bit-crushed V-buffers: Quantize the continuous wave field
          float q_quant = floor(q_mono * 5.0) / 5.0;

          // Collapse to Void Black, Neon Cyan, Neon Magenta
          vec3 col_chaos = vec3(0.02, 0.01, 0.02); // Void black base
          
          // Strict thresholding for neon bands
          float band1 = step(0.65, fract(q_quant * 2.3 + u_time * 0.1));
          float band2 = step(0.85, fract(q_quant * 3.7 - u_time * 0.2));

          col_chaos = mix(col_chaos, vec3(0.0, 1.0, 0.9), band1); // Neon Cyan
          col_chaos = mix(col_chaos, vec3(1.0, 0.0, 0.8), band2 * (1.0 - band1)); // Neon Magenta

          // Chroma Bleed / Analog Signal Contamination
          float bleed = noise(p * 25.0 - u_time * 3.0) * dissolve * 0.15;
          col_chaos.r += bleed;
          col_chaos.b -= bleed;

          // --- FINAL ALCHEMICAL COMPOSITING ---
          // Interpolate between the two phenomenological states
          vec3 final_col = mix(col_order, col_chaos, dissolve);

          // Abyssal Rendering: Void mask / Accretion field
          // Darkens the edges, creating a floating, contained mathematical entity
          float void_mask = smoothstep(1.8, 0.3, length(uv) + dissolve * noise(uv * 4.0));
          final_col *= void_mask;

          // Glitch Prophet: Occasional full-screen brightness flashes during peak chaos
          float flash = step(0.98, hash(vec2(u_time, 0.0))) * dissolve;
          final_col += vec3(flash * 0.2);

          fragColor = vec4(final_col, 1.0);
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

} catch (e) {
  console.error("The Feral Code Brain encountered a fatal WebGL anomaly:", e);
}