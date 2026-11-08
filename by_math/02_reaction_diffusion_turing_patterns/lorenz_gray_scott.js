if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: false, antialias: false });
    renderer.setPixelRatio(1.0);
    renderer.setSize(grid.width, grid.height, false);
    renderer.autoClear = false;

    // ─── RESOLUTIONS ──────────────────────────────────────────────
    const SIM_RES = 512;       // Gray-Scott & Decay resolution
    const PART_RES = 64;       // 64x64 = 4096 particles for thick Lorenz brush

    // ─── RENDER TARGETS ───────────────────────────────────────────
    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType, // WebGL2 supports Float32 FBOs natively
      depthBuffer: false,
      stencilBuffer: false,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    };

    // Particle Ping-Pong (Position)
    const rtPart = [
      new THREE.WebGLRenderTarget(PART_RES, PART_RES, rtOpts),
      new THREE.WebGLRenderTarget(PART_RES, PART_RES, rtOpts)
    ];
    // Particle Render Canvas
    const rtDraw = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts);
    // Decay Ping-Pong (Ghost Trails)
    const rtDecay = [
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts),
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts)
    ];
    // Gray-Scott Ping-Pong (U/V)
    const rtGS = [
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts),
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts)
    ];

    // ─── SCENES & CAMERAS ─────────────────────────────────────────
    const sceneQuad = new THREE.Scene();
    const cameraQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const scenePart = new THREE.Scene();

    // ─── INITIALIZATION DATA ──────────────────────────────────────
    const blitToFBO = (dataArray, width, height, target) => {
      const tex = new THREE.DataTexture(dataArray, width, height, THREE.RGBAFormat, THREE.FloatType);
      tex.needsUpdate = true;
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { u_tex: { value: tex } },
        vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `precision highp float; uniform sampler2D u_tex; in vec2 vUv; out vec4 fragColor; void main() { fragColor = texture(u_tex, vUv); }`,
        depthWrite: false, depthTest: false
      });
      const mesh = new THREE.Mesh(quadGeo, mat);
      const tempScene = new THREE.Scene();
      tempScene.add(mesh);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(tempScene, cameraQuad);
      mat.dispose();
      tex.dispose();
    };

    // Init Particles: cluster near Lorenz origin (0.1, 0.1, 0.1)
    const partData = new Float32Array(PART_RES * PART_RES * 4);
    for (let i = 0; i < partData.length; i += 4) {
      partData[i]     = 0.1 + (Math.random() - 0.5) * 0.5;
      partData[i + 1] = 0.1 + (Math.random() - 0.5) * 0.5;
      partData[i + 2] = 0.1 + (Math.random() - 0.5) * 0.5;
      partData[i + 3] = 1.0;
    }
    blitToFBO(partData, PART_RES, PART_RES, rtPart[0]);

    // Init Gray-Scott: purely U=1.0, V=0.0 (The attractor will seed it)
    const gsData = new Float32Array(SIM_RES * SIM_RES * 4);
    for (let i = 0; i < gsData.length; i += 4) {
      gsData[i]     = 1.0; // U
      gsData[i + 1] = 0.0; // V
      gsData[i + 2] = 0.0;
      gsData[i + 3] = 1.0;
    }
    blitToFBO(gsData, SIM_RES, SIM_RES, rtGS[0]);

    // ─── SHADERS ──────────────────────────────────────────────────
    const vertQuad = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // 1. Particle Update (Lorenz Math)
    const matPartUpdate = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_pos: { value: null }, u_dt: { value: 0.006 } },
      vertexShader: vertQuad,
      fragmentShader: `
        precision highp float;
        uniform sampler2D u_pos;
        uniform float u_dt;
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          vec3 p = texture(u_pos, vUv).xyz;
          float dx = 10.0 * (p.y - p.x);
          float dy = p.x * (28.0 - p.z) - p.y;
          float dz = p.x * p.y - 2.66666 * p.z;
          p += vec3(dx, dy, dz) * u_dt;
          fragColor = vec4(p, 1.0);
        }
      `
    });
    const meshPartUpdate = new THREE.Mesh(quadGeo, matPartUpdate);

    // 2. Particle Draw
    const partGeo = new THREE.BufferGeometry();
    const posUV = new Float32Array(PART_RES * PART_RES * 3);
    for (let y = 0; y < PART_RES; y++) {
      for (let x = 0; x < PART_RES; x++) {
        let idx = (y * PART_RES + x) * 3;
        posUV[idx] = (x + 0.5) / PART_RES;
        posUV[idx + 1] = (y + 0.5) / PART_RES;
        posUV[idx + 2] = 0.0;
      }
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(posUV, 3));

    const matPartDraw = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_pos: { value: null } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexShader: `
        uniform sampler2D u_pos;
        void main() {
          vec3 p = texture(u_pos, position.xy).xyz;
          // Map Lorenz XZ plane to Screen UV
          vec2 screenPos = vec2(p.x, p.z - 24.0) * 0.045;
          gl_Position = vec4(screenPos, 0.0, 1.0);
          gl_PointSize = 2.0;
        }
      `,
      fragmentShader: `
        precision highp float;
        out vec4 fragColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if(dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist) * 0.15;
          fragColor = vec4(vec3(1.0), alpha);
        }
      `
    });
    const pointsPart = new THREE.Points(partGeo, matPartDraw);
    scenePart.add(pointsPart);

    // 3. Decay Shader (Ghost Trails)
    const matDecay = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_curr: { value: null }, u_prev: { value: null } },
      vertexShader: vertQuad,
      fragmentShader: `
        precision highp float;
        uniform sampler2D u_curr;
        uniform sampler2D u_prev;
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          vec4 curr = texture(u_curr, vUv);
          vec4 prev = texture(u_prev, vUv);
          // Multiply previous frame by 0.97
          fragColor = curr + prev * 0.97;
        }
      `
    });
    const meshDecay = new THREE.Mesh(quadGeo, matDecay);

    // 4. Gray-Scott Shader (Coral Preset: F=0.0545, k=0.062)
    const matGS = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_state: { value: null }, u_seed: { value: null }, u_res: { value: new THREE.Vector2(SIM_RES, SIM_RES) } },
      vertexShader: vertQuad,
      fragmentShader: `
        precision highp float;
        uniform sampler2D u_state;
        uniform sampler2D u_seed;
        uniform vec2 u_res;
        in vec2 vUv;
        out vec4 fragColor;

        vec2 laplacian(sampler2D tex, vec2 uv, vec2 texel) {
          vec2 sum = vec2(0.0);
          sum += texture(tex, uv + vec2(-1.0, 0.0) * texel).rg * 0.2;
          sum += texture(tex, uv + vec2( 1.0, 0.0) * texel).rg * 0.2;
          sum += texture(tex, uv + vec2( 0.0,-1.0) * texel).rg * 0.2;
          sum += texture(tex, uv + vec2( 0.0, 1.0) * texel).rg * 0.2;
          sum += texture(tex, uv + vec2(-1.0,-1.0) * texel).rg * 0.05;
          sum += texture(tex, uv + vec2( 1.0,-1.0) * texel).rg * 0.05;
          sum += texture(tex, uv + vec2(-1.0, 1.0) * texel).rg * 0.05;
          sum += texture(tex, uv + vec2( 1.0, 1.0) * texel).rg * 0.05;
          sum -= texture(tex, uv).rg;
          return sum;
        }

        void main() {
          vec2 texel = 1.0 / u_res;
          vec2 state = texture(u_state, vUv).rg;
          float u = state.r;
          float v = state.g;
          
          vec2 lap = laplacian(u_state, vUv, texel);
          float reaction = u * v * v;
          
          // Coral preset
          float F = 0.0545;
          float k = 0.062;
          
          float du = 1.0 * lap.r - reaction + F * (1.0 - u);
          float dv = 0.5 * lap.g + reaction - (F + k) * v;
          
          u += du;
          v += dv;
          
          // Inject seed from Attractor Ghost Trail
          float seed = texture(u_seed, vUv).r;
          if (seed > 0.02) {
            v = min(1.0, v + seed * 0.05);
            u = max(0.0, u - seed * 0.05);
          }
          
          fragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
        }
      `
    });
    const meshGS = new THREE.Mesh(quadGeo, matGS);

    // 5. Composite Shader
    const matComp = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_gs: { value: null }, u_decay: { value: null } },
      vertexShader: vertQuad,
      fragmentShader: `
        precision highp float;
        uniform sampler2D u_gs;
        uniform sampler2D u_decay;
        in vec2 vUv;
        out vec4 fragColor;

        void main() {
          vec2 gs = texture(u_gs, vUv).rg;
          float v = gs.g;
          float decay = texture(u_decay, vUv).r;
          
          // Neon Green (#39FF14)
          vec3 neon = vec3(0.224, 1.0, 0.078);
          vec3 bg = vec3(0.02, 0.02, 0.04);
          
          // Ghostly Underpainting
          vec3 underpaint = mix(bg, neon, clamp(decay * 0.8, 0.0, 1.0));
          
          // GS Coral Surface
          vec3 coralDark = vec3(0.25, 0.05, 0.1);
          vec3 coralLight = vec3(1.0, 0.45, 0.35);
          vec3 coralColor = mix(coralDark, coralLight, smoothstep(0.1, 0.4, v));
          
          // Opacity of GS layer based on V concentration
          float gsAlpha = smoothstep(0.05, 0.25, v);
          
          vec3 finalColor = mix(underpaint, coralColor, gsAlpha);
          
          // Ensure ~15% neon glow persists strictly on top
          finalColor += neon * decay * 0.15;
          
          fragColor = vec4(finalColor, 1.0);
        }
      `
    });
    const meshComp = new THREE.Mesh(quadGeo, matComp);

    // Context persistence
    canvas.__three = {
      renderer, sceneQuad, scenePart, cameraQuad,
      rtPart, rtDraw, rtDecay, rtGS,
      meshPartUpdate, meshDecay, meshGS, meshComp,
      stepPart: 0, stepDecay: 0, stepGS: 0
    };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const sys = canvas.__three;
if (!sys) return;

sys.renderer.setSize(grid.width, grid.height, false);

// 1. Particle Update (Lorenz Step)
// Do 2 sub-steps per frame to draw a longer line segment
for (let i = 0; i < 2; i++) {
  const rP = sys.stepPart % 2;
  const wP = (sys.stepPart + 1) % 2;
  sys.meshPartUpdate.material.uniforms.u_pos.value = sys.rtPart[rP].texture;
  sys.sceneQuad.children = [sys.meshPartUpdate];
  sys.renderer.setRenderTarget(sys.rtPart[wP]);
  sys.renderer.render(sys.sceneQuad, sys.cameraQuad);
  sys.stepPart++;
}

// 2. Particle Draw
sys.renderer.setClearColor(0x000000, 1.0);
sys.renderer.setRenderTarget(sys.rtDraw);
sys.renderer.clear();
sys.scenePart.children[0].material.uniforms.u_pos.value = sys.rtPart[sys.stepPart % 2].texture;
sys.renderer.render(sys.scenePart, sys.cameraQuad);

// 3. Decay Pass (Ghost Trails)
const rD = sys.stepDecay % 2;
const wD = (sys.stepDecay + 1) % 2;
sys.meshDecay.material.uniforms.u_curr.value = sys.rtDraw.texture;
sys.meshDecay.material.uniforms.u_prev.value = sys.rtDecay[rD].texture;
sys.sceneQuad.children = [sys.meshDecay];
sys.renderer.setRenderTarget(sys.rtDecay[wD]);
sys.renderer.render(sys.sceneQuad, sys.cameraQuad);
sys.stepDecay++;

// 4. Gray-Scott Simulation Steps
// 12 steps per frame to evolve the coral structure visibly
for (let i = 0; i < 12; i++) {
  const rGS = sys.stepGS % 2;
  const wGS = (sys.stepGS + 1) % 2;
  sys.meshGS.material.uniforms.u_state.value = sys.rtGS[rGS].texture;
  sys.meshGS.material.uniforms.u_seed.value = sys.rtDecay[wD].texture;
  sys.sceneQuad.children = [sys.meshGS];
  sys.renderer.setRenderTarget(sys.rtGS[wGS]);
  sys.renderer.render(sys.sceneQuad, sys.cameraQuad);
  sys.stepGS++;
}

// 5. Composite to Screen
sys.meshComp.material.uniforms.u_gs.value = sys.rtGS[sys.stepGS % 2].texture;
sys.meshComp.material.uniforms.u_decay.value = sys.rtDecay[sys.stepDecay % 2].texture;
sys.sceneQuad.children = [sys.meshComp];
sys.renderer.setRenderTarget(null);
sys.renderer.render(sys.sceneQuad, sys.cameraQuad);