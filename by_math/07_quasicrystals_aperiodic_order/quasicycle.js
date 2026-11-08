try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
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
      #define PHI 1.61803398875
      #define SILVER 2.41421356237

      // Chaos / Hash functions
      float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yzx+33.33);
        return fract((p3.xx+p3.yz)*p3.zy);
      }

      // Quasicrystal projection (5-fold Penrose basis)
      float qc5(vec2 p, float t) {
        float sum = 0.0;
        for(int i = 0; i < 5; i++) {
          float theta = float(i) * PI / 5.0;
          vec2 dir = vec2(cos(theta), sin(theta));
          sum += cos(dot(p, dir) + t);
        }
        return sum;
      }

      // Quasicrystal projection (8-fold Ammann-Beenker basis)
      float qc8(vec2 p, float t) {
        float sum = 0.0;
        for(int i = 0; i < 8; i++) {
          float theta = float(i) * PI / 8.0;
          vec2 dir = vec2(cos(theta), sin(theta));
          sum += cos(dot(p, dir) + t);
        }
        return sum;
      }

      // Non-Euclidean projection (Hyperbolic Poincare-ish fold)
      vec2 hyperFold(vec2 p) {
        float r2 = dot(p, p);
        return p / (1.0 + r2 * 0.1);
      }

      void main() {
        // Normalize coordinates
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // 12-second slow oscillation cycle: 0.0 (Order) to 1.0 (Dissolution)
        float cycle = (u_time * PI * 2.0) / 12.0;
        float state = smoothstep(0.2, 0.8, sin(cycle) * 0.5 + 0.5);

        // --- COORDINATE WARPING ---
        // Base Hyperbolic Space
        vec2 p = hyperFold(uv) * 12.0;
        
        // Glitch / Fracture Space (Data Rot)
        vec2 quant_grid = floor(p * 4.0) / 4.0;
        vec2 block_hash = hash22(quant_grid + floor(u_time * 4.0));
        vec2 fractured_p = p + (block_hash - 0.5) * 2.0 * step(0.6, block_hash.x);
        
        // Interpolate structural integrity
        vec2 final_p = mix(p, fractured_p, state);

        // --- MULTIPLEXED MOIRE FIELDS (RGB Phase Bleed) ---
        // We calculate the interference field 3 times with slight chromatic offsets
        vec3 field;
        float aberration = 0.15 * state; // Chromatic split grows with dissolution
        
        for(int i = 0; i < 3; i++) {
            vec2 offset = vec2(float(i) - 1.0) * aberration;
            vec2 cp = final_p + offset;
            
            // Multiplicative Moiré: 5-fold (Golden) * 8-fold (Silver)
            float f5 = qc5(cp, u_time);
            float f8 = qc8(cp * PHI, -u_time * SILVER * 0.2);
            
            // Scale and combine
            float interference = (f5 * 0.2) * (f8 * 0.125);
            
            // Add recursive signal cannibalism (feedback-like distortion)
            interference += sin(interference * 8.0 - u_time * 2.0) * 0.2;
            
            if(i == 0) field.r = interference;
            if(i == 1) field.g = interference;
            if(i == 2) field.b = interference;
        }

        // --- AESTHETIC STATE 0: CRYSTALLINE ORDER ---
        // Smooth, iridescent, full spectrum
        vec3 col_order = 0.5 + 0.5 * cos(field.g * 10.0 + vec3(0.0, 2.0, 4.0) + u_time * 0.5);
        col_order = smoothstep(0.1, 0.9, col_order); // Push contrast
        
        // --- AESTHETIC STATE 1: STRUCTURAL DISSOLUTION ---
        // Palette collapse: Void Black, Neon Magenta, Neon Cyan
        vec3 col_chaos = vec3(0.02, 0.0, 0.05); // Void black base
        
        // Quantize the field for hard geometric banding
        vec3 q_field = floor(field * 5.0) / 5.0;
        
        // Map fractured field to restricted neon palette
        float glitch_mask = hash12(floor(vUv * 100.0) + u_time);
        if (q_field.r > 0.1) col_chaos = mix(vec3(1.0, 0.0, 0.4), vec3(0.0, 1.0, 0.8), step(0.5, q_field.b));
        if (q_field.g < -0.1) col_chaos = mix(col_chaos, vec3(1.0, 0.9, 0.0), step(0.9, glitch_mask) * state); // Rare yellow sparks

        // Bit-crushed shadows
        col_chaos *= step(0.0, field.r * field.b + 0.05);

        // --- SYNTHESIS ---
        vec3 final_color = mix(col_order, col_chaos, state);

        // Analog Decay: CRT flicker & scanlines bridging the states
        float scanline = sin(vUv.y * u_resolution.y * 0.5) * 0.04 * state;
        final_color -= scanline;
        
        // Vignette
        float vig = 1.0 - smoothstep(0.5, 1.5, length(uv));
        final_color *= vig;

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
  console.error("Feral Quasicrystal Engine Failure:", e);
}