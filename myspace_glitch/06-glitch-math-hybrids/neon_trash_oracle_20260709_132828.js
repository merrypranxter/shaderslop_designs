if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

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
      // NEON TRASH ORACLE WEATHER SYSTEM
      // A feral synthesis of 16 repos: Lenia, Cuttlefish Chromatics, Plateau Foam, 
      // I Ching Fields, Abelian Sandpile, Moiré, Op Art, Glitchcore, Damage Aesthetics, 
      // Prism Dispersion, Spectral Color, Afterimage, CRT Phosphor, and Early Internet.

      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      #define PI 3.14159265359

      // --- UTILITIES & NOISE (Plateau Foam / Acoustic Impedance) ---
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      
      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      float voronoi(vec2 x, float t) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float md = 5.0;
        for(int j = -1; j <= 1; j++) {
          for(int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.5 * sin(t + 6.2831 * o); // Cuttlefish passing cloud jitter
            vec2 r = g + o - f;
            float d = dot(r, r);
            if(d < md) md = d;
          }
        }
        return sqrt(md);
      }

      // --- PROCEDURAL SCENE ENGINE ---
      vec3 renderOracleWeather(vec2 uv, float t) {
        // 1. Acoustic Impedance / Fluid Advection
        vec2 flow = vec2(sin(uv.y * 3.0 + t), cos(uv.x * 3.0 - t * 0.8)) * 0.15;
        vec2 p = uv + flow;
        
        // 2. Plateau Foam / Lenia Continuous CA Growth
        float v = voronoi(p * 4.0, t * 0.5);
        // Lenia growth function: G(u) = 2 * exp(-(u - mu)^2 / (2 * sigma^2)) - 1
        float lenia = 2.0 * exp(-pow(v - 0.28, 2.0) / 0.015) - 1.0;
        
        // 3. Abelian Sandpile / Op Art Mandala (The Oracle Core)
        float r = length(uv);
        float a = atan(uv.y, uv.x);
        
        // Moiré phase interference
        float moire = sin(r * 40.0 - t * 3.0) * sin(r * 42.0 + t * 2.5);
        
        // I Ching 6-bit quantization (64 hexagrams)
        float a_quant = floor(a * 10.1859) / 10.1859; 
        float sandpile = step(0.8, fract(sin(a_quant * 12.0) * 43.0 + r * 15.0 - t * 2.0));
        float coreMask = smoothstep(0.8, 0.2, r);
        
        // 4. Candy-Acid Color Systems (Hyperpop Rupture Palette)
        // Base: Hot Magenta (#FF0080) to Electric Cyan (#00FFFF)
        vec3 col = mix(vec3(1.0, 0.0, 0.5), vec3(0.0, 1.0, 1.0), smoothstep(-1.0, 1.0, lenia));
        
        // Mid: Acid Green (#9FE818) Moiré Halos
        col = mix(col, vec3(0.62, 0.91, 0.09), smoothstep(0.0, 1.0, moire) * coreMask);
        
        // Center: Neon Yellow (#DAF425) Sandpile Fracturing
        col = mix(col, vec3(0.85, 0.95, 0.14), sandpile * coreMask);
        
        // 5. Glitchcore / Damage Aesthetics (Macroblocking & Cursed Shitpost)
        vec2 block = floor(uv * 12.0) / 12.0;
        float glitch = step(0.96, fract(sin(block.x * 11.0 + block.y * 31.0 + floor(t * 10.0)) * 43758.5));
        if (glitch > 0.5) col = vec3(1.0) - col; // XOR Ghost Manifold inversion
        
        // 6. Early Internet / Text Screen Debris
        float text = step(0.7, fract(sin(floor(uv.x * 120.0) * 13.0 + floor(uv.y * 180.0) * 37.0) * 43758.5));
        float textMask = step(0.98, fract(sin(uv.y * 4.0 + t * 2.0) * 4375.5));
        if (textMask > 0.5 && text > 0.5) col = vec3(1.0, 0.9, 0.9); // White-hot debris
        
        return col;
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;
        
        vec2 m = u_mouse * 2.0 - 1.0;
        m.x *= u_resolution.x / u_resolution.y;
        
        // 7. Op Art Hyperbolic Lens / Gravitational Anomaly
        float dMouse = length(uv - m);
        vec2 warpUV = uv + normalize(uv - m + 0.0001) * (sin(dMouse * 12.0 - u_time * 2.0) * 0.08 * exp(-dMouse * 2.5));
        
        // 8. Prism Dispersion / Spectral Color (Cauchy Dispersion Equation)
        vec2 dir = normalize(warpUV + 0.0001);
        float dist = length(warpUV);
        float B = 0.006; // Dispersion coefficient
        
        vec3 finalCol;
        // Sample the scene 3 times to simulate different wavelengths bending differently
        finalCol.r = renderOracleWeather(warpUV + dir * dist * B * 1.0, u_time).r;
        finalCol.g = renderOracleWeather(warpUV + dir * dist * B * 1.5, u_time).g;
        finalCol.b = renderOracleWeather(warpUV + dir * dist * B * 2.0, u_time).b;
        
        // 9. Afterimage Painter / Temporal Echo (Opponent Color Ghosting)
        vec3 echo1 = renderOracleWeather(warpUV, u_time - 0.15);
        vec3 echo2 = renderOracleWeather(warpUV, u_time - 0.30);
        
        // Additive complementary colors (Cyan & Magenta ghosts trailing the motion)
        finalCol += echo1 * 0.35 * vec3(0.0, 1.0, 1.0); 
        finalCol += echo2 * 0.20 * vec3(1.0, 0.0, 1.0); 
        
        // 10. CRT Phosphor FX / Broadcast Signal Failure
        float scanline = sin(vUv.y * u_resolution.y * 0.7) * 0.06;
        finalCol -= scanline;
        
        // Tube Vignette
        float vignette = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.2;
        finalCol *= clamp(vignette, 0.0, 1.0);
        
        // 11. Phosphor Bloom / Overexposure
        finalCol += max(finalCol - 0.75, 0.0) * 1.2;
        
        fragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(mouse.x, mouse.y) }
      },
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("Neon Trash Oracle Weather System Initialization Failed:", e);
  }
}

if (canvas.__three) {
  const { renderer, scene, camera, material } = canvas.__three;
  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth mouse interpolation for the gravitational lens
    const targetMouseX = mouse.x / grid.width;
    const targetMouseY = 1.0 - (mouse.y / grid.height);
    
    // If mouse is uninitialized, center it
    if (material.uniforms.u_mouse.value.x === 0 && material.uniforms.u_mouse.value.y === 0) {
      material.uniforms.u_mouse.value.set(0.5, 0.5);
    } else {
      material.uniforms.u_mouse.value.x += (targetMouseX - material.uniforms.u_mouse.value.x) * 0.1;
      material.uniforms.u_mouse.value.y += (targetMouseY - material.uniforms.u_mouse.value.y) * 0.1;
    }
  }
  
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
}