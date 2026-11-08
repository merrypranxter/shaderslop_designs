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
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      // ─── NEON CMY COLOR MAP ──────────────────────────────────────────────────
      vec3 neon(float t) {
          t = fract(t);
          vec3 c = vec3(0.0, 1.0, 1.0); // Cyan
          vec3 m = vec3(1.0, 0.0, 1.0); // Magenta
          vec3 y = vec3(1.0, 1.0, 0.0); // Yellow
          if(t < 0.333) return mix(c, m, t * 3.0);
          if(t < 0.666) return mix(m, y, (t - 0.333) * 3.0);
          return mix(y, c, (t - 0.666) * 3.0);
      }

      // ─── MAGNETIC DIPOLE FIELD ───────────────────────────────────────────────
      vec2 dipoleField(vec2 p, vec2 m) {
          float r2 = dot(p, p) + 0.001;
          float r = sqrt(r2);
          float mdotr = dot(m, p / r);
          // B = (3(m.r)r - m) / r^3
          return (3.0 * mdotr * (p / r) - m) / (r2 * r);
      }

      // ─── COMPLEX ARITHMETIC ──────────────────────────────────────────────────
      vec2 ccube(vec2 z) {
          return vec2(z.x*z.x*z.x - 3.0*z.x*z.y*z.y, 3.0*z.x*z.x*z.y - z.y*z.y*z.y);
      }

      void main() {
          // ─── TIME SCALES ─────────────────────────────────────────────────────
          float t_slow = u_time * 0.1;   // Global mutation drift
          float t_med  = u_time * 0.8;   // Structural magnetic rotation
          float t_fast = u_time * 4.0;   // Detail shimmer & grain

          vec2 st = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * 4.5;
          
          // ─── FERROFLUID MAGNETIC WARP ────────────────────────────────────────
          vec2 m_dir = vec2(cos(t_med), sin(t_med * 0.7));
          vec2 B_init = dipoleField(st * 0.5, m_dir);
          vec2 z = st + B_init * 0.2;

          // ─── BIOMORPH ITERATION ──────────────────────────────────────────────
          float wander = 0.0;
          float last_len = length(z);
          float iter_ratio = 1.0;
          
          // Base spirochete mutation parameter
          vec2 base_c = vec2(-0.4, 0.6) + vec2(sin(t_slow)*0.2, cos(t_slow*1.3)*0.2);

          for(int i = 0; i < 90; i++) {
              // The magnetic field dynamically perturbs the iteration parameter c
              // This couples the ferrofluid equations with the biomorph escape
              vec2 B = dipoleField(z, m_dir);
              vec2 c = base_c + B * 0.08;

              z = ccube(z) + c;
              
              float l = length(z);
              wander += abs(l - last_len);
              last_len = l;

              // Pickover's Biological Axis-Aligned Bailout
              if(abs(z.x) > 12.0 && abs(z.y) > 12.0) {
                  iter_ratio = float(i) / 90.0;
                  break;
              }
              // Safety circular bailout
              if(l > 60.0) {
                  iter_ratio = float(i) / 90.0;
                  break;
              }
          }
          wander /= 90.0;

          // ─── SHINE & MATERIAL LOGIC ──────────────────────────────────────────
          // Shine is a structure: it lives on the high-wander edges and filaments
          float edge = smoothstep(0.02, 0.15, wander) * (1.0 - smoothstep(0.4, 0.9, wander));
          
          // Base structural color from sequence mapping
          vec3 structuralColor = neon(wander * 6.0 + iter_ratio * 3.0 - t_slow);

          // Thin-film interference overlay (soap film iridescence logic)
          float film_thickness = wander * 400.0 + iter_ratio * 150.0;
          vec3 interference = 0.5 + 0.5 * cos(6.28318 * (film_thickness * vec3(1.0, 0.5, 0.25) + vec3(0.0, 0.33, 0.67)));

          // Kintsugi / Caustic fracture highlights (fast shimmer)
          float crack = pow(max(0.0, sin(wander * 200.0 - t_fast + last_len)), 30.0);
          vec3 glint = crack * vec3(0.0, 1.0, 1.0) * 1.5; // Piercing cyan sparkle

          // ─── COMPOSITING ─────────────────────────────────────────────────────
          vec3 col = structuralColor * interference * edge * 2.5;
          col += glint;

          // Void Black Ferrofluid Body
          float body = (1.0 - edge) * (1.0 - iter_ratio);
          vec3 void_black = vec3(0.0, 0.0, 0.0);
          // Very faint magenta bleed in the deep fluid
          void_black += vec3(0.03, 0.0, 0.03) * pow(body, 4.0); 

          // Mix structure over void
          col = mix(void_black, col, clamp(edge * 3.0, 0.0, 1.0));

          // Darkfield microscopy scatter halo (ambient glow)
          float halo = smoothstep(0.7, 1.0, iter_ratio);
          col += vec3(0.1, 0.0, 0.15) * halo * 0.8;

          // ─── PHYSICAL GRAIN / SHOT NOISE ─────────────────────────────────────
          float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + t_fast) * 43758.5453);
          col *= 0.88 + 0.12 * grain;

          fragColor = vec4(col, 1.0);
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
  console.error("WebGL/Three.js Initialization Failed:", e);
}