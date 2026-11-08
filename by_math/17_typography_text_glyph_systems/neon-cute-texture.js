try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
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
      in vec2 vUv;
      out vec4 fragColor;
      uniform float u_time;
      uniform vec2 u_resolution;

      // --- Alchemical Math: Hashes & Noise ---
      vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                         dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                     mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                         dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i = 0; i < 6; i++) {
              f += amp * noise(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      // --- Typographic Physics: SDF Primitives ---
      float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
          vec2 pa = p - a, ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h) - r;
      }

      // Morphogenesis smooth min (Fungal growth / Metaballs)
      float smin(float a, float b, float k) {
          float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
          return mix(b, a, h) - k * h * (1.0 - h);
      }

      // --- Cute Bubble Glyphs ---
      float sdU(vec2 p) {
          float r = 0.08;
          float d = sdCapsule(p, vec2(-0.1, 0.15), vec2(-0.1, -0.05), r);
          d = smin(d, sdCapsule(p, vec2(0.1, 0.15), vec2(0.1, -0.05), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.1, -0.05), vec2(0.1, -0.05), r), 0.05);
          return d;
      }

      float sdR(vec2 p) {
          float r = 0.08;
          float d = sdCapsule(p, vec2(-0.1, -0.15), vec2(-0.1, 0.15), r);
          d = smin(d, sdCapsule(p, vec2(-0.1, 0.15), vec2(0.1, 0.15), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(0.1, 0.15), vec2(0.1, 0.0), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.1, 0.0), vec2(0.1, 0.0), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.05, 0.0), vec2(0.1, -0.15), r), 0.05);
          return d;
      }

      float sdC(vec2 p) {
          float r = 0.08;
          float d = sdCapsule(p, vec2(0.1, 0.15), vec2(-0.1, 0.15), r);
          d = smin(d, sdCapsule(p, vec2(-0.1, 0.15), vec2(-0.1, -0.15), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.1, -0.15), vec2(0.1, -0.15), r), 0.05);
          return d;
      }

      float sdT(vec2 p) {
          float r = 0.08;
          float d = sdCapsule(p, vec2(-0.15, 0.15), vec2(0.15, 0.15), r);
          d = smin(d, sdCapsule(p, vec2(0.0, 0.15), vec2(0.0, -0.15), r), 0.05);
          return d;
      }

      float sdE(vec2 p) {
          float r = 0.08;
          float d = sdCapsule(p, vec2(-0.1, -0.15), vec2(-0.1, 0.15), r);
          d = smin(d, sdCapsule(p, vec2(-0.1, 0.15), vec2(0.1, 0.15), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.1, 0.0), vec2(0.05, 0.0), r), 0.05);
          d = smin(d, sdCapsule(p, vec2(-0.1, -0.15), vec2(0.1, -0.15), r), 0.05);
          return d;
      }

      // Semantic Field: Words as Gravity Wells
      float sceneText(vec2 uv, float t) {
          float d = 100.0;
          float s = 3.5; 
          float b = 0.08; 

          // Biological jiggle
          #define JIG(id) vec2(sin(t * 2.1 + float(id)) * 0.015, cos(t * 1.7 + float(id)) * 0.015)

          vec2 pU1 = uv - vec2(-0.18, 0.25) + JIG(0.0); d = smin(d, sdU(pU1 * s) / s, b);
          vec2 pR  = uv - vec2( 0.18, 0.25) + JIG(1.0); d = smin(d, sdR(pR * s) / s, b);
          
          vec2 pC  = uv - vec2(-0.42, -0.2) + JIG(2.0); d = smin(d, sdC(pC * s) / s, b);
          vec2 pU2 = uv - vec2(-0.14, -0.2) + JIG(3.0); d = smin(d, sdU(pU2 * s) / s, b);
          vec2 pT  = uv - vec2( 0.14, -0.2) + JIG(4.0); d = smin(d, sdT(pT * s) / s, b);
          vec2 pE  = uv - vec2( 0.42, -0.2) + JIG(5.0); d = smin(d, sdE(pE * s) / s, b);

          return d;
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          float t = u_time;

          // 1. Text Field Evaluation (Kinetic Typography)
          float d_text = sceneText(uv, t);
          vec2 eps = vec2(0.002, 0.0);
          vec2 grad_text = normalize(vec2(
              sceneText(uv + eps.xy, t) - sceneText(uv - eps.xy, t),
              sceneText(uv + eps.yx, t) - sceneText(uv - eps.yx, t)
          ));

          // 2. Spatial Warping (Text gravity pulls the fluid)
          vec2 fluid_uv = uv + grad_text * 0.05 * exp(-abs(d_text) * 12.0);

          // 3. Three-Tiered Time Scales & Procedural Material
          
          // Scale A: Slow Global Drift
          vec2 drift = vec2(t * 0.02, -t * 0.015);
          
          // Scale B: Medium Structural Motion (Ferrofluid/BZ Domain Warp)
          vec2 w = vec2(
              fbm(fluid_uv * 3.0 + drift),
              fbm(fluid_uv * 3.0 + vec2(4.3, 1.7) - drift)
          );
          float structure = fbm(fluid_uv * 2.5 + w * 2.5);

          // Compute surface normals for physical substance
          float s_eps = 0.005;
          float s_dx = fbm((fluid_uv + vec2(s_eps, 0.0)) * 2.5 + w * 2.5) - structure;
          float s_dy = fbm((fluid_uv + vec2(0.0, s_eps)) * 2.5 + w * 2.5) - structure;
          vec3 fluid_normal = normalize(vec3(s_dx, s_dy, 0.03));

          // Scale C: Fast Detail Shimmer (Thin-Film Bragg Interference)
          float phase = structure * 30.0 - t * 3.0;
          float shimmer = sin(phase) + sin(structure * 150.0 - t * 12.0) * 0.15;
          
          // Lighting Model
          vec3 light_dir = normalize(vec3(1.0, 1.0, 1.5));
          float spec = pow(max(dot(reflect(-light_dir, fluid_normal), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);
          float diffuse = max(dot(fluid_normal, light_dir), 0.0);

          // 4. Color Alchemy (Void Black + Neon CMY)
          vec3 fluid_col = vec3(0.01, 0.005, 0.015); // Deep Void
          
          // Isolate interference fringes into sharp neon bands
          float c_cyan = smoothstep(0.85, 0.95, sin(phase)) - smoothstep(0.95, 1.0, sin(phase));
          float c_mag  = smoothstep(0.85, 0.95, sin(phase + 2.094)) - smoothstep(0.95, 1.0, sin(phase + 2.094));
          float c_yel  = smoothstep(0.85, 0.95, sin(phase + 4.188)) - smoothstep(0.95, 1.0, sin(phase + 4.188));

          fluid_col += vec3(0.0, 1.0, 1.0) * c_cyan * 2.5;
          fluid_col += vec3(1.0, 0.0, 1.0) * c_mag * 2.5;
          fluid_col += vec3(1.0, 1.0, 0.0) * c_yel * 2.5;

          // Apply physical lighting
          fluid_col *= (0.4 + 0.6 * diffuse);
          fluid_col += spec * vec3(1.0, 0.9, 1.0); // Iridescent specular

          // 5. Psychedelic Pop Typography Overlay
          float text_interior = smoothstep(0.0, -0.01, d_text);
          float text_border = smoothstep(0.015, 0.0, abs(d_text));
          float text_glow = exp(-abs(d_text) * 20.0);

          // Shifting neon text aura
          vec3 text_grad = 0.5 + 0.5 * cos(t * 2.5 + uv.xyx * 4.0 + vec3(0.0, 2.0, 4.0));

          vec3 final_col = fluid_col;
          
          // Text consumes the fluid inside (void space)
          final_col = mix(final_col, vec3(0.0, 0.0, 0.02), text_interior * 0.9);
          
          // Glowing border radiation
          final_col += text_grad * text_glow * 1.2;
          final_col = mix(final_col, vec3(1.0), text_border);

          // Optical Vignette
          float vig = 1.0 - smoothstep(0.4, 1.2, length(uv));
          final_col *= vig;

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
  
  if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material?.uniforms?.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("The Weird Code Guy encountered a topological collapse:", e);
}