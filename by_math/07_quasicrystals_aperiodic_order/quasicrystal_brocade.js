try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
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

    const fragmentShader = `
      precision highp float;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_mouse;
      
      // 7-Fold Quasicrystal Wave Summation
      float quasicrystal(vec2 p, float time) {
          float h = 0.0;
          const int N = 7;
          for(int i = 0; i < N; i++) {
              float theta = float(i) * 3.14159265359 / float(N);
              vec2 dir = vec2(cos(theta), sin(theta));
              float phase = time * 0.4 + float(i) * 1.6180339887;
              h += cos(dot(p, dir) * 6.0 + phase);
          }
          return h / float(N);
      }
      
      // Structural Color / Thin-film Palette
      vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
          return a + b * cos(6.2831853 * (c * t + d));
      }

      // Procedural height map for the brocade loom
      float map(vec2 p, out float weaveMix, out float embroideryMask, out float thread) {
          float qc = quasicrystal(p, u_time);
          
          // Moire macro-weave (Warp/Weft logic)
          float weaveMacro = sin(p.x * 30.0) * sin(p.y * 30.0);
          
          // The quasicrystal structure dictates which thread is on top
          weaveMix = smoothstep(-0.25, 0.25, weaveMacro + qc * 0.8);
          
          // High-frequency micro threads (ribbing)
          float threadFreq = 250.0;
          float warp = cos(p.x * threadFreq);
          float weft = cos(p.y * threadFreq);
          thread = mix(warp, weft, weaveMix);
          
          // High-amplitude quasicrystal nodes become raised embroidery
          embroideryMask = smoothstep(0.35, 0.65, abs(qc));
          
          // Combined heightfield
          float height = qc * 1.5 + thread * 0.12 + embroideryMask * 0.5;
          return height;
      }

      // Overloaded map for normal calculation
      float map(vec2 p) {
          float w, e, t;
          return map(p, w, e, t);
      }

      void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;
          uv *= 2.0; // Pattern scale
          
          // Mouse brushing interaction (bends the fabric/threads)
          vec2 mouseUV = u_mouse.xy * 2.0 - 1.0;
          mouseUV.x *= u_resolution.x / u_resolution.y;
          mouseUV *= 2.0;
          
          vec2 delta = uv - mouseUV;
          float dist = length(delta);
          float brush = exp(-dist * 6.0) * u_mouse.z;
          
          // Displace UVs to simulate thread pulling
          vec2 distortedUV = uv + normalize(delta + 0.001) * brush * 0.15;
          
          // Sample structural properties
          float weaveMix, embroideryMask, thread;
          float h = map(distortedUV, weaveMix, embroideryMask, thread);
          
          // Compute surface normal via finite differences
          vec2 e = vec2(0.003, 0.0);
          vec3 N = normalize(vec3(
              map(distortedUV - e.xy) - map(distortedUV + e.xy),
              map(distortedUV - e.yx) - map(distortedUV + e.yx),
              e.x * 6.0 // Controls normal bumpiness
          ));
          
          // View and Light vectors
          vec3 V = normalize(vec3(0.0, 0.0, 1.0));
          vec3 L = normalize(vec3(0.4, 0.6, 0.8)); // Angled light
          vec3 H = normalize(L + V);
          
          // Anisotropic tangent vector for silk sheen
          vec3 T_warp = vec3(0.0, 1.0, 0.0);
          vec3 T_weft = vec3(1.0, 0.0, 0.0);
          vec3 T = normalize(mix(T_warp, T_weft, weaveMix));
          T = normalize(cross(N, cross(T, N))); // Project tangent onto surface
          
          // Diffuse lighting (wrapped for fabric softness)
          float diff = dot(N, L) * 0.5 + 0.5;
          
          // Silk Anisotropic Specular
          float TH = dot(T, H);
          float anisoSpec = pow(sqrt(max(0.0, 1.0 - TH * TH)), 24.0) * (1.0 - embroideryMask);
          
          // Embroidery Isotropic Specular & Sparkle
          float isoSpec = pow(max(0.0, dot(N, H)), 32.0) * embroideryMask;
          float noise = fract(sin(dot(distortedUV, vec2(12.9898, 78.233))) * 43758.5453);
          float sparkle = pow(max(0.0, sin(noise * 6.28 + u_time * 3.0)), 40.0);
          isoSpec += sparkle * embroideryMask * 1.5;

          // --- Palette Generation ---
          
          // Base Silk (Hot Pink to Ultraviolet Shadows)
          vec3 colorUV = vec3(0.2, 0.0, 0.4);
          vec3 colorPink = vec3(1.0, 0.1, 0.5);
          vec3 silkColor = mix(colorUV, colorPink, diff);
          
          // Thread Highlights (Cyan on peaks of the micro-threads)
          silkColor = mix(silkColor, vec3(0.0, 0.9, 1.0), smoothstep(0.4, 1.0, thread) * 0.4);
          
          // Embroidery Structural Color (Acid Yellow + Orange Glints)
          vec3 iridescence = palette(dot(N, V) * 1.5 + h * 0.5, 
                                     vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
          vec3 colorEmbroidery = mix(vec3(0.8, 1.0, 0.0), vec3(1.0, 0.3, 0.0), iridescence.r);
          
          // Composite Silk and Embroidery
          vec3 finalColor = mix(silkColor, colorEmbroidery, embroideryMask);
          
          // Add Specular Highlights
          finalColor += anisoSpec * vec3(1.0, 0.6, 0.8) * 0.7; // Pinkish silk sheen
          finalColor += isoSpec * vec3(1.0, 0.9, 0.7); // White-hot sparkle
          
          // Ambient Occlusion in deep quasicrystal valleys
          float ao = smoothstep(-1.0, 1.0, h);
          finalColor *= mix(0.4, 1.0, ao);
          
          // Vignette
          float vignette = 1.0 - smoothstep(0.5, 2.5, length(vUv * 2.0 - 1.0));
          finalColor *= vignette;
          
          // Contrast Curve
          finalColor = smoothstep(0.0, 1.1, finalColor);
          
          fragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector3(0.5, 0.5, 0) }
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

  // Safe uniform updates
  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (material.uniforms.u_mouse) {
      const mx = mouse.x / grid.width;
      const my = 1.0 - (mouse.y / grid.height);
      // Continuous gentle brush, stronger when clicked
      const brushIntensity = mouse.isPressed ? 1.0 : 0.3;
      material.uniforms.u_mouse.value.set(mx, my, brushIntensity);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (error) {
  console.error("Quasicrystal Brocade Loom Error:", error);
}