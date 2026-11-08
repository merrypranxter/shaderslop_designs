try {
  if (!canvas.__three) {
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

    // THE STRANGE MECHANISM: Thermal Bloom Moiré on an Aperiodic Manifold
    // Combines Quasicrystal projection math (5/8/12 fold), Moiré frequency interference,
    // and a strict Retrofuturist "Raygun Gothic" palette (no black/white, maximal color).
    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      #define PHI 1.618033988749895
      #define SILVER 2.414213562373095

      // 2D Rotation Matrix
      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      // Aperiodic Grid Projection (Quasicrystal Math)
      // Projects N-fold symmetrical waves across the plane, modulated by irrational ratios
      float quasicrystal(vec2 p, float folds, float scale, float phase) {
          float sum = 0.0;
          for (float i = 0.0; i < folds; i++) {
              float theta = i * 3.14159265359 / folds;
              vec2 dir = vec2(cos(theta), sin(theta));
              float proj = dot(p, dir) * scale;
              // Moiré self-interference: fundamental wave beating against its Phi-scaled harmonic
              sum += sin(proj + phase) * cos(proj * PHI - phase * SILVER);
          }
          return sum / folds;
      }

      // Strict Retrofuturist Palette (Raygun Gothic)
      // Guaranteed no black, no white. Only vibrant maximalist color.
      vec3 retroPalette(float t) {
          t = fract(t);
          
          vec3 navy   = vec3(0.114, 0.208, 0.341); // #1D3557
          vec3 blue   = vec3(0.341, 0.459, 0.565); // #577590
          vec3 red    = vec3(0.976, 0.255, 0.267); // #F94144
          vec3 orange = vec3(0.953, 0.447, 0.173); // #F3722C
          vec3 yellow = vec3(0.976, 0.780, 0.310); // #F9C74F

          float step = 0.2; // 1.0 / 5.0
          
          // Sharp but smooth transitions to mimic CMYK/Halftone print bleeding
          vec3 c = mix(navy, blue, smoothstep(0.0, step, t));
          c = mix(c, red, smoothstep(step, step * 2.0, t));
          c = mix(c, orange, smoothstep(step * 2.0, step * 3.0, t));
          c = mix(c, yellow, smoothstep(step * 3.0, step * 4.0, t));
          c = mix(c, navy, smoothstep(step * 4.0, 1.0, t)); // Wrap around
          
          return c;
      }

      void main() {
          // Normalize coordinates and fix aspect ratio
          vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 p = uv;
          
          float t = u_time * 0.15;

          // 1. DOMAIN WARPING (The Fluidity)
          // Use a low-frequency quasicrystal field to warp the space itself,
          // creating the "Thermal Bloom" effect.
          vec2 warp = vec2(
              quasicrystal(p + vec2(t, 0.0), 5.0, 4.0, t),
              quasicrystal(p - vec2(0.0, t), 5.0, 4.0, t * 0.8)
          );
          p += warp * 0.4;

          // 2. MULTI-LAYER CHROMATIC MOIRÉ
          // Generate intersecting aperiodic fields with slightly different scales.
          // The scale differential (45.0 vs 46.2 vs 43.8) forces optical interference (Moiré).
          
          // Layer A: 5-fold Penrose geometry
          float q1 = quasicrystal(p, 5.0, 45.0, t * 2.0);
          
          // Layer B: 8-fold Ammann-Beenker geometry, rotated by Layer A
          vec2 p2 = rot(q1 * 0.3) * p;
          float q2 = quasicrystal(p2, 8.0, 46.2, -t * 1.5);
          
          // Layer C: 12-fold Stampfli geometry, rotated by Layer B
          vec2 p3 = rot(q2 * 0.3) * p;
          float q3 = quasicrystal(p3, 12.0, 43.8, t * 2.5);

          // 3. MAXIMALIST INTERFERENCE ENGINE
          // Multiply the fields to create deep spatial beats (dark/bright fringes)
          float interference = (q1 * q2) + (q2 * q3) + (q3 * q1);
          
          // Add a high-frequency radial wave to simulate "barrier grid" moiré slicing
          interference += sin(length(p) * 120.0 - t * 20.0) * 0.15;

          // 4. COLOR MAPPING
          // Drive the palette index using the complex interference field, 
          // phase-shifted by the original warp to ensure constant color circulation.
          float color_idx = (interference * 1.5) + length(warp) + (t * 0.5);
          
          vec3 finalColor = retroPalette(color_idx);

          fragColor = vec4(finalColor, 1.0);
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
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (err) {
  console.error("Feral WebGL Engine Error:", err);
}