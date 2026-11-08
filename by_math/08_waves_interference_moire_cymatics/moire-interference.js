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

    const fragmentShader = `
      precision highp float;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      #define PI 3.14159265359
      
      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }
      
      // Psychedelic Pop "Acid Vibration" Palette
      const vec3 C_ORANGE  = vec3(1.0, 0.42, 0.0);
      const vec3 C_BLUE    = vec3(0.0, 0.28, 1.0);
      const vec3 C_MAGENTA = vec3(1.0, 0.0, 0.78);
      const vec3 C_LIME    = vec3(0.67, 1.0, 0.0);
      const vec3 C_BLACK   = vec3(0.08, 0.09, 0.11);
      const vec3 C_CREAM   = vec3(0.95, 0.92, 0.85);

      // Curvilinear rhythm: Scalloped Flower / Eye shape generator
      float flowerShape(vec2 p, float petals, float depth) {
          float a = atan(p.y, p.x);
          float r = length(p);
          return r + sin(a * petals + u_time * 0.3) * depth * smoothstep(0.0, 0.5, r);
      }

      // Halftone screen artifact (from print_artifacts)
      float halftone(vec2 p, float freq) {
          vec2 cell = fract(p * freq) - 0.5;
          return smoothstep(0.35, 0.15, length(cell));
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          // Domain warping (The "Melting/Flowing" Acid Feel)
          vec2 p = uv;
          float warp = sin(length(p) * 4.0 - u_time * 1.2) * 0.08;
          p *= rot(warp + u_time * 0.1);
          
          // MOIRÉ LAYER 1: Radial Scallops (The Pop Structure)
          float d1 = flowerShape(p, 10.0, 0.06);
          // High frequency grating
          float m1 = sin(d1 * 140.0 - u_time * 2.5);
          
          // MOIRÉ LAYER 2: Offset scale and counter-rotation (The Interference)
          vec2 p2 = uv * rot(-u_time * 0.2);
          float d2 = flowerShape(p2, 10.0, 0.06);
          float m2 = sin(d2 * 144.0 + u_time * 2.0);
          
          // MOIRÉ LAYER 3: The "Ghost" Spiral (Cosmic Mystic branch)
          float a3 = atan(uv.y, uv.x);
          float r3 = length(uv);
          float m3 = sin(a3 * 6.0 + log(r3 + 0.01) * 90.0 - u_time * 4.0);
          
          // THE BEAT FREQUENCY: Multiplicative interference creates sweeping macro-bands
          float beat1 = m1 * m2;
          float beat2 = m2 * m3;
          
          // FLATTENING: Step functions convert fluid math into crisp, graphic poster art
          float z1 = step(0.0, beat1);
          float z2 = step(0.0, beat2);
          
          // Nested arches/bands overlay (Psychedelic Pop structural rules)
          float macroBands = step(0.5, sin(d1 * 12.0 - u_time * 1.5));
          
          // COLOR ROUTING: Map interference zones to Acid Vibration palette
          vec3 col = mix(C_MAGENTA, C_LIME, z1);
          col = mix(col, C_ORANGE, z2 * macroBands);
          col = mix(col, C_BLUE, (1.0 - z1) * (1.0 - macroBands));
          
          // CMYK MISREGISTRATION & HALFTONE (Print Artifacts)
          // Add a subtle halftone screen in the "shadow" interference zones
          float ht = halftone(rot(PI/4.0) * uv, 120.0);
          col = mix(col, C_BLACK, ht * (1.0 - z2) * 0.6);
          
          // Graphic outline rings
          float rings = abs(fract(d1 * 6.0 - u_time * 0.5) - 0.5);
          col = mix(col, C_CREAM, smoothstep(0.08, 0.04, rings) * 0.8);
          
          // CENTRAL MOTIF: The Cosmic Eye / Flora Core
          float coreDist = length(uv);
          float eyeMask = smoothstep(0.25, 0.23, coreDist);
          float pupil = smoothstep(0.08, 0.07, coreDist);
          float iris = eyeMask - pupil;
          
          // Iris gets its own dense radial moiré
          float irisMoire = step(0.0, sin(coreDist * 300.0 - u_time * 5.0) * sin(atan(uv.y, uv.x) * 20.0));
          vec3 irisCol = mix(C_LIME, C_BLUE, irisMoire);
          
          // Composite the eye over the chaotic background
          col = mix(col, irisCol, iris);
          col = mix(col, C_BLACK, pupil);
          
          // 4-point Star highlight in the pupil
          float star = smoothstep(0.03, 0.0, abs(uv.x)) * smoothstep(0.15, 0.0, abs(uv.y)) +
                       smoothstep(0.03, 0.0, abs(uv.y)) * smoothstep(0.15, 0.0, abs(uv.x));
          star *= smoothstep(0.1, 0.0, coreDist);
          col = mix(col, C_CREAM, star * pupil * 2.0);
          
          // Vignette / Edge Burn
          float vignette = smoothstep(1.2, 0.5, length(uv));
          col *= mix(0.6, 1.0, vignette);

          fragColor = vec4(col, 1.0);
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

  if (material?.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Feral Moiré Initialization Failed:", e);
}