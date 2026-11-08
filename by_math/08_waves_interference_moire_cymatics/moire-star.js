try {
  // Ensure WebGL renderer is initialized only once per canvas
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

    // Feral Design Brain: Anamorphic Quasicrystal Moiré with Structural Color Thin-Film Interference
    const fragmentShader = `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_pressed;

      in vec2 vUv;
      out vec4 fragColor;

      #define PI 3.14159265359

      // --- COLOR FIELDS: IQ Cosine Palette (Neon Acid / Iridescent) ---
      // From merrypranxter/color_fields
      vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
          return a + b * cos(2.0 * PI * (c * t + d));
      }

      // --- STRUCTURAL COLOR: Black Body Radiation ---
      // From merrypranxter/color_fields & structural_color
      vec3 blackBody(float t) {
          t = clamp(t, 0.0, 1.0);
          vec3 c;
          c.r = smoothstep(0.0, 0.33, t);
          c.g = smoothstep(0.15, 0.6, t) * 0.85;
          c.b = smoothstep(0.4, 0.9, t) * 0.6;
          return c * (0.5 + 2.0 * t * t);
      }

      // --- NOISE: Domain Warping & Biological Growth ---
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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

      float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.866, -0.5, 0.5, 0.866);
          for(int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = rot * p * 2.0;
              a *= 0.5;
          }
          return v;
      }

      // --- MOIRÉ: 5-Fold Quasicrystal Grating ---
      // From merrypranxter/moire (Geometric Topological)
      float quasi(vec2 uv, float scale, float phase, float angleOffset) {
          float v = 0.0;
          for(int i = 0; i < 5; i++) {
              float angle = float(i) * PI / 5.0 + angleOffset;
              vec2 dir = vec2(cos(angle), sin(angle));
              v += cos(dot(uv, dir) * scale + phase);
          }
          return v / 5.0; // Normalize to approx -1.0 to 1.0
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;

          // Mouse coordinates for Anamorphic Secret
          vec2 mousePos = (u_mouse / u_resolution - 0.5) * 2.0;
          mousePos.x *= u_resolution.x / u_resolution.y;
          
          float distToMouse = length(uv - mousePos);
          
          // Anamorphic Mask: The moiré registration error resolves to 0 at the mouse cursor
          // Creating a "moiré singularity" where the hidden structure is revealed
          float anamorphicMask = smoothstep(0.0, 1.5, distToMouse);
          
          // Biological/Fluid surface topology (Temporal Feedback Moiré feel)
          vec2 warpUV = uv * 2.0 + u_time * 0.1;
          float h = fbm(warpUV + vec2(cos(u_time * 0.2), sin(u_time * 0.2)));
          
          // The "infection" vector field
          vec2 distortion = vec2(fbm(warpUV + h), fbm(warpUV - h)) * 0.2;
          
          // Apply distortion, but cancel it out near the observer (mouse)
          vec2 uvA = uv + distortion * anamorphicMask;
          vec2 uvB = uv - distortion * anamorphicMask * (1.0 + u_pressed * 2.0); // Shockwave on click

          // Base scale is extremely high to create spatial aliasing & interference
          float baseScale = 120.0 + sin(u_time * 0.1) * 20.0;
          
          // Chromatic Offset (CMYK / RGB separation moiré)
          // The angles are slightly offset to simulate the "Rosette Pattern" of print ghosts
          float rOff = 0.0;
          float gOff = 0.05;
          float bOff = 0.10;

          // Reference Grids (Grid A)
          float refR = quasi(uvA, baseScale, u_time * 0.5, rOff);
          float refG = quasi(uvA, baseScale * 1.01, u_time * 0.6, gOff);
          float refB = quasi(uvA, baseScale * 1.02, u_time * 0.7, bOff);

          // Projected Grids (Grid B) - scale diverges from reference based on distance from mouse
          float projScaleR = baseScale + anamorphicMask * 2.0;
          float projScaleG = baseScale * 1.01 + anamorphicMask * 2.5;
          float projScaleB = baseScale * 1.02 + anamorphicMask * 3.0;

          float projR = quasi(uvB, projScaleR, -u_time * 0.5, rOff);
          float projG = quasi(uvB, projScaleG, -u_time * 0.6, gOff);
          float projB = quasi(uvB, projScaleB, -u_time * 0.7, bOff);

          // Multiplicative interference (Natural Wave Interference)
          float moireR = refR * projR;
          float moireG = refG * projG;
          float moireB = refB * projB;

          // Extract the difference frequency
          vec3 moire = vec3(moireR, moireG, moireB);
          
          // Aggressive contrast push for sharp, visceral fringes
          vec3 fringes = pow(clamp(abs(moire) * 3.0, 0.0, 1.0), vec3(2.0));

          // --- STRUCTURAL COLOR MAPPING ---
          // Use the moiré interference pattern as a "thickness map" for thin-film iridescence
          // thickness ranges from ~200nm to ~800nm
          float thickness = mix(200.0, 800.0, (fringes.r + fringes.g + fringes.b) / 3.0);
          
          // Calculate perceptual color based on structural thickness
          vec3 iridescence = cosinePalette(
              thickness / 1000.0 - u_time * 0.05,
              vec3(0.5), 
              vec3(0.5, 0.5, 0.33), 
              vec3(2.0, 1.0, 1.0), 
              vec3(0.5, 0.2, 0.25)
          );

          // Cosmic Void background (from color_fields)
          vec3 voidColor = vec3(0.04, 0.0, 0.08);
          
          // Blend iridescence over the void based on fringe strength
          vec3 finalColor = mix(voidColor, iridescence, length(fringes) * 0.7);

          // Lava Emission at points of perfect constructive interference
          float alignment = fringes.r * fringes.g * fringes.b;
          vec3 emissive = blackBody(alignment * 2.5);
          finalColor += emissive * 0.8;

          // Film grain for texture
          float grain = hash(uv * u_time) * 0.05;
          finalColor += grain;

          // ACES Filmic Tonemapping
          finalColor = clamp((finalColor * (2.51 * finalColor + 0.03)) / (finalColor * (2.43 * finalColor + 0.59) + 0.14), 0.0, 1.0);

          fragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(grid.width / 2, grid.height / 2) },
        u_pressed: { value: 0.0 }
      },
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;

  // Update Uniforms safely
  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    
    if (material.uniforms.u_mouse) {
      // Smoothly interpolate mouse to avoid jerky moire shifts
      const targetX = mouse.x;
      const targetY = grid.height - mouse.y; // Flip Y for WebGL
      material.uniforms.u_mouse.value.x += (targetX - material.uniforms.u_mouse.value.x) * 0.1;
      material.uniforms.u_mouse.value.y += (targetY - material.uniforms.u_mouse.value.y) * 0.1;
    }

    if (material.uniforms.u_pressed) {
      material.uniforms.u_pressed.value = mouse.isPressed ? 1.0 : 0.0;
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Feral WebGL Initialization Failed:", e);
  // Fallback to a visceral 2D noise pattern if WebGL fails
  if (ctx && !canvas.__three) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, grid.width, grid.height);
    ctx.fillStyle = "#ff00ff";
    ctx.font = "20px monospace";
    ctx.fillText("CRITICAL SYSTEM FAILURE: WebGL REQUIRED FOR STRUCTURAL COLOR", 20, 50);
  }
}