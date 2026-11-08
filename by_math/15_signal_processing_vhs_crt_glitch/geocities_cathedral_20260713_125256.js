if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.setPixelRatio(1.0); // Keep it crisp for CA and pixel logic
    
    const w = grid.width;
    const h = grid.height;

    // We need FloatType for exact continuous logic (Lenia) and integer accumulation (Sandpile)
    const fboParams = {
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false
    };

    const fboA = new THREE.WebGLRenderTarget(w, h, fboParams);
    const fboB = new THREE.WebGLRenderTarget(w, h, fboParams);

    // Initialize FBOs with noise to kickstart the system
    const initData = new Float32Array(w * h * 4);
    for (let i = 0; i < initData.length; i += 4) {
      initData[i] = Math.random(); // Lenia life
      initData[i+1] = Math.random() * 8.0; // Sandpile grains
      initData[i+2] = Math.random(); // UI Ghost map
      initData[i+3] = 0.0; // Afterimage
    }
    const initTex = new THREE.DataTexture(initData, w, h, THREE.RGBAFormat, THREE.FloatType);
    initTex.needsUpdate = true;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // =========================================================================
    // PASS 1: LIVING MATH ENGINE (Lenia + Sandpile + Reaction Diffusion)
    // =========================================================================
    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: initTex },
        u_res: { value: new THREE.Vector2(w, h) },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouse_pressed: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_mouse_pressed;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 texel = 1.0 / u_res;
          vec4 center = texture(u_state, vUv);

          // ----------------------------------------------------
          // CHANNEL R: Lenia-like Soft Life Convolution
          // ----------------------------------------------------
          float sum = 0.0;
          float wsum = 0.0;
          // Approximate multi-ring convolution via sparse polar sampling
          for(float r = 1.0; r <= 3.0; r += 1.0) {
            float radius = r * 4.0;
            for(float a = 0.0; a < 6.28318; a += 0.78539) {
              vec2 offset = vec2(cos(a), sin(a)) * radius * texel;
              sum += texture(u_state, fract(vUv + offset)).r;
              wsum += 1.0;
            }
          }
          float avg = sum / wsum;
          // Growth function: bell curve around a sweet spot
          float mu = 0.28;
          float sig = 0.04;
          float growth = 2.0 * exp(-pow(avg - mu, 2.0) / (2.0 * sig * sig)) - 1.0;
          float nextR = clamp(center.r + growth * 0.15, 0.0, 1.0);

          // ----------------------------------------------------
          // CHANNEL G: Abelian Sandpile Threshold Distribution
          // ----------------------------------------------------
          float n = texture(u_state, fract(vUv + vec2(0.0, texel.y))).g;
          float s = texture(u_state, fract(vUv - vec2(0.0, texel.y))).g;
          float e = texture(u_state, fract(vUv + vec2(texel.x, 0.0))).g;
          float w_cell = texture(u_state, fract(vUv - vec2(texel.x, 0.0))).g;

          float topples = floor(center.g / 4.0);
          float inflow = floor(n / 4.0) + floor(s / 4.0) + floor(e / 4.0) + floor(w_cell / 4.0);
          float nextG = center.g - 4.0 * topples + inflow;
          
          // Rain drops (Self-Organized Criticality trigger)
          if(hash(vUv + u_time) > 0.9999) nextG += 2.0;

          // ----------------------------------------------------
          // INTERACTION & CORRUPTION
          // ----------------------------------------------------
          float dist = length(vUv - u_mouse);
          if (dist < 0.04 && u_mouse_pressed > 0.5) {
            nextR += 0.8;
            nextG += 5.0; // Trigger sandpile avalanche
          }

          // ----------------------------------------------------
          // CHANNEL B: GeoCities Web-1.0 Ghost Map
          // ----------------------------------------------------
          float nextB = center.b * 0.98; // slow fade
          // Random popups appearing
          if(hash(vUv * 5.0 + floor(u_time * 2.0)) > 0.995) nextB = 1.0;

          // ----------------------------------------------------
          // CHANNEL A: Shoegaze Afterimage / Temporal Echo
          // ----------------------------------------------------
          float nextA = max(nextR, center.a * 0.94);

          fragColor = vec4(nextR, nextG, nextB, nextA);
        }
      `
    });

    // =========================================================================
    // PASS 2: RENDER COMPOSITE (Moiré + Glitchcore + CRT + VHS)
    // =========================================================================
    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_sim: { value: null },
        u_res: { value: new THREE.Vector2(w, h) },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D u_sim;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

        // --- LAYER A: Moiré Interference Background ---
        float moire(vec2 uv, float t) {
          vec2 p = (uv - 0.5) * 2.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          // Two slightly offset sinusoidal gratings
          float g1 = sin(r * 150.0 - t * 3.0);
          float g2 = sin(r * 145.0 + a * 6.0 + t * 1.5);
          return smoothstep(0.0, 0.8, g1 * g2);
        }

        // --- LAYER C: Early Internet Interface Ghosts ---
        vec3 uiGhosts(vec2 uv, float t, float trigger) {
          // Macroblock quantize for glitchy web frames
          vec2 gv = fract(uv * 4.0 + floor(t * 1.5) * 0.1);
          vec2 id = floor(uv * 4.0 + floor(t * 1.5) * 0.1);
          
          // Draw a classic Win95 / GeoCities window shape
          float win = step(0.1, gv.x) * step(0.1, gv.y) * step(gv.x, 0.9) * step(gv.y, 0.9);
          float titleBar = step(0.75, gv.y) * win;
          float bevelLight = step(0.1, gv.x) * step(gv.x, 0.15) * win + step(0.85, gv.y) * win;
          
          vec3 winColor = mix(vec3(0.7, 0.7, 0.8), vec3(0.0, 0.0, 0.5), titleBar);
          winColor += vec3(0.3) * bevelLight;
          
          // Only show where the B channel (trigger) is high
          float visibility = smoothstep(0.5, 1.0, trigger) * win;
          
          // Glitchcore text debris (fbm lines)
          float textLines = step(0.5, sin(gv.y * 50.0)) * step(0.2, gv.x) * step(gv.x, 0.8) * step(0.2, gv.y) * step(gv.y, 0.7);
          winColor = mix(winColor, vec3(0.0), textLines * 0.5);

          return winColor * visibility;
        }

        // --- LAYER D: CRT / VHS Envelope ---
        vec2 distort(vec2 uv, float t) {
          vec2 cc = uv - 0.5;
          float r2 = dot(cc, cc);
          vec2 d = uv + cc * r2 * 0.15; // Barrel distortion
          
          // VHS Tracking tear
          float tearY = fract(t * 0.2);
          float tear = exp(-pow(d.y - tearY, 2.0) / 0.002);
          d.x += tear * 0.08 * sin(d.y * 150.0 + t * 50.0);
          
          // Glitchcore Macroblock Breakup
          vec2 blockUv = floor(d * 15.0) / 15.0;
          if(hash(blockUv + floor(t * 8.0)) > 0.96) {
             d.x += 0.03 * sin(t * 10.0);
          }
          return d;
        }

        void main() {
          vec2 uv = distort(vUv, u_time);
          vec2 texel = 1.0 / u_res;

          // Anaglyph Stereo / Chromatic Aberration sampling of SIM
          float shift = 0.003 + length(uv - u_mouse) * 0.015;
          vec4 simR = texture(u_sim, uv + vec2(shift, 0.0));
          vec4 simG = texture(u_sim, uv);
          vec4 simB = texture(u_sim, uv - vec2(shift, 0.0));

          // ----------------------------------------------------
          // COMPOSITING LAYERS
          // ----------------------------------------------------

          // LAYER A: Signal Cathedral Background
          float m = moire(uv, u_time);
          vec3 bgColor = mix(vec3(0.05, 0.0, 0.15), vec3(0.9, 0.0, 0.5), m * 0.4); // Deep violet to hot magenta
          bgColor += vec3(0.0, 0.8, 1.0) * sin(uv.y * 40.0 + u_time * 2.0) * 0.15; // Cyan banded wash

          // LAYER B: Living Math Engine
          // Sandpile discrete mapping (mod 4 for the fractal look)
          float sand = mod(simG.g, 4.0);
          vec3 sandCol = vec3(0.0);
          if (sand < 1.0) sandCol = vec3(0.0); // Transparent/background
          else if (sand < 2.0) sandCol = vec3(0.0, 1.0, 0.8); // Electric Cyan
          else if (sand < 3.0) sandCol = vec3(1.0, 0.0, 0.6); // Hot Pink
          else sandCol = vec3(1.0, 0.9, 0.0); // Acid Yellow

          // Lenia soft life mapped to hyperpop bloom
          vec3 leniaCol = mix(vec3(0.0), vec3(1.0, 0.3, 0.8), simR.r * 2.0);
          
          // Shoegaze Afterimage Trail
          vec3 trailCol = vec3(0.8, 0.2, 1.0) * simG.a * 0.8;

          vec3 mathCol = max(sandCol, leniaCol) + trailCol;

          // LAYER C: Early Internet Ghosts
          vec3 uiCol = uiGhosts(uv, u_time, simG.b);

          // Combine Layers
          vec3 finalColor = bgColor + mathCol + uiCol;

          // ----------------------------------------------------
          // LAYER D: CRT / VHS Finishers
          // ----------------------------------------------------
          
          // Shoegaze / Bloom Halation
          vec3 blur = texture(u_sim, uv + vec2(0.01)).rgb * 0.33 + 
                      texture(u_sim, uv - vec2(0.01)).rgb * 0.33 + 
                      texture(u_sim, uv + vec2(0.01, -0.01)).rgb * 0.33;
          finalColor += blur * vec3(1.0, 0.4, 0.8) * 0.4; // Luminous overspill

          // Scanlines
          float scan = sin(uv.y * u_res.y * 3.14159) * 0.5 + 0.5;
          finalColor *= 1.0 - 0.2 * (1.0 - scan);

          // Phosphor Triad Subpixels
          float px = mod(gl_FragCoord.x, 3.0);
          vec3 mask = vec3(
            step(px, 1.0),
            step(abs(px - 1.0), 0.5),
            step(2.0, px)
          );
          finalColor *= mix(vec3(1.0), mask, 0.35);

          // Trinitron Damper Wires
          float wire = exp(-pow(uv.y - 0.33, 2.0)/0.00005) + exp(-pow(uv.y - 0.66, 2.0)/0.00005);
          finalColor *= 1.0 - 0.4 * wire;

          // Dead Pixels behaving like Pollen (Feral Design Rule)
          float pollen = step(0.9995, hash(uv + u_time * 0.1));
          finalColor = mix(finalColor, vec3(1.0, 1.0, 0.0), pollen * simG.r);

          // Vignette
          float vig = length(vUv - 0.5);
          finalColor *= smoothstep(0.8, 0.3, vig);

          fragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const simScene = new THREE.Scene();
    simScene.add(new THREE.Mesh(quadGeo, simMat));

    const renderScene = new THREE.Scene();
    renderScene.add(new THREE.Mesh(quadGeo, renderMat));

    canvas.__three = {
      renderer,
      camera,
      fboA,
      fboB,
      simMat,
      renderMat,
      simScene,
      renderScene
    };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    throw e;
  }
}

const { renderer, camera, fboA, fboB, simMat, renderMat, simScene, renderScene } = canvas.__three;

// Update uniform values
const normMouseX = mouse.x / grid.width;
const normMouseY = 1.0 - (mouse.y / grid.height);

simMat.uniforms.u_time.value = time;
simMat.uniforms.u_res.value.set(grid.width, grid.height);
simMat.uniforms.u_mouse.value.set(normMouseX, normMouseY);
simMat.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;

renderMat.uniforms.u_time.value = time;
renderMat.uniforms.u_res.value.set(grid.width, grid.height);
renderMat.uniforms.u_mouse.value.set(normMouseX, normMouseY);

// Match render size
renderer.setSize(grid.width, grid.height, false);

// -----------------------------------------------------------------------------
// PING PONG SIMULATION PASS
// -----------------------------------------------------------------------------
// Read from A, write to B
simMat.uniforms.u_state.value = fboA.texture;
renderer.setRenderTarget(fboB);
renderer.render(simScene, camera);

// Swap buffers
canvas.__three.fboA = fboB;
canvas.__three.fboB = fboA;

// -----------------------------------------------------------------------------
// RENDER TO SCREEN PASS
// -----------------------------------------------------------------------------
// Read from B, output to canvas
renderMat.uniforms.u_sim.value = fboB.texture;
renderer.setRenderTarget(null);
renderer.render(renderScene, camera);