try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

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
      in vec2 vUv;
      uniform float u_time;
      uniform vec2 u_resolution;
      out vec4 fragColor;

      #define PI 3.14159265359

      // --- ALCHEMICAL MATH: MÖBIUS TRANSFORMS ---
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
      
      vec2 mobius(vec2 z, vec2 a) {
          return cdiv(z - a, vec2(1.0, 0.0) - cmul(vec2(a.x, -a.y), z));
      }

      // --- CRYSTALLINE ORDER: FULL SPECTRUM PALETTE ---
      vec3 palette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.0, 0.33, 0.67);
          return a + b * cos(2.0 * PI * (c * t + d));
      }

      // --- QUASICRYSTAL / INCOMMENSURATE FREQUENCIES ---
      float quasicrystal(vec2 p, float t, float chaos) {
          float v = 0.0;
          float N = 7.0; // 7-fold symmetry (Hyperbolic {7,3} resonance)
          
          // DAMAGE: Macroblocking & Compression Breakage
          vec2 p_block = floor(p * mix(100.0, 15.0, chaos)) / mix(100.0, 15.0, chaos);
          vec2 p_work = mix(p, p_block, chaos * 0.85);
          
          // DAMAGE: Tape Tearing & Sync Instability
          float tear = step(0.98, fract(sin(p_work.y * 152.3 + t) * 43758.5453));
          p_work.x += tear * chaos * 0.3 * sin(t * 20.0);
          
          float scale = mix(8.0, 24.0, chaos);
          
          for(float i = 0.0; i < 7.0; i++) {
              float theta = i * PI / N;
              vec2 dir = vec2(cos(theta), sin(theta));
              
              // Base phase drift
              float phase = t * (0.3 + i * 0.05);
              
              // FERAL LOGIC: Semantic Font Rot (Phase Corruption)
              phase += chaos * floor(sin(t * 12.0 + i * 1.618) * 3.0) * 0.5;
              
              v += cos(dot(p_work, dir) * scale + phase);
          }
          return v;
      }

      void main() {
          // Normalize & aspect correct
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          // --- CYCLE LOGIC: 12 SECONDS ---
          // 0.0 -> 0.4 : Crystalline Order
          // 0.4 -> 0.5 : Dissolution (Fade to Chaos)
          // 0.5 -> 0.9 : Structural Dissolution (Glitch/Neon)
          // 0.9 -> 1.0 : Reconstitution (Fade to Order)
          float cycle = mod(u_time, 12.0) / 12.0;
          float chaos = smoothstep(0.35, 0.45, cycle) - smoothstep(0.85, 0.95, cycle);
          
          // --- NON-EUCLIDEAN WARP ---
          // Orbiting Möbius translation target
          vec2 a = vec2(sin(u_time * 0.4), cos(u_time * 0.3)) * 0.7 * (1.0 - chaos * 0.4);
          vec2 z = mobius(uv * 1.2, a);
          
          // --- TEMPORAL MEMORY / MISREGISTRATION ---
          // Splitting time for RGB to simulate chromatic aberration & tape smear
          float t_r = u_time;
          float t_g = u_time - chaos * 0.08;
          float t_b = u_time - chaos * 0.16;
          
          float v_r = quasicrystal(z, t_r, chaos);
          float v_g = quasicrystal(z, t_g, chaos);
          float v_b = quasicrystal(z, t_b, chaos);
          
          // --- STATE A: CRYSTALLINE ORDER ---
          // Smooth, full spectrum, high symmetry
          vec3 col_order = palette(v_r * 0.08 - u_time * 0.1);
          
          // --- STATE B: STRUCTURAL DISSOLUTION ---
          // Palette collapses to neon cyan/magenta/void
          vec3 col_chaos = vec3(0.0);
          
          // Quantize the quasicrystal fields into harsh boolean intersections
          float q_r = step(0.0, sin(v_r * 2.5));
          float q_g = step(0.0, sin(v_g * 2.5));
          float q_b = step(0.0, sin(v_b * 2.5));
          
          // Construct constrained neon palette
          col_chaos.r = mix(0.02, 1.0, q_r); // Magenta/Red channel
          col_chaos.g = mix(0.0, 1.0, q_g);  // Cyan/Green channel
          col_chaos.b = mix(0.05, 0.6, q_b); // Blue undertones
          
          // Add Moiré frequency interference during chaos
          float moire = mix(1.0, step(0.5, fract(z.x * 80.0 + z.y * 80.0 + u_time * 5.0)), chaos * 0.6);
          col_chaos *= moire;
          
          // --- SYNTHESIS ---
          vec3 final_col = mix(col_order, col_chaos, chaos);
          
          // Vignette / Void falloff
          float void_fade = smoothstep(2.5, 0.5, length(z));
          final_col *= void_fade;
          
          fragColor = vec4(final_col, 1.0);
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
    if (material.uniforms.u_time) {
      material.uniforms.u_time.value = time;
    }
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}