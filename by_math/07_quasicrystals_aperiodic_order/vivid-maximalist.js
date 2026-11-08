try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    
    // Orthographic camera for full-screen shader quad
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

      // Mathematical constants from Quasicrystals repo
      const float PHI = 1.618033988749895;
      const float SILVER = 2.414213562373095;

      // --------------------------------------------------------
      // NOISE FIELDS DNA
      // --------------------------------------------------------
      vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453123);
      }

      // Worley F2-F1 (Cellular Leather / Crystal Facets)
      float worley(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 8.0, d2 = 8.0;
          for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                  vec2 g = vec2(float(i), float(j));
                  vec2 o = hash22(n + g);
                  // Animate the cell nuclei
                  o = 0.5 + 0.5 * sin(u_time * 0.8 + 6.2831 * o);
                  vec2 r = g + o - f;
                  float d = dot(r, r);
                  if (d < d1) { d2 = d1; d1 = d; } 
                  else if (d < d2) { d2 = d; }
              }
          }
          return sqrt(d2) - sqrt(d1);
      }

      // --------------------------------------------------------
      // QUASICRYSTALS DNA
      // --------------------------------------------------------
      // Interference of 5-fold (Penrose) and 8-fold (Ammann-Beenker) waves
      float quasi_interference(vec2 p) {
          float val = 0.0;
          // 5-fold local symmetry
          for(int i = 0; i < 5; i++) {
              float t = float(i) * 3.1415926535 / 5.0;
              vec2 v = vec2(cos(t), sin(t));
              val += cos(dot(p, v) + u_time * 0.7);
          }
          // 8-fold local symmetry scaled by the Silver Ratio
          for(int i = 0; i < 4; i++) {
              float t = float(i) * 3.1415926535 / 4.0;
              vec2 v = vec2(cos(t), sin(t));
              val += cos(dot(p * SILVER, v) - u_time * 0.9) * 0.618;
          }
          return val;
      }

      // Deep Iterative Domain Warp
      vec2 warp(vec2 p) {
          float w1 = quasi_interference(p * 0.4);
          float w2 = quasi_interference(p * 0.4 + vec2(13.3, 7.1));
          return p + vec2(w1, w2) * 0.7;
      }

      // --------------------------------------------------------
      // COLOR FIELDS DNA
      // --------------------------------------------------------
      // Oklab to Linear RGB to sRGB for perceptually perfect, high-gamut colors
      vec3 oklab2linear(vec3 c) {
          float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
          float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
          float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
          float l = l_ * l_ * l_;
          float m = m_ * m_ * m_;
          float s = s_ * s_ * s_;
          return vec3(
               4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
              -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
              -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
          );
      }

      vec3 linear2srgb(vec3 c) {
          vec3 c1 = c * 12.92;
          vec3 c2 = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
          return mix(c1, c2, step(0.0031308, c));
      }

      void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          // Base coordinate scale
          vec2 p = uv * 3.5;
          
          // Recursive Domain Warping
          p = warp(p);
          p = warp(p * PHI) / PHI;
          
          // Structural details
          float edge = worley(p * SILVER * 1.5);
          float q = quasi_interference(p * 2.0);
          
          // --------------------------------------------------------
          // MAXIMALIST NO-BLACK OKLAB COLOR MAPPING
          // --------------------------------------------------------
          // CRITICAL: Lightness (L) is bounded heavily between 0.7 and 0.95.
          // This entirely prevents black or muddy colors, guaranteeing vibrant maximalism.
          float L = 0.825 + 0.125 * sin(edge * 12.0 + q);
          
          // Chroma (a, b): Driven by the quasicrystal interference and cellular edges.
          // High amplitudes (0.28) push colors to the edge of the gamut (Neon Acid).
          float a = 0.28 * cos(q * 1.8 + u_time * 1.2);
          float b = 0.28 * sin(edge * 6.0 - u_time * 1.5 + q);
          
          vec3 lab = vec3(L, a, b);
          vec3 rgb = linear2srgb(oklab2linear(lab));
          
          // Iridescent sharp edge highlights (Toxic Growth / Crystal Lattice)
          float iridescent = smoothstep(0.15, 0.0, edge);
          vec3 highlight = vec3(
              0.5 + 0.5 * sin(u_time * 2.0 + p.x),
              0.5 + 0.5 * cos(u_time * 2.3 + p.y),
              0.5 + 0.5 * sin(u_time * 1.7 - q)
          );
          
          rgb += iridescent * highlight * 0.6;
          
          fragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
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

  if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material?.uniforms?.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Feral Quasicrystal Initialization Failed:", e);
}