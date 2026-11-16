try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2, 2);

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
      uniform vec2 u_mouse;

      // --- ALCHEMICAL MATH & NOISE ENGINES ---
      float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i = 0; i < 5; i++) {
              f += amp * noise(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      float sdBox(vec2 p, vec2 b) {
          vec2 d = abs(p) - b;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      // --- THE CATHEDRAL SCENE RENDERER ---
      vec3 renderScene(vec2 p) {
          // [Interaction] Mouse as Magnetic Lens
          vec2 md = p - (u_mouse * 2.0 - 1.0) * vec2(u_resolution.x/u_resolution.y, 1.0);
          float mdist = length(md);
          p -= md * exp(-mdist * 3.0) * sin(u_time * 2.0) * 0.15;

          // [Poincaré Hyperbolic Parasite Warp]
          float warp = 1.0 - dot(p, p) * 0.1 * sin(u_time * 0.5);
          vec2 hp = p / max(warp, 0.1);

          // ==========================================
          // LAYER A: Signal Cathedral (Moiré & Optics)
          // ==========================================
          float r = length(hp);
          float a = atan(hp.y, hp.x);
          
          // Concentric Ring Moiré (Radial Hypnosis Fields)
          float m1 = sin(r * 50.0 - u_time * 3.0);
          float m2 = sin(length(hp - vec2(0.1 * sin(u_time), 0.1 * cos(u_time))) * 52.0 + u_time * 2.5);
          float moire = m1 * m2;
          
          // Rainbow Optics / Hyperpop Rupture Palette
          vec3 bg = vec3(0.05, 0.0, 0.15); // Phosphor Noir base
          bg += vec3(1.0, 0.0, 0.4) * smoothstep(0.1, 0.9, moire) * 0.6; // Hot Pink fringes
          bg += vec3(0.0, 0.8, 1.0) * sin(r * 15.0 - u_time + a * 3.0) * 0.4; // Cyan phase waves
          bg += vec3(0.8, 1.0, 0.0) * smoothstep(0.8, 1.0, m1) * 0.3; // Acid Yellow pop

          // ==========================================
          // LAYER B: Living Math Engine (Lenia / Sandpile)
          // ==========================================
          // Abelian Sandpile XOR Fractal (Crystalline logic)
          vec2 gridUV = hp * 25.0;
          int gx = int(floor(abs(gridUV.x + u_time * 3.0)));
          int gy = int(floor(abs(gridUV.y - u_time * 1.5)));
          float sand = float((gx ^ gy) % 7) / 6.0;

          // Lenia Soft Life (Morphogenetic blobs via domain-warped FBM)
          vec2 leniaUV = hp * 3.0 + vec2(fbm(hp * 2.0 - u_time * 0.2), fbm(hp * 2.0 + u_time * 0.3));
          float l1 = fbm(leniaUV * 2.0);
          // Organism membranes and cores
          float leniaMembrane = smoothstep(0.35, 0.45, l1) - smoothstep(0.5, 0.6, l1);
          float leniaCore = smoothstep(0.55, 0.65, l1);

          // Colorizing the alien biology
          vec3 lifeColor = mix(vec3(0.6, 0.0, 1.0), vec3(0.0, 1.0, 0.6), sand); // Violet to Toxic Green
          lifeColor = mix(lifeColor, vec3(1.0, 0.9, 0.8), leniaCore); // White-hot cores
          vec3 layerB = lifeColor * (leniaMembrane + leniaCore * 1.5);

          // ==========================================
          // LAYER C: GeoCities Interface Ghosts
          // ==========================================
          // Drifting abstract UI frames
          vec2 uiUV1 = fract(p * 1.2 + vec2(u_time * 0.05, -u_time * 0.03)) - 0.5;
          float box1 = sdBox(uiUV1, vec2(0.3, 0.2));
          float frame1 = smoothstep(0.015, 0.005, abs(box1));
          float bevel1 = smoothstep(0.04, 0.03, abs(box1 + 0.01));

          // Text Aphasia (Semantic Font Rot inside windows)
          float insideBox = 1.0 - step(0.0, box1);
          vec2 textGrid = floor(uiUV1 * 40.0);
          float aphasia = step(0.7, hash21(textGrid + floor(u_time * 5.0))) * insideBox;
          
          // Marquee Ticker
          float tickerY = abs(p.y + 0.4);
          float ticker = step(tickerY, 0.03) * step(0.5, sin(p.x * 50.0 + u_time * 15.0));

          // Ghost Cursor (Op-Art eye/arrow)
          vec2 cursorUV = p - vec2(0.5 * sin(u_time), 0.3 * cos(u_time * 1.3));
          float cursor = step(abs(cursorUV.x - cursorUV.y), 0.01) * step(length(cursorUV), 0.1);

          vec3 uiColor = vec3(0.9, 0.95, 1.0) * (frame1 + bevel1 * 0.5 + aphasia * 0.3 + ticker + cursor);

          // ==========================================
          // COMPOSITE & SHOEGAZE HAZE
          // ==========================================
          vec3 col = bg + layerB + uiColor;
          
          // Shoegaze / Afterimage bloom (milky highlights overlay)
          col = mix(col, vec3(0.95, 0.85, 1.0), leniaMembrane * 0.25);
          
          return col;
      }

      void main() {
          // Normalize and aspect correct
          vec2 uv = vUv;
          vec2 p = uv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;

          // ==========================================
          // LAYER D: CRT / VHS / Glitchcore Envelope
          // ==========================================
          
          // 1. Barrel Distortion (Tube Curvature)
          vec2 crtUV = uv * 2.0 - 1.0;
          float crtR2 = dot(crtUV, crtUV);
          crtUV *= 1.0 + crtR2 * 0.12 + crtR2 * crtR2 * 0.03;
          crtUV = crtUV * 0.5 + 0.5;

          // Out of bounds glass darkness
          if (crtUV.x < 0.0 || crtUV.x > 1.0 || crtUV.y < 0.0 || crtUV.y > 1.0) {
              fragColor = vec4(0.02, 0.01, 0.03, 1.0);
              return;
          }

          // 2. VHS Tracking Jitter & Horizontal Tearing
          float jitter = step(0.96, sin(crtUV.y * 12.0 + u_time * 4.0)) * sin(u_time * 40.0) * 0.015;
          float tear = step(0.99, sin(crtUV.y * 70.0 - u_time * 12.0)) * 0.06;
          vec2 baseUV = crtUV;
          baseUV.x += jitter + tear;

          // 3. Candy-Crash Compression (Glitchcore macroblocking bursts)
          if (fract(u_time * 0.3) > 0.85) {
              float blockSize = 30.0;
              baseUV = floor(baseUV * blockSize) / blockSize;
          }

          // Map back to aspect-corrected scene coordinates
          vec2 sceneP = baseUV * 2.0 - 1.0;
          sceneP.x *= u_resolution.x / u_resolution.y;

          // 4. Chromatic Aberration (Anaglyph Stereo / RGB Phantom)
          float caOffset = 0.008 + 0.015 * step(0.95, sin(u_time * 8.0)); // Glitch bursts widen the offset
          vec3 col;
          col.r = renderScene(sceneP + vec2(caOffset, 0.0)).r;
          col.g = renderScene(sceneP).g;
          col.b = renderScene(sceneP - vec2(caOffset, 0.0)).b;

          // 5. CRT Phosphor Triad (Aperture Grille)
          float colIndex = mod(gl_FragCoord.x, 3.0);
          vec3 mask = vec3(
              smoothstep(1.0, 0.0, abs(colIndex - 0.5)),
              smoothstep(1.0, 0.0, abs(colIndex - 1.5)),
              smoothstep(1.0, 0.0, abs(colIndex - 2.5))
          );
          // Lift mask to prevent total darkness (mask strength = 0.7)
          mask = mix(vec3(1.0), mask, 0.7);
          col *= mask;

          // 6. Damper Wires (Trinitron authenticity tell)
          float w1 = exp(-pow(crtUV.y - 0.33, 2.0) / 0.0004);
          float w2 = exp(-pow(crtUV.y - 0.66, 2.0) / 0.0004);
          col *= 1.0 - 0.18 * (w1 + w2);

          // 7. Scanlines
          float scanline = 0.5 + 0.5 * sin(baseUV.y * u_resolution.y * 3.14159);
          col *= 1.0 - 0.35 * (1.0 - scanline);

          // 8. Rolling Refresh Bar (Tube Heartbeat)
          float bar = exp(-pow(fract(baseUV.y - u_time * 0.4) - 0.5, 2.0) * 80.0);
          col += vec3(0.08, 0.12, 0.18) * bar;

          // 9. Vignette / Glass Falloff
          float vig = smoothstep(1.2, 0.35, length((crtUV - 0.5) * vec2(1.0, 1.3)));
          col *= vig;

          // 10. Analog Noise / Film Grain (Signal memory)
          float grain = fract(sin(dot(baseUV + fract(u_time), vec2(12.9898, 78.233))) * 43758.5453);
          col += (grain - 0.5) * 0.07;

          // Gamma Correction for punchy contrast
          col = pow(max(col, vec3(0.0)), vec3(1.0 / 1.1));

          fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth, normalized mouse mapping
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    material.uniforms.u_mouse.value.set(mx, my);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
  throw e;
}