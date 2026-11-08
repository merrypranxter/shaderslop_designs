try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.setPixelRatio(1);
    
    // Create a bounded simulation resolution for performance
    const simW = Math.min(grid.width, 1024);
    const simH = Math.min(grid.height, 1024);

    const rtOpts = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    };

    const rtA = new THREE.WebGLRenderTarget(simW, simH, rtOpts);
    const rtB = new THREE.WebGLRenderTarget(simW, simH, rtOpts);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    // --- FUNGAL COMPUTE: Continuous Cellular Automata Shader ---
    // Inherits logic from cellular_automata repo (Lenia/Cyclic hybrids)
    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(simW, simH) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_isPressed: { value: false },
        u_time: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform vec2 u_mouse;
        uniform bool u_isPressed;
        uniform float u_time;
        in vec2 vUv;
        out vec4 fragColor;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            vec2 texel = 1.0 / u_res;

            // Seed initial state
            if (u_time < 0.1) {
                fragColor = vec4(hash(vUv * 100.0), 0.0, 0.0, 1.0);
                return;
            }

            float center = texture(u_state, vUv).r;

            // Multi-scale neighborhood sampling (MNCA style)
            float sumInner = 0.0;
            float sumOuter = 0.0;
            
            for(int i=-1; i<=1; i++) {
                for(int j=-1; j<=1; j++) {
                    if(i!=0 || j!=0) sumInner += texture(u_state, fract(vUv + vec2(i,j)*texel)).r;
                }
            }
            
            for(int i=-2; i<=2; i++) {
                for(int j=-2; j<=2; j++) {
                    if(abs(i)==2 || abs(j)==2) sumOuter += texture(u_state, fract(vUv + vec2(i,j)*texel*2.0)).r;
                }
            }

            float avgInner = sumInner / 8.0;
            float avgOuter = sumOuter / 16.0;

            float next = center;

            // Reaction-Diffusion / Cyclic Hybrid Rules
            // Warped by spatial gyroid to create varying "biomes"
            float gyroid = sin(vUv.x * 15.0 + u_time * 0.2) * cos(vUv.y * 15.0) + sin(vUv.y * 15.0) * cos(vUv.x * 15.0);
            float activation = avgInner - avgOuter;
            
            if (activation > 0.05 + gyroid * 0.02) {
                next += 0.08; // Growth
            } else if (avgOuter > 0.3) {
                next -= 0.04; // Overpopulation decay
            } else {
                next += 0.01; // Slow creep
            }

            // Cyclic continuous wrap
            next = fract(next);

            // Spontaneous noisy mutations (machine hesitation)
            if (hash(vUv + u_time) < 0.0005) {
                next = fract(next + 0.5);
            }

            // Mouse injection (spore drop)
            float dist = length(vUv - u_mouse);
            if (u_isPressed && dist < 0.05) {
                next = fract(next + hash(vUv) * 0.5);
            }

            fragColor = vec4(next, 0.0, 0.0, 1.0);
        }
      `
    });

    // --- PSYCHEDELIC STRUCTURAL RENDER: Thin-Film + Glitch ---
    // Inherits logic from structural_color & psychedelic_collage repos
    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform float u_time;
        in vec2 vUv;
        out vec4 fragColor;

        // Thin-Film Interference (Structural Color)
        // 2nd cos(θ) = mλ
        vec3 thinFilm(float cosTheta, float thickness) {
            float n = 1.56; // Chitin index (Jewel Beetle)
            float pathDiff = 2.0 * n * thickness * sqrt(1.0 - pow(sin(acos(cosTheta))/n, 2.0));
            // Approximate spectral interference mapping
            vec3 phase = vec3(0.0, 0.33, 0.67);
            return 0.5 + 0.5 * cos(6.28318 * (pathDiff / 500.0 + phase));
        }

        void main() {
            vec2 uv = vUv;

            // Kaleidoscope Mirror-Tile Pattern (Psychedelic Collage)
            vec2 p = uv * 2.0 - 1.0;
            p.x *= u_res.x / u_res.y; // Correct aspect ratio for polar math
            
            float angle = atan(p.y, p.x);
            float radius = length(p);
            float folds = 8.0;
            float sector = 6.28318 / folds;
            
            angle = mod(angle + u_time * 0.05, sector);
            if (angle > sector * 0.5) angle = sector - angle;
            
            // Map back to UV space
            vec2 kUv = vec2(cos(angle), sin(angle)) * radius;
            kUv.x *= u_res.y / u_res.x;
            kUv = kUv * 0.5 + 0.5;

            // Chromatic Aberration / CMYK Misregistration reading the CA
            vec2 dir = normalize(kUv - 0.5);
            float glitchOffset = 0.005 + 0.01 * sin(u_time * 3.0) * cos(u_time * 5.0); // Erratic scan bend

            float stateR = texture(u_state, fract(kUv + dir * glitchOffset)).r;
            float stateG = texture(u_state, fract(kUv)).r;
            float stateB = texture(u_state, fract(kUv - dir * glitchOffset)).r;

            // Map CA states to biological film thicknesses (100nm to 900nm)
            float baseThick = 150.0;
            float varThick = 750.0;
            
            // Simulated viewing angle (dome-like)
            float cosTheta = max(0.1, 1.0 - radius * 0.7);

            vec3 colR = thinFilm(cosTheta, baseThick + stateR * varThick);
            vec3 colG = thinFilm(cosTheta, baseThick + stateG * varThick);
            vec3 colB = thinFilm(cosTheta, baseThick + stateB * varThick);

            // Recombine aberrated channels
            vec3 finalCol = vec3(colR.r, colG.g, colB.b);

            // Acid Vibration / Contrast Punch (Overlay blend)
            finalCol = mix(2.0 * finalCol * finalCol, 1.0 - 2.0 * (1.0 - finalCol) * (1.0 - finalCol), step(0.5, finalCol));

            // Halftone / Print Artifact Overlay (Newsprint texture)
            float freq = 200.0;
            vec2 cell = fract(vUv * freq) - 0.5;
            float luma = dot(finalCol, vec3(0.299, 0.587, 0.114));
            float dotRadius = sqrt(1.0 - luma) * 0.45;
            float ht = smoothstep(dotRadius + 0.1, dotRadius - 0.1, length(cell));

            // Multiply blend halftone (darkens)
            vec3 inkColor = vec3(0.05, 0.02, 0.1); // Deep violet ink
            finalCol = mix(inkColor, finalCol, ht);

            // Cyberdelic Neon glow (Screen blend proxy at center)
            float glow = exp(-radius * 2.0) * 0.3;
            finalCol += vec3(glow * stateG, glow * stateB, glow * stateR);

            fragColor = vec4(finalCol, 1.0);
        }
      `
    });

    const simScene = new THREE.Scene();
    const renderScene = new THREE.Scene();
    
    simScene.add(new THREE.Mesh(geometry, simMat));
    renderScene.add(new THREE.Mesh(geometry, renderMat));

    canvas.__three = { renderer, camera, simScene, renderScene, simMat, renderMat, rtA, rtB };
  }

  const { renderer, camera, simScene, renderScene, simMat, renderMat } = canvas.__three;
  let { rtA, rtB } = canvas.__three;

  renderer.setSize(grid.width, grid.height, false);

  // 1. Simulation Pass (Fungal Compute)
  simMat.uniforms.u_state.value = rtA.texture;
  simMat.uniforms.u_time.value = time;
  
  // Normalize mouse coordinates [0, 1] with Y flipped for WebGL
  const mx = mouse.x / grid.width;
  const my = 1.0 - (mouse.y / grid.height);
  simMat.uniforms.u_mouse.value.set(mx, my);
  simMat.uniforms.u_isPressed.value = mouse.isPressed;

  renderer.setRenderTarget(rtB);
  renderer.render(simScene, camera);

  // 2. Render Pass (Structural Color -> Screen)
  renderer.setRenderTarget(null);
  renderMat.uniforms.u_state.value = rtB.texture;
  renderMat.uniforms.u_time.value = time;
  renderMat.uniforms.u_res.value.set(grid.width, grid.height);
  renderer.render(renderScene, camera);

  // 3. Ping-Pong Swap
  canvas.__three.rtA = rtB;
  canvas.__three.rtB = rtA;

} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
  // Fallback if WebGL fails entirely so we don't return an empty canvas
  if (ctx && ctx.fillStyle) {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, grid.width, grid.height);
    ctx.fillStyle = "#FF00CC";
    ctx.font = "20px monospace";
    ctx.fillText("STRUCTURAL FUNGUS: WEBGL REQUIRED", 20, 40);
  }
}