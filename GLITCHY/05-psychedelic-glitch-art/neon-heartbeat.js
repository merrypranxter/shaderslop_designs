try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.setPixelRatio(1.0); // Force 1:1 pixel mapping for crisp subpixels

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
      uniform float u_time;
      uniform vec2 u_resolution;

      in vec2 vUv;
      out vec4 fragColor;

      // Noise for feral tearing
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // Domain warp (Fungus/Liquid logic)
      vec2 warp(vec2 p, float t) {
        float n = sin(p.y * 12.0 + t) * cos(p.x * 15.0 - t * 0.8);
        float n2 = sin(p.x * 8.0 - t * 1.2) * cos(p.y * 10.0 + t * 0.5);
        return p + vec2(n, n2) * 0.03;
      }

      void main() {
        // Pixel-perfect coordinates for the LED grid
        vec2 fragCoord = vUv * u_resolution;
        vec2 uv = vUv;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        // --- THE HEARTBEAT ---
        // Double-pump biological rhythm
        float t_beat = fract(u_time * 1.1);
        float pulse = exp(-t_beat * 12.0) * sin(t_beat * 3.1415 * 4.0) 
                    + exp(-fract(u_time * 1.1 + 0.2) * 12.0) * 0.6;
        pulse = max(0.0, pulse);

        // --- DAMAGE: Tearing & Sync Instability ---
        float tearRow = floor(uv.y * 80.0);
        float tear = step(0.97, hash(vec2(tearRow, floor(u_time * 15.0))));
        p.x += tear * 0.15 * sin(u_time * 30.0) * pulse;

        // Warp space with heartbeat expansion
        vec2 w_p = warp(p, u_time * 0.5);
        w_p *= 1.0 - (pulse * 0.05);

        // --- MOIRÉ ENGINE (Rolling Rainbow) ---
        // Three offset centers for the chromatic channels
        vec2 cR_center = vec2(sin(u_time * 0.4) * 0.3, cos(u_time * 0.25) * 0.3);
        vec2 cG_center = vec2(cos(u_time * 0.35) * 0.3, sin(u_time * 0.45) * 0.3);
        vec2 cB_center = vec2(sin(u_time * 0.5) * 0.3, -cos(u_time * 0.3) * 0.3);

        float dR = length(w_p + cR_center);
        float dG = length(w_p + cG_center);
        float dB = length(w_p + cB_center);

        // Interfering frequencies (Spatial Aliasing)
        float f1 = 80.0;
        float f2 = 82.0;
        
        float r_moire = sin(dR * f1 - u_time * 4.0) * sin(w_p.x * f2 + u_time * 2.0) * 0.5 + 0.5;
        float g_moire = sin(dG * (f1 + 1.5) - u_time * 4.2) * sin(w_p.y * (f2 + 1.0) - u_time * 2.1) * 0.5 + 0.5;
        float b_moire = sin(dB * (f1 + 3.0) - u_time * 4.4) * sin((w_p.x + w_p.y) * (f2 * 0.8) + u_time * 2.2) * 0.5 + 0.5;

        // Aggressive contrast push to create bands instead of soft waves
        r_moire = smoothstep(0.3, 0.7, r_moire);
        g_moire = smoothstep(0.3, 0.7, g_moire);
        b_moire = smoothstep(0.3, 0.7, b_moire);

        // --- LED SUBPIXEL MASK ---
        // Scale determines how fat the LEDs are
        float led_scale = 3.0; 
        vec2 led_coord = fragCoord / led_scale;
        
        float sub_x = mod(floor(led_coord.x), 3.0);
        float scanline_y = step(0.2, fract(led_coord.y)); // Horizontal black gap

        // R, G, B isolation
        vec3 mask = vec3(
            step(sub_x, 0.5),
            step(0.5, sub_x) * step(sub_x, 1.5),
            step(1.5, sub_x)
        ) * scanline_y;

        // --- COLOR PALETTE ---
        vec3 c_HotPink = vec3(1.0, 0.05, 0.5);
        vec3 c_AcidLime = vec3(0.6, 1.0, 0.0);
        vec3 c_ElectricCobalt = vec3(0.0, 0.3, 1.0);
        vec3 c_DeepViolet = vec3(0.3, 0.0, 0.6);

        // Apply moire to the physical LED mask
        vec3 led_color = mask.r * c_HotPink * r_moire + 
                         mask.g * c_AcidLime * g_moire + 
                         mask.b * c_ElectricCobalt * b_moire;

        // --- SCAN BANDING (Deep Violet) ---
        // Slow rolling horizontal wave
        float violet_band = sin(uv.y * 15.0 - u_time * 1.5) * 0.5 + 0.5;
        violet_band = pow(violet_band, 2.0); // Sharpen the band
        
        // Inject violet into the dark zones of the moire
        float moire_lum = (r_moire + g_moire + b_moire) / 3.0;
        led_color += c_DeepViolet * violet_band * (1.0 - moire_lum) * 0.8;

        // --- PHOSPHOR BLOOM ---
        // Unmasked moire acts as the glow bleeding past the subpixel boundaries
        vec3 bloom = (c_HotPink * r_moire + c_AcidLime * g_moire + c_ElectricCobalt * b_moire) * 0.25;
        
        // Heartbeat drives the bloom intensity
        bloom *= 1.0 + (pulse * 2.5);
        
        // Add horizontal chroma drag (Tape Smear)
        float drag = sin(uv.y * 200.0) * 0.05;
        bloom.r += r_moire * drag;
        bloom.b -= b_moire * drag;

        vec3 final_color = led_color + bloom;

        // Vignette
        float vig = length(p);
        final_color *= smoothstep(1.6, 0.4, vig);

        // Glitch flash on the beat
        final_color += vec3(0.1, 0.0, 0.2) * pulse * step(0.9, hash(vec2(u_time, 0.0)));

        fragColor = vec4(final_color, 1.0);
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

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
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
  console.error("Feral LED Moiré Engine Failed:", e);
}