try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const SIM_RES = 512;
    const rtOpts = {
      width: SIM_RES,
      height: SIM_RES,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false
    };

    const rtA = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts);
    const rtB = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts);

    const seedMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          vec2 uv = vUv;
          float valR = 0.0;
          float valG = 0.0;
          float valB = 0.0;
          float R0 = 0.035;
          
          for(int i=0; i<12; i++) {
            float fi = float(i);
            float angle = fi / 12.0 * 6.2831853;
            vec2 c = vec2(0.5) + 0.15 * vec2(cos(angle), sin(angle));
            float r = length(uv - c);
            float blob = exp(-(r*r)/(2.0*R0*R0));
            valR += blob;
            valG += blob * 0.15;
            valB += blob * 0.15;
          }
          
          for(int i=0; i<6; i++) {
            float fi = float(i);
            vec2 c = vec2(
              fract(sin(fi*1.123) * 43758.5),
              fract(sin(fi*1.345) * 43758.5)
            );
            float r = length(uv - c);
            float blob = exp(-(r*r)/(2.0*R0*R0));
            valR += blob;
          }
          
          fragColor = vec4(clamp(valR, 0.0, 1.0), clamp(valG, 0.0, 1.0), clamp(valB, 0.0, 1.0), clamp(valR, 0.0, 1.0));
        }
      `
    });

    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_time: { value: 0.0 },
        u_res: { value: new THREE.Vector2(SIM_RES, SIM_RES) },
        u_dt: { value: 0.15 },
        u_radii: { value: new THREE.Vector3(13.0, 9.0, 21.0) },
        u_mu_k: { value: 0.5 },
        u_sig_k: { value: 0.15 },
        u_mu_g: { value: new THREE.Vector3(0.15, 0.14, 0.13) },
        u_sig_g: { value: new THREE.Vector3(0.015, 0.018, 0.016) },
        u_W0: { value: new THREE.Vector3(1.0, 0.2, -0.5) },
        u_W1: { value: new THREE.Vector3(0.5, 1.0, 0.0) },
        u_W2: { value: new THREE.Vector3(0.0, 0.8, 1.0) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouse_pressed: { value: 0.0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform sampler2D u_state;
        uniform float u_time;
        uniform vec2 u_res;
        uniform float u_dt;
        uniform vec3 u_radii;
        uniform float u_mu_k;
        uniform float u_sig_k;
        uniform vec3 u_mu_g;
        uniform vec3 u_sig_g;
        uniform vec3 u_W0;
        uniform vec3 u_W1;
        uniform vec3 u_W2;
        uniform vec2 u_mouse;
        uniform float u_mouse_pressed;
        
        vec3 grow(vec3 u) {
          vec3 d = u - u_mu_g;
          return 2.0 * exp(-(d * d) / (2.0 * u_sig_g * u_sig_g)) - 1.0;
        }
        
        void main() {
          vec4 state = texture(u_state, vUv);
          
          vec3 sum = vec3(0.0);
          vec3 wsum = vec3(0.0);
          
          for(int ri = 1; ri <= 6; ri++) {
            float fr = float(ri) / 6.0;
            float kr = fr - u_mu_k;
            float w = exp(-(kr * kr) / (2.0 * u_sig_k * u_sig_k));
            
            vec3 r_vec = u_radii * fr;
            vec3 kw = w * r_vec;
            
            for(int ai = 0; ai < 12; ai++) {
              float a = float(ai) / 12.0 * 6.28318530718;
              vec2 dir = vec2(cos(a), sin(a));
              
              float val0 = texture(u_state, vUv + dir * r_vec.x / u_res).r;
              float val1 = texture(u_state, vUv + dir * r_vec.y / u_res).g;
              float val2 = texture(u_state, vUv + dir * r_vec.z / u_res).b;
              
              sum += vec3(val0, val1, val2) * kw;
              wsum += kw;
            }
          }
          
          vec3 U = sum / max(wsum, 1e-5);
          
          vec3 U_conn = vec3(
            dot(u_W0, U),
            dot(u_W1, U),
            dot(u_W2, U)
          );
          
          vec3 G = grow(U_conn);
          vec4 next_state = vec4(clamp(state.rgb + u_dt * G, 0.0, 1.0), 0.0);
          
          // Trace / memory decays slowly
          next_state.a = max(state.a * 0.985, next_state.r);
          
          // Mouse interaction
          if(u_mouse_pressed > 0.5) {
            float d = length(vUv - u_mouse);
            if(d < 0.08) {
              float influence = exp(-d*d*800.0);
              next_state.g = max(next_state.g, influence);
              next_state.r = max(next_state.r, influence * 0.6);
              next_state.b = max(next_state.b, influence * 0.2);
            }
          }
          
          // Auto-seed to prevent colony death
          float t_cycle = mod(u_time, 12.0);
          if (t_cycle < 0.1) {
            vec2 c = vec2(
              0.5 + 0.3 * cos(u_time * 1.1),
              0.5 + 0.3 * sin(u_time * 1.3)
            );
            float d = length(vUv - c);
            if(d < 0.04) {
              float influence = exp(-d*d*1000.0);
              next_state.r = max(next_state.r, influence);
              next_state.g = max(next_state.g, influence * 0.5);
            }
          }
          
          fragColor = next_state;
        }
      `
    });

    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_time: { value: 0.0 },
        u_res: { value: new THREE.Vector2(SIM_RES, SIM_RES) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform sampler2D u_state;
        uniform float u_time;
        uniform vec2 u_res;
        
        void main() {
          vec4 state = texture(u_state, vUv);
          float body = state.r;
          float excite = state.g;
          float inhibit = state.b;
          float trace = state.a;
          
          vec2 eps = vec2(1.0 / u_res.x, 0.0);
          float dx = texture(u_state, vUv + eps.xy).r - texture(u_state, vUv - eps.xy).r;
          float dy = texture(u_state, vUv + eps.yx).r - texture(u_state, vUv - eps.yx).r;
          vec3 N = normalize(vec3(dx, dy, 0.1));
          vec3 L = normalize(vec3(cos(u_time * 0.5), sin(u_time * 0.5), 0.8));
          float diff = max(dot(N, L), 0.0);
          
          vec3 c_body = vec3(1.0, 0.0, 0.5);
          vec3 c_excite = vec3(0.0, 1.0, 0.9);
          vec3 c_inhibit = vec3(0.4, 0.0, 1.0);
          vec3 c_trace = vec3(1.0, 0.6, 0.0);
          vec3 c_acid = vec3(0.7, 1.0, 0.0);
          
          vec2 cuv = vUv - 0.5;
          float bg_noise = fract(sin(dot(vUv + u_time * 0.01, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 bg = mix(vec3(0.02, 0.01, 0.06), vec3(0.04, 0.01, 0.12), smoothstep(0.5, 0.0, length(cuv)));
          bg += bg_noise * 0.03 * c_inhibit;
          
          vec3 col = bg;
          
          col += c_inhibit * inhibit * 0.8;
          col += c_trace * trace * 0.5;
          
          float edge = smoothstep(0.1, 0.25, body) - smoothstep(0.25, 0.4, body);
          col += c_acid * edge * 2.0;
          
          float halo = smoothstep(0.0, 0.4, body);
          col += c_body * halo * 0.4;
          
          col += c_excite * excite * 1.2;
          col += c_body * body * 1.5;
          
          float shimmer = fract(sin(dot(vUv + u_time, vec2(53.123, 12.345))) * 43758.5453);
          col += c_body * body * shimmer * 0.4;
          
          float spec = pow(diff, 8.0);
          col += vec3(1.0) * spec * body;
          
          float core = smoothstep(0.7, 1.0, body);
          col += vec3(1.0, 0.9, 0.9) * core * 2.0;
          
          vec2 grid_uv = vUv * 40.0;
          grid_uv.x += sin(u_time * 0.2) * 2.0;
          grid_uv.y += cos(u_time * 0.2) * 2.0;
          float grid = smoothstep(0.9, 1.0, sin(grid_uv.x * 3.1415)) * smoothstep(0.9, 1.0, sin(grid_uv.y * 3.1415));
          col += vec3(0.0, 0.4, 0.8) * grid * trace * 0.5;
          
          vec2 dir = normalize(cuv);
          float traceR = texture(u_state, vUv + dir * 0.006).a;
          float traceB = texture(u_state, vUv - dir * 0.006).a;
          col.r += traceR * 0.4;
          col.b += traceB * 0.4;
          
          float vig = 1.0 - smoothstep(0.3, 0.8, length(cuv));
          col *= mix(0.2, 1.0, vig);
          
          fragColor = vec4(col, 1.0);
        }
      `
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);

    quad.material = seedMat;
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);
    renderer.setRenderTarget(rtB);
    renderer.render(scene, camera);

    canvas.__three = { renderer, scene, camera, quad, simMat, renderMat, rtA, rtB };
  }

  const { renderer, scene, camera, quad, simMat, renderMat } = canvas.__three;
  let { rtA, rtB } = canvas.__three;

  if (simMat.uniforms.u_mouse) {
    simMat.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
    simMat.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
  }
  
  if (simMat.uniforms.u_time) {
    simMat.uniforms.u_time.value = time;
  }

  quad.material = simMat;
  simMat.uniforms.u_state.value = rtA.texture;
  renderer.setRenderTarget(rtB);
  renderer.render(scene, camera);

  canvas.__three.rtA = rtB;
  canvas.__three.rtB = rtA;

  quad.material = renderMat;
  renderMat.uniforms.u_state.value = rtB.texture;
  renderMat.uniforms.u_time.value = time;
  renderer.setRenderTarget(null);
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Volvox Disco Reactor failed:", e);
}