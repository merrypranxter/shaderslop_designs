try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.autoClear = false;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const simScene = new THREE.Scene();
    const renderScene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    const fboOpts = {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };

    let fboA = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);
    let fboB = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);

    const simVert = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const simFrag = `
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;

      uniform sampler2D u_tex;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform vec2 u_mouseDir;
      uniform float u_isPressed;

      void main() {
        vec2 texel = 1.0 / u_res;

        // Initialization
        if (u_time < 0.2) {
          vec2 p = vUv * 6.0;
          float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
          float d = length(fract(p) - 0.5);
          float vInit = (d < 0.25) ? n * 0.8 : 0.0;
          fragColor = vec4(1.0, vInit, 0.0, 1.0);
          return;
        }

        vec4 c = texture(u_tex, vUv);
        float u = c.r;
        float v = c.g;
        vec2 nap = c.ba;

        // 9-tap Laplacian for smoother, Lenia-like organic curves
        vec2 N = vec2(0.0, texel.y);
        vec2 E = vec2(texel.x, 0.0);
        vec2 S = vec2(0.0, -texel.y);
        vec2 W = vec2(-texel.x, 0.0);
        vec2 NE = vec2(texel.x, texel.y);
        vec2 NW = vec2(-texel.x, texel.y);
        vec2 SE = vec2(texel.x, -texel.y);
        vec2 SW = vec2(-texel.x, -texel.y);

        float lapU = texture(u_tex, vUv + N).r + texture(u_tex, vUv + S).r +
                     texture(u_tex, vUv + E).r + texture(u_tex, vUv + W).r +
                     0.5 * (texture(u_tex, vUv + NE).r + texture(u_tex, vUv + NW).r +
                            texture(u_tex, vUv + SE).r + texture(u_tex, vUv + SW).r) - 6.0 * u;

        float lapV = texture(u_tex, vUv + N).g + texture(u_tex, vUv + S).g +
                     texture(u_tex, vUv + E).g + texture(u_tex, vUv + W).g +
                     0.5 * (texture(u_tex, vUv + NE).g + texture(u_tex, vUv + NW).g +
                            texture(u_tex, vUv + SE).g + texture(u_tex, vUv + SW).g) - 6.0 * v;

        // Gray-Scott parameters tuned for intricate Damask mazes
        float Du = 0.209;
        float Dv = 0.105;
        float F = 0.026;
        float K = 0.053;

        float uvv = u * v * v;
        float du = Du * lapU - uvv + F * (1.0 - u);
        float dv = Dv * lapV + uvv - (F + K) * v;

        u += du * 1.2;
        v += dv * 1.2;

        // Enforce Damask Symmetry (Wallpaper P4M-ish constraints)
        vec2 tileUv = fract(vUv * 2.0);
        vec2 localMirrorUv = abs(tileUv * 2.0 - 1.0); 
        vec2 globalMirrorUv = (floor(vUv * 2.0) + localMirrorUv) / 2.0;
        vec4 tileSym = texture(u_tex, globalMirrorUv);
        
        vec2 globalSymUv = abs(vUv * 2.0 - 1.0);
        vec4 globSym = texture(u_tex, globalSymUv);

        // Gently pull the simulation toward symmetry to maintain textile structure
        u = mix(u, (tileSym.r + globSym.r) * 0.5, 0.008);
        v = mix(v, (tileSym.g + globSym.g) * 0.5, 0.008);

        // Mouse brush interaction (disturbs organisms and sets velvet nap)
        if (u_isPressed > 0.5) {
            vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
            float dist = length((vUv - u_mouse) * aspect);
            if (dist < 0.04) {
                v = min(v + 0.4, 1.0);
                vec2 targetNap = length(u_mouseDir) > 0.0001 ? normalize(u_mouseDir) : vec2(0.0, 1.0);
                nap = mix(nap, targetNap, 0.15);
            }
        }

        // Slowly relax nap back to default downward direction
        nap = normalize(mix(nap, vec2(0.0, -1.0), 0.005));

        fragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), nap.x, nap.y);
      }
    `;

    const renderFrag = `
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;

      uniform sampler2D u_tex;
      uniform vec2 u_res;
      uniform float u_time;

      void main() {
        vec2 texel = 1.0 / u_res;
        vec4 state = texture(u_tex, vUv);
        float u = state.r;
        float v = state.g;
        vec2 nap = state.ba;

        // Calculate surface normal from CA inhibitor gradient
        float vN = texture(u_tex, vUv + vec2(0.0, texel.y)).g;
        float vS = texture(u_tex, vUv - vec2(0.0, texel.y)).g;
        float vE = texture(u_tex, vUv + vec2(texel.x, 0.0)).g;
        float vW = texture(u_tex, vUv - vec2(texel.x, 0.0)).g;

        vec3 N = normalize(vec3((vW - vE) * 15.0, (vS - vN) * 15.0, 1.0));
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 L = normalize(vec3(0.3, 0.5, 0.8)); 

        // Velvet Anisotropy: shift normal by the nap direction
        vec3 shiftedN = normalize(N + vec3(nap.x, nap.y, 0.0) * 0.6);
        float NdotV = max(dot(N, V), 0.0);
        float shiftedNdotV = max(dot(shiftedN, V), 0.0);

        // Velvet Rim lighting (brightest at grazing angles relative to nap)
        float rim = pow(1.0 - shiftedNdotV, 2.2);
        float diffuse = max(dot(N, L), 0.0);
        float spec = pow(max(dot(reflect(-L, shiftedN), V), 0.0), 16.0);

        // Palette
        vec3 colBase = vec3(0.06, 0.01, 0.15);  // Deep UV velvet
        vec3 colRim  = vec3(0.4, 0.0, 0.8);     // Violet sheen
        vec3 colMotif = vec3(1.0, 0.0, 0.5);    // Hot magenta
        vec3 colHalo  = vec3(0.0, 0.9, 1.0);    // Cyan halo
        
        // Biological activity markers
        float rate = u * v * v;
        vec3 colGrowth = mix(vec3(0.6, 1.0, 0.0), vec3(1.0, 0.6, 0.0), smoothstep(0.002, 0.015, rate));

        // Masks
        float motifMask = smoothstep(0.15, 0.4, v);
        float haloMask = smoothstep(0.4, 0.1, u) * (1.0 - motifMask);
        float flashMask = smoothstep(0.001, 0.01, rate) * motifMask;

        // Composition
        vec3 albedo = colBase;
        albedo = mix(albedo, colHalo, haloMask * 0.7);
        albedo = mix(albedo, colMotif, motifMask);
        albedo = mix(albedo, colGrowth, flashMask);

        // Lighting application
        vec3 color = albedo * (diffuse * 0.5 + 0.5) + colRim * rim * 1.5 + spec * flashMask;

        // Sparkle Dust (Microfacets on raised pile)
        vec2 seed = vUv * u_res;
        float noise = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
        float sparkThresh = 0.97 - (shiftedNdotV * 0.02);
        float sparkle = step(sparkThresh, noise) * pow(shiftedNdotV, 3.0) * smoothstep(0.1, 0.6, v);
        color += vec3(1.0, 0.9, 1.0) * sparkle * 2.5;

        // Vignette
        color *= smoothstep(0.0, 1.0, 1.2 - length(vUv - 0.5) * 0.8);

        fragColor = vec4(color, 1.0);
      }
    `;

    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: simVert,
      fragmentShader: simFrag,
      uniforms: {
        u_tex: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouseDir: { value: new THREE.Vector2(0, 0) },
        u_isPressed: { value: 0 }
      }
    });

    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: simVert,
      fragmentShader: renderFrag,
      uniforms: {
        u_tex: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      }
    });

    const simMesh = new THREE.Mesh(geometry, simMat);
    simScene.add(simMesh);

    const renderMesh = new THREE.Mesh(geometry, renderMat);
    renderScene.add(renderMesh);

    canvas.__three = {
      renderer, camera, simScene, renderScene, simMat, renderMat,
      fboA, fboB,
      mouseState: { last: new THREE.Vector2(0.5, 0.5) }
    };
  }

  const { renderer, camera, simScene, renderScene, simMat, renderMat, mouseState } = canvas.__three;
  let { fboA, fboB } = canvas.__three;

  if (fboA.width !== grid.width || fboA.height !== grid.height) {
    fboA.setSize(grid.width, grid.height);
    fboB.setSize(grid.width, grid.height);
    simMat.uniforms.u_res.value.set(grid.width, grid.height);
    renderMat.uniforms.u_res.value.set(grid.width, grid.height);
  }

  const currentMouse = new THREE.Vector2(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
  const mouseDir = new THREE.Vector2().subVectors(currentMouse, mouseState.last);
  mouseState.last.copy(currentMouse);

  simMat.uniforms.u_time.value = time;
  simMat.uniforms.u_mouse.value = currentMouse;
  simMat.uniforms.u_mouseDir.value = mouseDir;
  simMat.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
  simMat.uniforms.u_tex.value = fboA.texture;

  renderer.setRenderTarget(fboB);
  renderer.render(simScene, camera);

  canvas.__three.fboA = fboB;
  canvas.__three.fboB = fboA;

  renderMat.uniforms.u_time.value = time;
  renderMat.uniforms.u_tex.value = fboB.texture;

  renderer.setRenderTarget(null);
  renderer.render(renderScene, camera);

} catch (e) {
  console.error("Lenia Velvet Damask Initialization Failed:", e);
}