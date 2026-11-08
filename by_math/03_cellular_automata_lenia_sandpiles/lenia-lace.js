try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  // Re-initialize if canvas size changed or first run
  if (!canvas.__three || canvas.__three.width !== grid.width || canvas.__three.height !== grid.height) {
    if (canvas.__three) {
      canvas.__three.renderer.dispose();
      canvas.__three.fboA.dispose();
      canvas.__three.fboB.dispose();
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: false, antialias: false });
    renderer.setSize(grid.width, grid.height, false);
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const fboOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    };

    const fboA = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);
    const fboB = new THREE.WebGLRenderTarget(grid.width, grid.height, fboOpts);

    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // 1. SEED SHADER: Generates the initial Quasicrystal / Tessellation brocade
    const seedMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_res: { value: new THREE.Vector2(grid.width, grid.height) } },
      vertexShader: `
        out vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        uniform vec2 u_res;
        
        void main() {
            vec2 p = vUv * 2.0 - 1.0;
            p.x *= u_res.x / u_res.y;
            
            // p6m Quasicrystal Fold
            float a = atan(p.y, p.x);
            float r = length(p);
            float a6 = mod(a, 1.0471975); // PI/3
            a6 = abs(a6 - 0.5235987);
            vec2 pfold = r * vec2(cos(a6), sin(a6));
            
            // Interference patterns
            float v1 = sin(pfold.x * 60.0) + sin(dot(pfold, vec2(0.5, 0.866025)) * 60.0) + sin(dot(pfold, vec2(-0.5, 0.866025)) * 60.0);
            float v2 = sin(pfold.x * 25.0) + sin(dot(pfold, vec2(0.5, 0.866025)) * 25.0) + sin(dot(pfold, vec2(-0.5, 0.866025)) * 25.0);
            
            float u = 1.0; // RD substrate
            float v = step(1.0, v1) * exp(-r * r * 3.0); // RD inhibitor
            float lenia = step(1.2, v2) * step(r, 0.9); // CA organisms
            
            fragColor = vec4(u, v, lenia, 0.0);
        }
      `
    });

    // 2. SIMULATION SHADER: Coupled Lenia (Continuous CA) + Gray-Scott (Reaction-Diffusion)
    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform float u_time;

        // Lenia Morphogenesis Parameters
        const float R = 14.0;
        const float mu_k = 0.5;
        const float sigma_k = 0.15;
        const float sigma_g = 0.017;
        
        float kWeight(float r) {
            float kr = r / R - mu_k;
            return exp(-(kr * kr) / (2.0 * sigma_k * sigma_k));
        }
        
        void main() {
            vec2 texel = 1.0 / u_res;
            
            // Fungal Domain Warp: slowly advect the field to create creeping growth
            vec2 warp = vec2(sin(vUv.y * 12.0 + u_time), cos(vUv.x * 12.0 - u_time)) * 0.0005;
            vec2 uv = fract(vUv - warp);

            vec4 state = texture(u_state, uv);
            
            // --- REACTION DIFFUSION (Channels R, G) ---
            vec2 v_n = texture(u_state, fract(uv + vec2(0.0, 1.0)*texel)).xy;
            vec2 v_s = texture(u_state, fract(uv + vec2(0.0, -1.0)*texel)).xy;
            vec2 v_e = texture(u_state, fract(uv + vec2(1.0, 0.0)*texel)).xy;
            vec2 v_w = texture(u_state, fract(uv + vec2(-1.0, 0.0)*texel)).xy;
            vec2 v_ne = texture(u_state, fract(uv + vec2(1.0, 1.0)*texel)).xy;
            vec2 v_nw = texture(u_state, fract(uv + vec2(-1.0, 1.0)*texel)).xy;
            vec2 v_se = texture(u_state, fract(uv + vec2(1.0, -1.0)*texel)).xy;
            vec2 v_sw = texture(u_state, fract(uv + vec2(-1.0, -1.0)*texel)).xy;
            
            vec2 lap = 0.2 * (v_n + v_s + v_e + v_w) + 0.05 * (v_ne + v_nw + v_se + v_sw) - 1.0 * state.xy;

            float u_val = state.x;
            float v_val = state.y;
            float uvv = u_val * v_val * v_val;
            
            // Symbiotic coupling: Lenia presence (state.z) increases RD feed rate
            float F = 0.025 + 0.01 * sin(vUv.x * 20.0 + u_time) + state.z * 0.02;
            float k = 0.056 + state.w * 0.004;
            
            float du = 1.0 * lap.x - uvv + F * (1.0 - u_val);
            float dv = 0.5 * lap.y + uvv - (F + k) * v_val;

            // --- LENIA (Channel B) ---
            float sumA = 0.0;
            float wsum = 0.0;
            
            // Concentric ring sampling
            for(int ri = 1; ri <= 3; ri++) {
                float r = R * float(ri) / 3.0;
                float kw = kWeight(r) * r;
                int NA = 8 * ri;
                for(int ai = 0; ai < 24; ai++) {
                    if(ai >= NA) break;
                    float a = float(ai) * 6.2831853 / float(NA);
                    vec2 off = vec2(cos(a), sin(a)) * r * texel;
                    sumA += texture(u_state, fract(uv + off)).z * kw;
                    wsum += kw;
                }
            }
            sumA /= wsum;

            // Spatially varying biology: different regions support different organisms
            float local_mu_g = 0.13 + 0.04 * sin(vUv.x * 8.0) * cos(vUv.y * 8.0);
            float d = sumA - local_mu_g;
            float g = 2.0 * exp(-(d * d) / (2.0 * sigma_g * sigma_g)) - 1.0;
            
            // RD 'v' (lace) acts as a nutrient scaffold for Lenia
            float next_A = clamp(state.z + 0.1 * (g + v_val * 0.05), 0.0, 1.0);
            
            // Autophagic injection: rare chaotic sparks to prevent heat death
            float seed = fract(sin(dot(uv + u_time, vec2(127.1, 311.7))) * 43758.5453);
            if (seed > 0.99995) {
                next_A = 1.0;
                v_val = 1.0;
            }

            // --- MEMORY / TRACE (Channel A) ---
            float next_I = max(next_A, state.w * 0.985); // Fading ghost trail

            fragColor = vec4(clamp(u_val + du, 0.0, 1.0), clamp(v_val + dv, 0.0, 1.0), next_A, next_I);
        }
      `
    });

    // 3. RENDER SHADER: Transforms math into the "Delicious Weird" aesthetic
    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform float u_time;

        void main() {
            vec2 eps = 1.0 / u_res;
            
            // Calculate gradients for chromatic aberration and datamosh refraction
            float g1 = texture(u_state, vUv + vec2(eps.x, 0.0)).z - texture(u_state, vUv - vec2(eps.x, 0.0)).z;
            float g2 = texture(u_state, vUv + vec2(0.0, eps.y)).z - texture(u_state, vUv - vec2(0.0, eps.y)).z;
            vec2 grad = vec2(g1, g2);
            
            // Temporal Dragging: distort UVs using the memory trace channel
            float raw_trace = texture(u_state, vUv).w;
            vec2 mosh_uv = fract(vUv + grad * raw_trace * 0.1);
            
            vec4 s = texture(u_state, mosh_uv);
            vec4 s_r = texture(u_state, fract(mosh_uv + grad * 3.0));
            vec4 s_b = texture(u_state, fract(mosh_uv - grad * 3.0));

            float rd_v = s.y;
            float lenia = s.z;
            float trace = s.w;

            // Palette: Bright Luminous Substrate (No Black!)
            vec3 substrate = vec3(0.98, 0.95, 0.96); // Pale pinkish cream
            
            // Textile weave noise
            float weave = sin(vUv.x * u_res.x * 0.6) * sin(vUv.y * u_res.y * 0.6);
            substrate -= weave * 0.02;
            
            // Colors
            vec3 c_cyan = vec3(0.0, 0.9, 0.9);
            vec3 c_lavender = vec3(0.6, 0.4, 1.0);
            vec3 c_magenta = vec3(1.0, 0.0, 0.5);
            vec3 c_lemon = vec3(1.0, 1.0, 0.0);
            vec3 c_neon = vec3(0.2, 1.0, 0.2);

            vec3 col = substrate;
            
            // 1. RD Lace (Cyan to Lavender)
            float laceMask = smoothstep(0.1, 0.4, rd_v);
            vec3 laceColor = mix(c_cyan, c_lavender, rd_v * 2.0);
            col = mix(col, laceColor, laceMask * 0.85);

            // 2. Lenia Organisms (Magenta to Lemon)
            float orgMask = smoothstep(0.05, 0.7, lenia);
            vec3 orgColor = mix(c_magenta, c_lemon, lenia * 1.2);
            
            // Chromatic Aberration on Organism Edges
            orgColor.r += smoothstep(0.1, 0.8, s_r.z) * 0.6;
            orgColor.b += smoothstep(0.1, 0.8, s_b.z) * 0.6;
            
            col = mix(col, orgColor, orgMask);

            // 3. Scaffold / Memory Trace (Neon Green Glass)
            // Rendered only where the organism has passed, creating a glowing track
            float traceMask = smoothstep(0.1, 0.9, trace) * (1.0 - lenia);
            col = mix(col, c_neon, traceMask * 0.5);

            // 4. Heat Sparks / Glitter
            float spark = step(0.85, lenia) * step(0.96, fract(sin(dot(mosh_uv, vec2(12.9898, 78.233)) + u_time * 5.0) * 43758.5453));
            col += vec3(1.0, 0.6, 0.1) * spark * 2.0;

            // Subtle CRT Shimmer
            float scanline = sin(vUv.y * u_res.y * 3.14159) * 0.02;
            col -= scanline;

            // Soft Vignette
            vec2 vc = vUv - 0.5;
            col *= 1.0 - 0.3 * dot(vc, vc);

            fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(quadGeo, seedMat);
    scene.add(mesh);

    // Initial Seed Pass
    renderer.setRenderTarget(fboA);
    renderer.render(scene, camera);
    renderer.setRenderTarget(fboB);
    renderer.render(scene, camera);

    canvas.__three = {
      renderer, scene, camera, mesh,
      simMat, renderMat, fboA, fboB,
      ping: true,
      width: grid.width,
      height: grid.height
    };
  }

  const t = canvas.__three;
  
  // Update Uniforms
  if (t.simMat.uniforms) t.simMat.uniforms.u_time.value = time;
  if (t.renderMat.uniforms) t.renderMat.uniforms.u_time.value = time;

  // SIMULATION PASS
  t.mesh.material = t.simMat;
  t.simMat.uniforms.u_state.value = t.ping ? t.fboA.texture : t.fboB.texture;
  t.renderer.setRenderTarget(t.ping ? t.fboB : t.fboA);
  t.renderer.render(t.scene, t.camera);

  // RENDER PASS
  t.mesh.material = t.renderMat;
  t.renderMat.uniforms.u_state.value = t.ping ? t.fboB.texture : t.fboA.texture;
  t.renderer.setRenderTarget(null);
  t.renderer.render(t.scene, t.camera);

  // Swap buffers
  t.ping = !t.ping;

} catch (e) {
  console.error("WebGL Lenia Brocade Initialization Failed:", e);
}