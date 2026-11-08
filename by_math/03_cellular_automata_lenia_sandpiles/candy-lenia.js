if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.setSize(grid.width, grid.height, false);
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const rtOpts = {
      width: grid.width,
      height: grid.height,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false
    };

    let rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
    let rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const seedFragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      void main() {
        vec2 uv = vUv;
        vec4 state = vec4(1.0, 0.0, 0.0, 0.0);
        
        for(float i=0.0; i<15.0; i++) {
            vec2 pos = vec2(hash(vec2(i, 1.0)), hash(vec2(i, 2.0)));
            float r = length(uv - pos);
            if (r < 0.05) state.g = 1.0;
            if (r < 0.02) { state.b = 1.0; state.a = 1.0; }
        }
        
        float qc = 0.0;
        vec2 p = (uv - 0.5) * 20.0;
        for(int i=0; i<5; i++) {
            float ang = float(i) * 3.14159265 / 5.0;
            qc += cos(dot(p, vec2(cos(ang), sin(ang))));
        }
        if (qc > 2.0) state.g = 1.0;
        
        fragColor = state;
      }
    `;

    const simFragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform sampler2D u_state;
      uniform vec2 u_res;
      uniform float u_time;
      
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      void main() {
          vec2 uv = vUv;
          vec2 texel = 1.0 / u_res;
          
          float gR = texture(u_state, fract(uv + vec2(texel.x, 0.0))).g;
          float gL = texture(u_state, fract(uv - vec2(texel.x, 0.0))).g;
          float gT = texture(u_state, fract(uv + vec2(0.0, texel.y))).g;
          float gB = texture(u_state, fract(uv - vec2(0.0, texel.y))).g;
          vec2 gradient = vec2(gR - gL, gT - gB);
          
          vec2 drift_uv = fract(uv - gradient * 1.5);
          
          vec4 state = texture(u_state, uv);
          vec4 state_advected = texture(u_state, drift_uv);
          
          float qc = 0.0;
          vec2 p = (uv - 0.5) * 12.0;
          for(int i=0; i<5; i++) {
              float ang = float(i) * 3.14159265 / 5.0;
              vec2 dir = vec2(cos(ang), sin(ang));
              qc += cos(dot(p, dir) + u_time * 0.2);
          }
          qc = (qc / 5.0) * 0.5 + 0.5;
          
          vec4 U = vec4(0.0);
          float w_total = 0.0;
          for(float ri=1.0; ri<=3.0; ri++){
              float r = ri / 3.0;
              float kw = exp(-pow(r - 0.5, 2.0) / 0.04) * r;
              for(float ai=0.0; ai<12.0; ai++){
                  float a = ai * 6.2831853 / 12.0 + ri * 2.0;
                  vec2 off = vec2(cos(a), sin(a)) * r * 14.0 * texel;
                  U += texture(u_state, fract(drift_uv + off)) * kw;
                  w_total += kw;
              }
          }
          U /= w_total;
          
          float u_b = U.b + 0.15 * U.a; 
          float u_a = U.a + 0.25 * U.b;
          
          float mu_b = 0.14, sig_b = 0.015;
          float mu_a = 0.12, sig_a = 0.02;
          
          float G_b = 2.0 * exp(-pow(u_b - mu_b, 2.0) / (2.0 * sig_b * sig_b)) - 1.0;
          float G_a = 2.0 * exp(-pow(u_a - mu_a, 2.0) / (2.0 * sig_a * sig_a)) - 1.0;
          
          if (hash(uv + u_time) < 0.002) { G_b = -1.0; G_a = -1.0; }
          
          vec4 lap = texture(u_state, fract(uv + vec2(texel.x, 0.0))) +
                     texture(u_state, fract(uv - vec2(texel.x, 0.0))) +
                     texture(u_state, fract(uv + vec2(0.0, texel.y))) +
                     texture(u_state, fract(uv - vec2(0.0, texel.y))) -
                     4.0 * state;
                     
          float feed = 0.036 + 0.018 * qc;
          float kill = 0.061 + 0.045 * state.b; 
          
          float rxn = state.r * state.g * state.g;
          float dR = 0.2 * lap.r - rxn + feed * (1.0 - state.r);
          float dG = 0.1 * lap.g + rxn - (feed + kill) * state.g;
          
          float bloom = smoothstep(0.85, 1.0, qc) * smoothstep(0.4, 0.6, state.r);
          float spawn = (hash(uv - u_time) > 0.99) ? bloom * 0.8 : 0.0;
          
          state.r += dR;
          state.g += dG + spawn;
          
          state_advected.b += 0.1 * G_b + 0.06 * state.g * state_advected.b;
          state_advected.a += 0.1 * G_a;
          
          fragColor = clamp(vec4(state.r, state.g, state_advected.b, state_advected.a), 0.0, 1.0);
      }
    `;

    const displayFragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform sampler2D u_state;
      uniform vec2 u_res;
      uniform float u_time;
      
      void main() {
          vec2 uv = vUv;
          vec2 texel = 1.0 / u_res;
          
          vec4 s = texture(u_state, uv);
          vec4 sx = texture(u_state, fract(uv + vec2(texel.x, 0.0)));
          vec4 sy = texture(u_state, fract(uv + vec2(0.0, texel.y)));
          
          float H = s.r - s.g + s.b + s.a;
          float Hx = sx.r - sx.g + sx.b + sx.a;
          float Hy = sy.r - sy.g + sy.b + sy.a;
          
          vec3 normal = normalize(vec3(Hx - H, Hy - H, 0.04));
          vec3 view = vec3(0.0, 0.0, 1.0);
          float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 2.5);
          
          vec3 c_base = vec3(1.0, 0.97, 0.98);
          vec3 c_u    = vec3(0.0, 0.85, 0.95);
          vec3 c_v    = vec3(1.0, 0.0, 0.55);
          vec3 c_b    = vec3(1.0, 0.7, 0.0);
          vec3 c_a    = vec3(0.5, 0.1, 1.0);
          
          vec3 col = c_base;
          
          col = mix(c_u, c_base, smoothstep(0.2, 1.0, s.r));
          col = mix(col, c_v, smoothstep(0.05, 0.6, s.g));
          col = mix(col, c_b, smoothstep(0.0, 0.7, s.b));
          col = mix(col, c_a, smoothstep(0.0, 0.8, s.a));
          
          vec3 irid = 0.5 + 0.5 * cos(6.28318 * (fresnel * vec3(1.0, 1.3, 1.6) + vec3(0.0, 0.33, 0.67)));
          col += irid * fresnel * 1.5 * (s.g + s.b);
          
          vec3 light = normalize(vec3(1.0, 1.0, 1.5));
          vec3 halfV = normalize(view + light);
          float spec = pow(max(dot(normal, halfV), 0.0), 32.0);
          col += spec * vec3(1.0, 0.95, 1.0) * 1.5;
          
          float noise = fract(sin(dot(uv + u_time, vec2(127.1, 311.7))) * 43758.5453);
          float glitter = step(0.99, noise) * fresnel * smoothstep(0.05, 0.4, length(vec2(Hx-H, Hy-H)));
          col += glitter * vec3(0.8, 1.0, 0.9) * 4.0;
          
          col += c_v * pow(s.g, 2.0) * 0.8;
          col += vec3(0.0, 1.0, 0.6) * pow(s.b, 3.0) * 1.2;
          
          col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
          
          fragColor = vec4(col, 1.0);
      }
    `;

    const seedMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader: seedFragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const simMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      },
      vertexShader,
      fragmentShader: simFragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const displayMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      },
      vertexShader,
      fragmentShader: displayFragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, seedMaterial);
    scene.add(mesh);

    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);

    canvas.__three = { renderer, scene, camera, mesh, simMaterial, displayMaterial, rtA, rtB };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, mesh, simMaterial, displayMaterial } = canvas.__three;
let { rtA, rtB } = canvas.__three;

if (renderer && scene && camera && simMaterial && displayMaterial) {
  renderer.setSize(grid.width, grid.height, false);
  
  simMaterial.uniforms.u_res.value.set(grid.width, grid.height);
  simMaterial.uniforms.u_time.value = time;
  
  mesh.material = simMaterial;
  for (let i = 0; i < 4; i++) {
    simMaterial.uniforms.u_state.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(scene, camera);
    
    let temp = rtA;
    rtA = rtB;
    rtB = temp;
  }
  
  canvas.__three.rtA = rtA;
  canvas.__three.rtB = rtB;
  
  displayMaterial.uniforms.u_res.value.set(grid.width, grid.height);
  displayMaterial.uniforms.u_time.value = time;
  displayMaterial.uniforms.u_state.value = rtA.texture;
  
  mesh.material = displayMaterial;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}