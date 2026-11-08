if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const fragmentShader = `
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;
      uniform float u_time;
      uniform vec2 u_resolution;

      vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                         dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                     mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                         dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
          float f = 0.0; float amp = 0.5;
          for(int i=0; i<4; i++) {
              f += amp * noise(p);
              p *= 2.0; p += vec2(12.34, 56.78); amp *= 0.5;
          }
          return f;
      }

      float quasicrystal(vec2 p) {
          float f = 0.0;
          for(int i=0; i<5; i++) {
              float theta = float(i) * 3.14159265 * 0.2;
              vec2 dir = vec2(cos(theta), sin(theta));
              f += cos(dot(p, dir) * 8.0);
          }
          return f;
      }

      float warped_fourier(vec2 p, float t) {
          float f = sin(p.x * 3.0 + t) + sin(p.y * 5.0 - t) + sin((p.x + p.y) * 7.0 + t*1.5);
          return sin(f * 3.14159 * 2.0);
      }

      float lenia_grow(float u, float mu, float sig) {
          float d = u - mu;
          return 2.0 * exp(-(d * d) / (2.0 * sig * sig)) - 1.0;
      }

      vec4 froth(vec2 p, float t) {
          vec2 base = floor(p);
          float f1 = 1e9, f2 = 1e9;
          float id = 0.0;
          float cell_val = 0.0;
          
          for (int x = -2; x <= 2; x++) {
              for (int y = -2; y <= 2; y++) {
                  vec2 cell = base + vec2(float(x), float(y));
                  vec2 h = hash2(cell)*0.5+0.5;
                  vec2 site = cell + 0.5 + 0.4 * sin(t * 0.8 + h * 6.283);
                  
                  float w = 0.4 * sin(h.x * 12.0 + t); 
                  vec2 dvec = abs(p - site);
                  float p_norm = 2.0 + sin(t + h.y * 5.0);
                  float d = pow(pow(dvec.x, p_norm) + pow(dvec.y, p_norm), 1.0/p_norm) - w;
                  
                  if (d < f1) {
                      f2 = f1; f1 = d; id = h.y; cell_val = h.x;
                  } else if (d < f2) {
                      f2 = d;
                  }
              }
          }
          return vec4(f1, f2, id, cell_val);
      }

      vec3 get_color(float id, float val, float t) {
          vec3 c1 = vec3(1.0, 0.0, 0.6);
          vec3 c2 = vec3(0.0, 1.0, 0.9);
          vec3 c3 = vec3(0.8, 1.0, 0.0);
          vec3 c4 = vec3(0.5, 0.0, 1.0);
          vec3 c5 = vec3(1.0, 0.3, 0.0);
          vec3 c6 = vec3(1.0, 1.0, 0.0);
          
          float mix_val = fract(id * 7.31 + t * 0.2);
          
          vec3 col = mix(c1, c2, smoothstep(0.0, 0.2, mix_val));
          col = mix(col, c3, smoothstep(0.2, 0.4, mix_val));
          col = mix(col, c4, smoothstep(0.4, 0.6, mix_val));
          col = mix(col, c5, smoothstep(0.6, 0.8, mix_val));
          col = mix(col, c6, smoothstep(0.8, 1.0, mix_val));
          
          return col * (0.5 + 0.5 * val);
      }

      vec3 scene(vec2 uv, float t) {
          vec2 block_uv = floor(uv * 15.0) / 15.0;
          if (hash2(block_uv + floor(t*2.0)).x > 0.9) {
              uv += (hash2(block_uv) - 0.5) * 0.15;
          }

          float qc = quasicrystal(uv * 2.0 - t * 0.5);
          float wf = warped_fourier(uv * 1.5 + qc, t);
          vec2 warp = vec2(fbm(uv + t * 0.2 + wf), fbm(uv + vec2(5.2, 1.3) - t * 0.15 - wf));
          
          vec2 p = uv + warp * 0.6;
          p *= 4.0 + sin(t*0.5)*0.5;
          
          vec4 f = froth(p, t);
          
          float film = (f.y - f.x) * 0.5;
          float u = f.w + film * 2.0; 
          float growth = lenia_grow(u, 0.15, 0.02); 
          float avalanche = step(0.95, fract(f.z * 123.4 + t * 0.5 + film * 5.0));
          
          vec3 col = get_color(f.z, f.w, t);
          
          float border = smoothstep(0.08, 0.0, film);
          vec3 border_col = vec3(1.0, 1.0, 1.0) * border;
          
          float halo = smoothstep(0.0, 0.5, growth);
          col += vec3(0.0, 1.0, 0.8) * halo * 0.8;
          
          col = mix(col, vec3(1.0, 1.0, 0.0), avalanche * 0.8);
          col = mix(col, border_col, border * 0.8);
          
          float moire = sin(length(uv) * 40.0 - t * 15.0) * sin(uv.x * 50.0 + t * 8.0);
          col += vec3(1.0, 0.0, 0.5) * smoothstep(0.8, 1.0, moire) * 0.4;
          
          return col;
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          vec2 dir = normalize(uv + vec2(1e-5));
          float dist = length(uv);
          float disp = 0.03 * dist * (1.0 + 0.5 * sin(u_time * 2.0 - dist * 5.0));
          
          vec3 col;
          col.r = scene(uv + dir * disp, u_time).r;
          col.g = scene(uv, u_time).g;
          col.b = scene(uv - dir * disp, u_time).b;
          
          vec2 fragCoord = vUv * u_resolution;
          float scanline = 0.5 + 0.5 * sin(vUv.y * u_resolution.y * 3.14159);
          col *= 0.85 + 0.15 * scanline;
          
          float mask = mod(fragCoord.x, 3.0);
          vec3 triad = vec3(
              smoothstep(1.0, 0.0, abs(mask - 0.5)),
              smoothstep(1.0, 0.0, abs(mask - 1.5)),
              smoothstep(1.0, 0.0, abs(mask - 2.5))
          );
          col *= mix(vec3(1.0), triad, 0.35);
          
          float vig = 1.0 - smoothstep(0.3, 1.5, dist);
          col *= vig;
          
          col = pow(col, vec3(0.85)); 
          
          fragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { 
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    throw e;
  }
}

const { renderer, scene, camera, material } = canvas.__three;
if (material && material.uniforms && material.uniforms.u_time && material.uniforms.u_resolution) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);