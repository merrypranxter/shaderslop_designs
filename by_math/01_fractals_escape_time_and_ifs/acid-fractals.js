try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context unavailable");

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
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_isPressed;

      // -- Simplex Noise (from noise_fields) --
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // -- Complex Math for Multibrot --
      vec2 cpow(vec2 z, float n) {
        float r = length(z);
        if (r < 1e-5) return vec2(0.0);
        float a = atan(z.y, z.x);
        return pow(r, n) * vec2(cos(n * a), sin(n * a));
      }

      // -- Palettes (from color_fields) --
      vec3 paletteNeon(float t) {
        // "cosine_neon" preset
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.33);
        vec3 c = vec3(2.0, 1.0, 1.0);
        vec3 d = vec3(0.5, 0.2, 0.25);
        return a + b * cos(6.28318 * (c * t + d));
      }

      vec3 paletteAcid(float t) {
        // Custom acid/toxic blend
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 0.5);
        vec3 d = vec3(0.8, 0.9, 0.3);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        // Normalized pixel coordinates (from -1 to 1, aspect corrected)
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        
        // Feral Domain Warp: The "happy" space is boiling
        float n1 = snoise(uv * 2.5 + u_time * 0.4);
        float n2 = snoise(uv * 2.5 - u_time * 0.3 + vec2(5.2, 1.3));
        vec2 warp = vec2(n1, n2) * 0.15;
        
        vec2 z = uv * 2.2 + warp;
        
        // Dynamic parameter C
        vec2 mouseC = (u_mouse - 0.5) * 2.0;
        vec2 c = mix(
            vec2(sin(u_time * 0.4) * 0.6, cos(u_time * 0.31) * 0.6),
            mouseC,
            u_isPressed
        );

        // Morphing dimensions: 2 to 6 fold symmetry (looks like blooming flowers)
        float power = 4.0 + 2.0 * sin(u_time * 0.2);

        float iter = 0.0;
        const float MAX_ITER = 64.0;
        float trap1 = 1e10; // Point trap
        float trap2 = 1e10; // Cross trap
        
        for(float i = 0.0; i < MAX_ITER; i++) {
            z = cpow(z, power) + c;
            
            trap1 = min(trap1, length(z - vec2(0.5, 0.0)));
            trap2 = min(trap2, min(abs(z.x), abs(z.y)));
            
            if(dot(z, z) > 16.0) break;
            iter++;
        }
        
        // Smooth iteration count for continuous coloring
        float smooth_n = iter - log2(max(1e-5, log2(dot(z,z)))) + 4.0;
        
        // Acidic Coloring Logic
        float escapeGradient = smooth_n / MAX_ITER;
        float t = escapeGradient * 3.0 - u_time * 0.5 + warp.x * 0.5;
        
        vec3 col;
        if (iter >= MAX_ITER) {
            // Interior: Boiling acid core
            float coreWarp = snoise(z * 5.0 - u_time * 2.0);
            col = paletteAcid(coreWarp * 0.5 + 0.5);
            col *= exp(-trap2 * 4.0) * 2.0; // Glow along axes
        } else {
            // Exterior: Neon retrofuture pop gradients
            col = paletteNeon(t);
            
            // Inject structural "orbit trap" glows
            col += vec3(1.0, 0.2, 0.8) * exp(-trap1 * 5.0); // Hot pink orbital hits
            col += vec3(0.0, 1.0, 0.5) * exp(-trap2 * 8.0); // Toxic green structural lines
            
            // FBM noise decay at the edges
            float edgeBreak = snoise(uv * 15.0 + u_time) * 0.5 + 0.5;
            col *= mix(0.7, 1.3, edgeBreak * escapeGradient);
        }

        // Overclocked Tonemapping (Pseudo-AgX/Filmic push for hyper-saturation)
        col = max(vec3(0.0), col);
        col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
        
        // Vignette
        float v = length(vUv - 0.5) * 2.0;
        col *= 1.0 - smoothstep(0.8, 1.5, v);

        fragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(mouse.x / grid.width, 1.0 - mouse.y / grid.height) },
        u_isPressed: { value: 0.0 }
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
    material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
    material.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
}