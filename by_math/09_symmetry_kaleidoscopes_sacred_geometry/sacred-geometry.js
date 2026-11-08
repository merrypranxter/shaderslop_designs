try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;

      in vec2 vUv;
      out vec4 fragColor;

      #define PHI 1.61803398874989
      #define SQRT3 1.73205080756888

      // Biological/Fungal noise
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      
      float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= mat2(0.8, -0.6, 0.6, 0.8) * 2.0;
              a *= 0.5;
          }
          return v;
      }

      // Sacred Hex Grid (Flower of Life base)
      vec2 hexGrid(vec2 p, out vec2 id) {
          vec2 r = vec2(1.0, SQRT3);
          vec2 h = r * 0.5;
          vec2 a = mod(p, r) - h;
          vec2 b = mod(p - h, r) - h;
          if (dot(a, a) < dot(b, b)) {
              id = p - a;
              return a;
          } else {
              id = p - b;
              return b;
          }
      }

      // Structural Color: Thin Film Interference (from Repo 2)
      // 2nd cos(theta) = m * lambda
      vec3 thinFilm(float thickness, float cosTheta) {
          float n_film = 1.56; // Chitin refractive index
          float pathDiff = 2.0 * n_film * thickness * sqrt(max(0.0, 1.0 - pow(sin(acos(cosTheta))/n_film, 2.0)));
          
          // Cosine palette for structural color spectrum
          // Elevated base to ensure NO pure black background
          vec3 a = vec3(0.6, 0.5, 0.7); 
          vec3 b = vec3(0.4, 0.5, 0.4);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.0, 0.33, 0.67);
          
          return a + b * cos(6.28318 * (pathDiff / 600.0 + d));
      }

      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
          float t = u_time * 0.15;

          // Space mutation: Golden Spiral Vortex
          float r = length(uv);
          float theta = atan(uv.y, uv.x);
          float spiral = log(max(r, 0.001)) / (log(PHI) / (3.14159 / 2.0));
          uv *= rot(spiral * 0.3 - t);

          // Overclocked organic domain warping (Birefringent stress)
          vec2 warp = vec2(fbm(uv * 3.0 + t), fbm(uv * 3.0 - t + 10.0));
          vec2 p = uv * 6.0 + warp * 2.0;

          // Compute the sacred lattice
          vec2 id;
          vec2 gv = hexGrid(p, id);

          // Photoelastic stress field calculation
          float stress = fbm(id * 0.15 - t * 2.0) + r;
          
          // Distance metrics for Metatron / Flower of Life
          float d_center = length(gv);
          float hexDist = max(abs(gv.x), dot(abs(gv), normalize(vec2(1.0, SQRT3))));
          float d_edge = 0.5 - hexDist;

          // Optical thickness calculation (Iridescence engine)
          // Cells bulge at the center and edges, modulated by chaotic stress
          float thickness = 150.0 + 900.0 * stress + 400.0 * smoothstep(0.0, 0.5, d_center);
          thickness += 800.0 * fbm(uv * 12.0 + t); // High frequency interference banding

          // Fake 3D normal mapping from the 2D SDF for view-dependent color shifting
          float bump = smoothstep(0.0, 0.1, d_edge) * smoothstep(0.0, 0.2, d_center);
          vec3 N = normalize(vec3(gv.x, gv.y, bump * 1.5));
          vec3 V = vec3(0.0, 0.0, 1.0);
          float cosTheta = max(0.0, dot(N, V));

          // Base field: intense structural color, never black
          vec3 color = thinFilm(thickness, cosTheta);

          // Injecting the Sacred Geometry as pure energy accents (white/gold)
          // 1. Metatron's connecting lines (hex lattice edges)
          float lines = smoothstep(0.04, 0.01, d_edge);
          color = mix(color, vec3(1.0, 0.95, 0.8), lines * (0.6 + 0.4 * sin(t * 5.0 + id.x)));

          // 2. Seed of Life inner circles
          float circles = smoothstep(0.02, 0.0, abs(d_center - 0.28));
          color = mix(color, vec3(1.0, 1.0, 1.0), circles * 0.8);

          // 3. The bindu (center dot) of each cell
          float bindu = smoothstep(0.06, 0.0, d_center);
          color += vec3(0.2, 0.8, 1.0) * bindu;

          // 4. Global cosmic aura
          float glow = exp(-r * 1.5);
          color += vec3(0.3, 0.1, 0.4) * glow * fbm(uv * 2.0 - t);

          // Enforce minimum color saturation/brightness to avoid any dark voids
          color = max(color, vec3(0.1, 0.2, 0.3));

          fragColor = vec4(color, 1.0);
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
  console.error("Feral WebGL Initialization Failed:", e);
}