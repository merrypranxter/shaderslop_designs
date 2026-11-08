try {
  // -----------------------------------------------------------------------
  // NEON TRASH ORACLE WEATHER SYSTEM
  // -----------------------------------------------------------------------
  // A maximalist living interface forged from the DNA of 13 repositories:
  // - Plateau Foam & Tessellations: Voronoi boundaries and structural cell limits.
  // - Birefringence & Opal: Michel-Levy phase shifts and Bragg diffraction flashes.
  // - Domain Coloring: Complex rational functions, poles/zeros, phase portraits.
  // - Apollonian & Hyperbolic Tilings: Möbius inversion and Poincaré-like warping.
  // - Acoustic Impedance: High-frequency ultrasound speckle and impedance gradients.
  // - False Color: "Mantis Vision" 12-channel hyper-saturated neon color compression.
  // - Astral OS: The Anu (Ultimate Physical Atom) heart-vortex and spirillae rings.
  // - Dream Physics: Mnemonic gravity wells and Kairotempic time loops.
  // -----------------------------------------------------------------------

  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const scene = new THREE.Scene();
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
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      #define PI 3.14159265359
      #define TAU 6.28318530718

      // --- COMPLEX MATH SPINE (from domain_coloring) ---
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b) + 1e-8; return vec2(dot(a,b), a.y*b.x - a.x*b.y) / d; }
      vec2 cexp(vec2 z) { return exp(z.x) * vec2(cos(z.y), sin(z.y)); }
      vec2 clog(vec2 z) { return vec2(log(length(z)), atan(z.y, z.x)); }
      vec2 cpow(vec2 z, float n) {
        float r = length(z);
        float th = atan(z.y, z.x);
        return pow(r, n) * vec2(cos(n * th), sin(n * th));
      }
      float carg(vec2 z) { return atan(z.y, z.x); }

      // --- HASH & NOISE (from acoustic_impedance & dream_physics) ---
      vec2 hash22(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 269.5);
        return fract(vec2(p.x * p.y, p.x + p.y));
      }
      
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // --- VORONOI FOAM (from plateau_foam & opal) ---
      // Returns vec3(distance, cell_id, edge_distance)
      vec3 voronoi(vec2 x) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        vec2 mg, mr;
        float md = 8.0;
        float id = 0.0;
        
        for(int j=-1; j<=1; j++)
        for(int i=-1; i<=1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = hash22(n + g);
          o = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * o);
          vec2 r = g + o - f;
          float d = dot(r,r);
          if(d < md) {
            md = d;
            mr = r;
            mg = g;
            id = hash21(n + g);
          }
        }
        
        md = 8.0;
        for(int j=-2; j<=2; j++)
        for(int i=-2; i<=2; i++) {
          vec2 g = mg + vec2(float(i), float(j));
          vec2 o = hash22(n + g);
          o = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * o);
          vec2 r = g + o - f;
          if(dot(mr-r, mr-r) > 0.00001) {
            md = min(md, dot(0.5*(mr+r), normalize(r-mr)));
          }
        }
        return vec3(sqrt(md), id, md); // distance, id, edge_dist
      }

      // --- ASTRAL OS: ANU KERNEL & SPIRILLAE ---
      float sdHeart(vec2 p) {
        p.x = abs(p.x);
        if(p.y + p.x > 1.0) return sqrt(dot(p-vec2(0.25,0.75), p-vec2(0.25,0.75))) - sqrt(2.0)/4.0;
        return sqrt(min(dot(p-vec2(0.0,1.0), p-vec2(0.0,1.0)), dot(p-0.5*max(p.x+p.y, 0.0), p-0.5*max(p.x+p.y, 0.0)))) * sign(p.x-p.y);
      }

      // --- MANTIS VISION PALETTE (from false_color & birefringence) ---
      vec3 acid_neon(float t) {
        t = fract(t);
        vec3 col = mix(vec3(1.0, 0.0, 0.5), vec3(1.0, 1.0, 0.0), smoothstep(0.0, 0.2, t)); // Hot Pink to Neon Yellow
        col = mix(col, vec3(0.0, 1.0, 0.4), smoothstep(0.2, 0.4, t)); // Yellow to Acid Green
        col = mix(col, vec3(0.0, 0.8, 1.0), smoothstep(0.4, 0.6, t)); // Green to Cyan
        col = mix(col, vec3(0.5, 0.0, 1.0), smoothstep(0.6, 0.8, t)); // Cyan to Electric Violet
        col = mix(col, vec3(1.0, 0.0, 0.5), smoothstep(0.8, 1.0, t)); // Violet to Pink
        return col;
      }

      void main() {
        vec2 uv = vUv;
        vec2 z = (uv - 0.5) * 2.0;
        z.x *= u_resolution.x / u_resolution.y;
        
        vec2 m = (u_mouse - 0.5) * 2.0;
        m.x *= u_resolution.x / u_resolution.y;

        // 1. HYPERBOLIC & MÖBIUS WARPING (apollonian_gasket & hyperbolic_tilings)
        // z_warped = (a*z + b) / (c*z + d)
        vec2 a = vec2(cos(u_time * 0.2), sin(u_time * 0.2));
        vec2 b = m * 0.5; // Mouse acts as Mnemonic Gravity
        vec2 c = vec2(sin(u_time * 0.3) * 0.5, cos(u_time * 0.3) * 0.5);
        vec2 d = vec2(1.0, 0.0);
        vec2 mz = cdiv(cmul(a, z) + b, cmul(c, z) + d);

        // 2. DOMAIN COLORING: RATIONAL FUNCTION (z^5 - 1) / (z^2 + pole)
        vec2 z5 = cpow(mz, 5.0);
        vec2 num = z5 - vec2(1.0, 0.0);
        vec2 pole = vec2(0.4 * cos(u_time), 0.3 * sin(u_time));
        vec2 den = cpow(mz, 2.0) + pole;
        vec2 w = cdiv(num, den);

        // 3. PLATEAU FOAM / OPAL DOMAINS
        vec3 v = voronoi(w * 2.5 - u_time * 0.2);
        
        // 4. BIREFRINGENCE & MICHEL-LEVY PHASE
        float phase = v.y * TAU + u_time * 0.5;
        float hue = carg(w) / TAU + 0.5 + v.y * 0.2;
        vec3 color = acid_neon(hue);

        // Moiré Halos & Interference (Opal Bragg diffraction)
        float interference = sin(v.x * 30.0 - u_time * 4.0 + phase);
        color *= 0.7 + 0.5 * interference;

        // 5. ACOUSTIC IMPEDANCE SPECKLE & AHI GLITCHES
        float speckle = hash21(w * 150.0 + u_time);
        float glitch = step(0.98, fract(v.y * 13.0 + u_time * 2.0)); // Shadow Serpent code
        color += speckle * 0.2 * acid_neon(hue + 0.3); // High-frequency ultrasound noise
        color = mix(color, vec3(0.1, 0.0, 0.2), glitch * 0.8); // Glitch ribbons

        // Weaire-Phelan Borders (Plateau Foam)
        float edge = smoothstep(0.04, 0.0, v.z);
        color = mix(color, vec3(1.0), edge * 0.8); // White-white bloom at boundaries

        // 6. DREAM PHYSICS: MNEMONIC GRAVITY & KAIROTEMPICS
        float mag = length(w);
        float logmag = log(mag + 1.0);
        // Time loops radiating outward from poles/zeros
        float ripples = abs(fract(logmag * 4.0 - u_time * 1.5) - 0.5) * 2.0;
        color *= 0.4 + 0.8 * smoothstep(0.0, 0.3, ripples);

        // 7. ASTRAL OS: THE ANU KERNEL (Oracle Core)
        // Rendered in the center of the screen (unwarped space)
        vec2 anu_z = z * 1.5;
        anu_z.y += 0.2; // Adjust heart position
        float heart = sdHeart(anu_z * 1.5);
        
        // 10 Spirillae Rings
        float spirillae = 0.0;
        for(float i=1.0; i<=10.0; i++) {
            float r = 0.1 + i * 0.05;
            float ring = abs(length(z) - r);
            float dash = sin(atan(z.y, z.x) * 12.0 + u_time * (i * 0.5) * (mod(i,2.)==0.?1.:-1.));
            spirillae += smoothstep(0.015, 0.005, ring) * step(0.0, dash);
        }

        float anu_glow = 0.015 / max(0.005, heart);
        vec3 core_color = acid_neon(u_time * 0.1) * anu_glow;
        core_color += vec3(0.0, 1.0, 1.0) * spirillae * 1.5; // Cyan data buses

        // Composite Oracle Core over the weather system
        float core_mask = smoothstep(0.8, 0.2, length(z));
        color = mix(color, color + core_color, core_mask);

        // Dark luminous background base instead of pure black
        vec3 bg = vec3(0.05, 0.0, 0.15) + 0.1 * acid_neon(length(z) * 0.5 - u_time * 0.1);
        color = max(color, bg);

        // Vignette & HDR clamping
        color *= 1.0 - 0.3 * dot(z, z);
        color = pow(color, vec3(0.85)); // slight gamma pop

        fragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };

    // Track mouse correctly
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y
      material.uniforms.u_mouse.value.set(x, y);
    });
    
    // Initial dummy mouse movement to start the physics
    material.uniforms.u_mouse.value.set(0.6, 0.6);
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Neon Trash Oracle Initialization Failed:", e);
  throw e;
}