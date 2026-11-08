try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      // --------------------------------------------------------
      // CORE MATH & NOISE (THE WET ENGINE)
      // --------------------------------------------------------
      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // 5-octave FBM for the living fabric domain warp
      float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 r = rot(0.53);
          for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p = r * p * 2.0;
              a *= 0.5;
          }
          return v;
      }

      // --------------------------------------------------------
      // MOIRE / HALFTONE DOT FUNCTION
      // --------------------------------------------------------
      // Creates an anisotropic, thresholded dot that locks to the wave crest
      float halftoneDot(vec2 uv, float radius, vec2 orientation) {
          vec2 st = fract(uv) - 0.5;
          // Anisotropic stretch (pleochroic material feel)
          st = mat2(orientation.x, -orientation.y, orientation.y, orientation.x) * st;
          st.x *= 1.2; 
          float dist = length(st);
          // Sharp thresholding for "print error" glitch aesthetic
          return smoothstep(radius, radius - 0.08, dist);
      }

      void main() {
          // Normalize and correct aspect ratio
          vec2 uv = vUv - 0.5;
          uv.x *= u_resolution.x / u_resolution.y;
          uv *= 4.0; // Scale canvas

          // --------------------------------------------------------
          // 1. FBM DOMAIN WARP (Tearing the fabric)
          // --------------------------------------------------------
          vec2 warp = vec2(
              fbm(uv + u_time * 0.1),
              fbm(uv + vec2(5.2, 1.3) - u_time * 0.07)
          );
          // Apply aggressive warp to create folds and topological contours
          vec2 uv_w = uv + warp * 1.8;

          // --------------------------------------------------------
          // 2. THREE INDEPENDENT TIME SPEEDS
          // --------------------------------------------------------
          float t1 = u_time * 0.8;
          float t2 = u_time * 1.3;
          float t3 = u_time * 0.45;

          // --------------------------------------------------------
          // 3. DIAGONAL SINE HARMONICS (3 LAYERS)
          // --------------------------------------------------------
          // Directional vectors for the anisotropic fields
          vec2 d1 = normalize(vec2(1.0, 1.2));
          vec2 d2 = normalize(vec2(1.0, -0.6));
          vec2 d3 = normalize(vec2(0.4, 1.5));

          // Generate harmonic waves (Moire sinusoidal interference)
          float h1 = sin(dot(uv_w, d1) * 6.0 + t1);
          float h2 = sin(dot(uv_w, d2) * 9.0 + t2);
          float h3 = sin(dot(uv_w, d3) * 13.0 + t3);

          // Normalize waves to 0.0 - 1.0 range (the "crests")
          h1 = h1 * 0.5 + 0.5;
          h2 = h2 * 0.5 + 0.5;
          h3 = h3 * 0.5 + 0.5;

          // --------------------------------------------------------
          // 4. THRESHOLDED DOT GRID PHASE-LOCKED TO CRESTS
          // --------------------------------------------------------
          // Grid density
          float gridScale = 18.0;
          
          // Phase offsets to create CMYK/Chromatic Moire separation
          vec2 uv_r = uv_w * gridScale + vec2(0.01, 0.0);
          vec2 uv_g = uv_w * gridScale + vec2(0.0, 0.01);
          vec2 uv_b = uv_w * gridScale - vec2(0.01, 0.01);

          // Dot size modulated by harmonic crests (non-linear curve for punchiness)
          float r1 = pow(h1, 1.6) * 0.65;
          float r2 = pow(h2, 1.6) * 0.65;
          float r3 = pow(h3, 1.6) * 0.65;

          // Generate the dots
          float dot_cyan = halftoneDot(uv_r, r1, d1);
          float dot_pink = halftoneDot(uv_g, r2, d2);
          float dot_violet = halftoneDot(uv_b, r3, d3);

          // --------------------------------------------------------
          // 5. PALETTE & COMPOSITION (The Neon Rule + Void Rule)
          // --------------------------------------------------------
          vec3 colCyan   = vec3(0.0, 1.0, 0.9);
          vec3 colPink   = vec3(1.0, 0.1, 0.6);
          vec3 colViolet = vec3(0.6, 0.0, 1.0);

          // Additive mixing of the dot grids
          vec3 color = vec3(0.0);
          color += colCyan * dot_cyan;
          color += colPink * dot_pink;
          color += colViolet * dot_violet;

          // --------------------------------------------------------
          // 6. MOIRE INTERFERENCE HIGHLIGHTS (The Phantom Secret)
          // --------------------------------------------------------
          // Where all three crests align, create a blinding white intersection
          float intersection = h1 * h2 * h3;
          float flash = smoothstep(0.4, 0.8, intersection);
          color += vec3(1.0) * flash * (dot_cyan * dot_pink * dot_violet);

          // Darken the valleys to enforce the void
          float voidMask = max(max(dot_cyan, dot_pink), dot_violet);
          color *= voidMask;

          // Final contrast push (film-like curve)
          color = pow(color, vec3(0.85));

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

} catch (err) {
  console.error("WebGL setup failed:", err);
}