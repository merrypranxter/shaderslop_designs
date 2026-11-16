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

    // The Feral Jacquard Loom: A mathematically corrupted, highly acidic textile engine.
    // Combines domain warping, bitwise XOR fractals, anisotropic thread shading, 
    // and structural lace burnout.
    const fragmentShader = `
      precision highp float;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      // --- ALCHEMICAL MATH & NOISE ---
      
      // Hash without Sine by Dave_Hoskins
      float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      // 2D Value Noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
                   mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      // Fractal Brownian Motion (The Fungal Rot)
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.0 + vec2(100.0);
          a *= 0.5;
        }
        return v;
      }

      // Acidic Palette Generator (Birefringent Spectral Shift)
      vec3 acidPalette(float t) {
        // Highly saturated, clashing neon hues: Magenta, Lime, Cyan, Toxic Yellow
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 0.5);
        vec3 d = vec3(0.80, 0.90, 0.30);
        return a + b * cos(6.28318 * (c * t + d));
      }

      // --- TEXTILE LOGIC ---

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        float time = u_time * 0.2;

        // 1. HOSTILE COORDINATES (Domain Warping)
        // The loom is melting. We route the threads through a flowing vector field.
        vec2 warp_flow = vec2(fbm(uv * 2.0 + time), fbm(uv * 2.0 - time + 10.0));
        
        // Stereographic-like pinch + flow distortion
        float r = length(uv);
        vec2 space = uv / (1.0 + r * r * 0.2) + warp_flow * 0.15;
        
        // Slight rotation
        float ang = time * 0.1;
        mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
        space = rot * space;

        // 2. THE GRID (Warp & Weft Density)
        // High density to read as physical fabric
        float density = 140.0; 
        vec2 thread_uv = space * density;
        
        vec2 id = floor(thread_uv);
        vec2 st = fract(thread_uv) - 0.5; // Local cell coords: -0.5 to 0.5

        // 3. THE WEAVE RULE (Jacquard Math)
        // Combine bitwise XOR (Sierpinski-like) with Fourier interference waves
        int ix = int(id.x);
        int iy = int(id.y);
        
        // XOR Ghost Manifold
        float xor_fractal = float((ix ^ iy) % 13) / 13.0;
        
        // Moiré / Fourier Interference beat
        float wave = sin(id.x * 0.1 + time * 2.0) * cos(id.y * 0.15 - time * 1.5);
        
        // The Binary Decision: 1.0 = Warp on top, 0.0 = Weft on top
        float weave_rule = step(0.5, fract(xor_fractal + wave * 0.3 + fbm(id * 0.01)));

        // 4. THREAD MORPHOLOGY (Fiber Fuzz & Structure)
        // Add high-frequency noise to thread boundaries to simulate spun yarn
        float fuzz_x = (noise(space * 500.0) - 0.5) * 0.15;
        float fuzz_y = (noise(space * 500.0 + 100.0) - 0.5) * 0.15;
        
        float thread_width = 0.35; // 0.0 to 0.5
        
        // Distance to thread center
        float d_warp = abs(st.x) + fuzz_x;
        float d_weft = abs(st.y) + fuzz_y;
        
        // Smoothstep for anti-aliased thread edges
        float warp_mask = 1.0 - smoothstep(thread_width - 0.05, thread_width + 0.05, d_warp);
        float weft_mask = 1.0 - smoothstep(thread_width - 0.05, thread_width + 0.05, d_weft);

        // 5. TOPOLOGY & OCCLUSION (Which thread is visible?)
        // If warp is on top, weft is shadowed/occluded, and vice versa.
        float warp_vis = warp_mask * mix(0.15, 1.0, weave_rule); // 0.15 is shadow strength
        float weft_vis = weft_mask * mix(1.0, 0.15, weave_rule);
        
        float is_warp_dominant = step(weft_vis, warp_vis);
        float total_mask = max(warp_vis, weft_vis);

        // 6. CHROMATIC CANNIBALISM (Acidic Ikat Dyeing)
        // The dye bleeds along the threads. Warp color varies by Y, Weft by X.
        // We use the fbm vector field to create "Ikat blur" where the dye resists unevenly.
        
        float warp_dye_pos = id.y * 0.01 + fbm(vec2(id.x * 0.05, time)) * 2.0;
        float weft_dye_pos = id.x * 0.015 - fbm(vec2(id.y * 0.05, time * 0.8)) * 2.0;
        
        vec3 col_warp = acidPalette(warp_dye_pos + time * 0.5);
        vec3 col_weft = acidPalette(weft_dye_pos - time * 0.3 + 0.33); // Offset hue
        
        // Extreme saturation boost
        col_warp = pow(col_warp, vec3(0.6));
        col_weft = pow(col_weft, vec3(0.6));

        vec3 base_color = mix(col_weft, col_warp, is_warp_dominant);

        // 7. ANISOTROPIC SHINE (The Silk Specular)
        // Threads running horizontally catch vertical light differently than vertical threads.
        vec2 light_dir = normalize(vec2(0.5 + sin(time), 1.0));
        vec2 view_dir = vec2(0.0, 0.0); // Ortho view
        
        // Thread tangent vector (Warp is vertical, Weft is horizontal)
        vec2 tangent = mix(vec2(1.0, 0.0), vec2(0.0, 1.0), is_warp_dominant);
        
        // Ward anisotropic approximation
        vec2 half_vec = normalize(light_dir + view_dir);
        float dot_ht = dot(half_vec, tangent);
        float aniso = exp(-2.0 * pow(dot_ht, 2.0) / 0.05); // 0.05 is roughness
        
        // Add a harsh, metallic glint to the silk
        base_color += vec3(aniso * 0.8) * total_mask * vec3(0.8, 1.0, 0.9);

        // 8. AUTOPHAGIC LACE (Burnout / Negative Space)
        // The fabric rots away in fractal patterns, revealing the void behind it.
        float lace_noise = fbm(uv * 1.5 - warp_flow * 0.5);
        // Create sharp, torn edges
        float fabric_presence = smoothstep(0.40, 0.48, lace_noise);
        
        // Fraying threads at the edge of the void
        float fray = noise(space * 200.0) * 0.1;
        fabric_presence = smoothstep(0.4 + fray, 0.45 + fray, lace_noise);

        // 9. FINAL COMPOSITING
        // Deep abyssal background
        vec3 bg_color = vec3(0.02, 0.0, 0.05) + warp_flow.xyy * 0.05;
        
        // Apply mask and lace burnout
        float final_alpha = total_mask * fabric_presence;
        vec3 final_color = mix(bg_color, base_color, final_alpha);
        
        // Vignette
        final_color *= 1.0 - r * 0.3;

        fragColor = vec4(final_color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0, 0) }
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
    if (mouse.isPressed) {
      material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Feral Jacquard Loom Initialization Failed:", e);
  
  // Fallback Feral Canvas 2D mode if WebGL dies
  if (ctx && !canvas.__three) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, grid.width, grid.height);
    
    const cx = grid.width / 2;
    const cy = grid.height / 2;
    
    ctx.lineWidth = 1.5;
    ctx.globalCompositeOperation = "screen";
    
    for (let i = 0; i < 500; i++) {
      const t = time * 0.5 + i * 0.01;
      const r = 200 + Math.sin(t * 3.1) * 100;
      const x = cx + Math.cos(t * 2.3) * r;
      const y = cy + Math.sin(t * 1.7) * r;
      
      const hue = (i * 1.5 + time * 50) % 360;
      ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(t * 5.0) * 50, y + Math.sin(t * 5.0) * 50);
      ctx.stroke();
    }
  }
}