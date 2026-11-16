try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
      in vec2 vUv;
      uniform float u_time;
      uniform vec2 u_resolution;
      out vec4 fragColor;

      // Domain warp for subtle magnetic/thermal wobble
      vec2 warp(vec2 p) {
          float t = u_time * 0.2;
          float x = sin(p.y * 15.0 + t) * 0.0015 + cos(p.x * 8.0 - t * 0.8) * 0.001;
          float y = cos(p.x * 18.0 + t * 1.1) * 0.0015 + sin(p.y * 9.0 + t * 0.5) * 0.001;
          return p + vec2(x, y);
      }

      void main() {
          // 1. VR Lens Distortion (Barrel)
          vec2 centered = vUv * 2.0 - 1.0;
          float r2 = dot(centered, centered);
          // Distort coordinates outward
          vec2 distortedUv = centered * (1.0 + 0.18 * r2 + 0.08 * r2 * r2);
          distortedUv = distortedUv * 0.5 + 0.5;

          // 2. Apply micro-wobble (damage_aesthetics: tracking instability/heat)
          vec2 warpedUv = warp(distortedUv);

          // 3. Subpixel Grid Math
          // Scale determines how "macro" the shot is. 
          // 9.0 means one RGB cluster is 9x9 screen pixels.
          float scale = 9.0; 
          vec2 screenCoord = warpedUv * u_resolution;
          vec2 p = screenCoord / scale;

          vec2 cell = floor(p);
          vec2 local = fract(p);

          // Black gaps between pixel clusters (vertical and horizontal)
          // Sharp step functions for hard edges
          float gapThick = 0.08;
          float gapX = step(gapThick, local.x) * step(local.x, 1.0 - gapThick);
          float gapY = step(gapThick, local.y) * step(local.y, 1.0 - gapThick);
          float cellMask = gapX * gapY;

          // Subpixel stripes (R, G, B)
          float stripeWidth = 1.0 / 3.0;
          float rMask = step(local.x, stripeWidth);
          float gMask = step(stripeWidth, local.x) * step(local.x, stripeWidth * 2.0);
          float bMask = step(stripeWidth * 2.0, local.x);

          // Micro-gaps between the RGB subpixels
          float subGapThick = 0.08;
          float subLocal = fract(local.x * 3.0);
          float subGap = step(subGapThick, subLocal) * step(subLocal, 1.0 - subGapThick);

          // 4. Underlying Signal (The image being displayed)
          // We want a neutral/white-ish overall look, but with data.
          // Using a slow, high-frequency moiré interference pattern to create tension.
          float distCenter = length(warpedUv - 0.5);
          float moire1 = sin(distCenter * 150.0 - u_time * 1.5);
          float moire2 = sin(warpedUv.x * 200.0 + warpedUv.y * 100.0 + u_time);
          float signal = (moire1 * moire2) * 0.5 + 0.5;

          // Base color is very bright (white-ish), modulated slightly by the moiré signal
          vec3 baseColor = vec3(0.85) + 0.15 * signal;
          
          // Chromatic aberration in the signal itself near the edges (lens defect)
          float caAmount = smoothstep(0.2, 0.8, distCenter);
          baseColor.r *= 1.0 + caAmount * 0.1 * sin(distCenter * 300.0);
          baseColor.b *= 1.0 + caAmount * 0.1 * cos(distCenter * 300.0);

          // 5. Apply Subpixel Masking
          vec3 outColor = vec3(0.0);
          outColor.r = baseColor.r * rMask;
          outColor.g = baseColor.g * gMask;
          outColor.b = baseColor.b * bMask;

          // Cut out the gaps
          outColor *= cellMask * subGap;

          // 6. Phosphor Bloom / Bleed (damage_aesthetics)
          // The black gaps aren't perfectly black; light scatters in the glass
          vec3 bleed = baseColor * 0.04;
          vec3 finalColor = outColor + bleed * (1.0 - (cellMask * subGap));

          // 7. Vignette for the VR lens enclosure feel
          float vignette = 1.0 - smoothstep(0.4, 1.2, distCenter);
          finalColor *= vignette;

          fragColor = vec4(finalColor, 1.0);
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
  // Fallback to clear screen if WebGL fails entirely to prevent ghosting
  if (ctx && ctx.clearRect) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, grid.width, grid.height);
  }
}