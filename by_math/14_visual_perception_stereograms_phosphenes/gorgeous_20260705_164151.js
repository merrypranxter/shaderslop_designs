try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false
    });
    const rtB = rtA.clone();

    const sharedGLSL = `
      #define PI 3.14159265359
      #define TAU 6.28318530718
      
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b)+1e-8; return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
      vec2 cpow(vec2 z, float n) { float r=length(z); float a=atan(z.y,z.x); return pow(r,n)*vec2(cos(n*a),sin(n*a)); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      
      vec3 get_core_color(vec2 fragCoord, vec2 res, float time) {
          vec2 uv = fragCoord / res;
          vec2 p = (fragCoord * 2.0 - res) / min(res.x, res.y);
          
          float breath = sin(time * 0.4) * 0.15;
          vec2 tremor = vec2(hash(vec2(time*2.0))-0.5, hash(vec2(time*2.0, 1.2))-0.5) * 0.015;
          vec2 center = vec2(sin(time*0.15)*0.15, cos(time*0.22)*0.15) + tremor;
          
          vec2 z = p - center;
          float r = max(length(z), 1e-5);
          vec2 lp = vec2(log(r) - breath, atan(z.y, z.x));
          
          float pressure = exp(-mod(r * 4.0 - time * 1.5, 4.0));
          
          vec2 c = vec2(0.4*sin(time*0.1), 0.3*cos(time*0.15));
          vec2 num = cpow(z, 3.0) - vec2(1.0, 0.0);
          vec2 den = cpow(z, 2.0) + c + vec2(pressure * 0.1, 0.0);
          vec2 w = cdiv(num, den);
          
          float phase = atan(w.y, w.x);
          float mag = log(length(w) + 1.0);
          
          float chirality = sign(sin(time * 0.05));
          float tunnel = sin(lp.x * 12.0 + lp.y * 3.0 * chirality - time * 3.0);
          float cobweb = sin(lp.x * 18.0 - time*1.5) * sin(lp.y * 14.0 + phase);
          float spiral = sin(lp.x * 6.0 + lp.y * 10.0 + time * 2.0);
          float grid_form = sin(w.x * 8.0) * sin(w.y * 8.0); 
          
          float m1 = 0.5 + 0.5 * sin(time * 0.25);
          float m2 = 0.5 + 0.5 * cos(time * 0.35 + mag);
          float form = mix(mix(tunnel, cobweb, m1), mix(spiral, grid_form, m2), 0.5 + 0.5*sin(time*0.1));
          
          float phase_contour = 0.85 + 0.15 * smoothstep(0.0, 0.2, abs(fract(phase/TAU * 8.0) - 0.5)*2.0);
          
          float pulse = sin(time * 1.5) * 0.5 + 0.5;
          float intensity = smoothstep(0.0, 0.8, abs(form)) * phase_contour;
          intensity += 0.2 * pulse * smoothstep(0.0, 0.5, abs(form));
          
          vec3 col_far = vec3(0.0, 0.7, 0.9);  
          vec3 col_mid = vec3(0.5, 0.0, 0.8);  
          vec3 col_near = vec3(1.0, 0.1, 0.5); 
          
          vec3 col = mix(col_far, col_mid, smoothstep(0.0, 0.5, intensity));
          col = mix(col, col_near, smoothstep(0.5, 1.0, intensity));
          
          col = mix(col, vec3(0.7, 1.0, 0.0), smoothstep(0.85, 0.95, intensity)); 
          col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.95, 1.0, intensity)); 
          
          float spec = pow(sin(phase * 12.0 + time * 4.0) * 0.5 + 0.5, 8.0) * intensity;
          col += spec * vec3(1.0, 0.9, 0.9);
          
          float fovea_glow = exp(-r * 15.0) * (0.5 + 0.5 * sin(time * 3.0));
          col += fovea_glow * vec3(1.0, 0.2, 0.6);
          
          float window = smoothstep(0.01, 0.15, r) * (1.0 - smoothstep(1.0, 2.5, r));
          return col * window;
      }
    `;

    const vertexShader = `
      out vec2 vUv;
      void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
      }
    `;

    const matBurn = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_prev: { value: null }
      },
      vertexShader,
      fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform sampler2D u_prev;
        
        in vec2 vUv;
        out vec4 fragColor;
        
        ${sharedGLSL}
        
        void main() {
            vec3 core = get_core_color(gl_FragCoord.xy, u_resolution, u_time);
            vec3 adapt = texture(u_prev, vUv).rgb;
            
            vec3 new_adapt = mix(adapt, core, 0.08); 
            new_adapt *= exp(-0.016 / 6.0); 
            
            fragColor = vec4(clamp(new_adapt, 0.0, 1.0), 1.0);
        }
      `
    });

    const matPost = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_adapt: { value: null }
      },
      vertexShader,
      fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform sampler2D u_adapt;
        
        in vec2 vUv;
        out vec4 fragColor;
        
        ${sharedGLSL}
        
        void main() {
            vec2 uv = vUv;
            vec3 core = get_core_color(gl_FragCoord.xy, u_resolution, u_time);
            vec3 adapt = texture(u_adapt, uv).rgb;
            
            vec3 ghost = (vec3(1.0) - adapt) * max(max(adapt.r, adapt.g), adapt.b);
            float core_intensity = max(max(core.r, core.g), core.b);
            
            vec3 final_col = core + ghost * 0.7 * (1.0 - core_intensity);
            
            float pulse = sin(u_time * 1.5) * 0.5 + 0.5;
            vec2 dir = (uv - 0.5);
            float r2 = dot(dir, dir);
            
            if (pulse > 0.8) {
                float ca_amt = 0.015 * r2 * (pulse - 0.8) * 5.0;
                float r_shift = get_core_color(gl_FragCoord.xy + dir * ca_amt * u_resolution, u_resolution, u_time).r;
                float b_shift = get_core_color(gl_FragCoord.xy - dir * ca_amt * u_resolution, u_resolution, u_time).b;
                final_col.r = mix(final_col.r, r_shift, 0.6);
                final_col.b = mix(final_col.b, b_shift, 0.6);
                
                float bits = mix(16.0, 4.0, (pulse - 0.8) * 5.0);
                float levels = exp2(bits);
                final_col = floor(final_col * levels + 0.5) / levels;
                
                if (r2 > 0.15 && hash(uv * u_time) > 0.99) {
                    final_col = vec3(0.8, 0.0, 1.0); 
                }
            }
            
            fragColor = vec4(clamp(final_col, 0.0, 1.0), 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, rtA, rtB, mesh, matBurn, matPost };
  }

  const { renderer, scene, camera, mesh, matBurn, matPost } = canvas.__three;
  let { rtA, rtB } = canvas.__three;

  if (rtA.width !== grid.width || rtA.height !== grid.height) {
    rtA.setSize(grid.width, grid.height);
    rtB.setSize(grid.width, grid.height);
  }
  
  renderer.setSize(grid.width, grid.height, false);

  matBurn.uniforms.u_time.value = time;
  matBurn.uniforms.u_resolution.value.set(grid.width, grid.height);
  matBurn.uniforms.u_prev.value = rtA.texture;
  
  mesh.material = matBurn;
  renderer.setRenderTarget(rtB);
  renderer.render(scene, camera);

  matPost.uniforms.u_time.value = time;
  matPost.uniforms.u_resolution.value.set(grid.width, grid.height);
  matPost.uniforms.u_adapt.value = rtB.texture;
  
  mesh.material = matPost;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  canvas.__three.rtA = rtB;
  canvas.__three.rtB = rtA;

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
  throw e;
}