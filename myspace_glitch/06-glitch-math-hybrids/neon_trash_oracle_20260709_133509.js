try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      in vec2 vUv;
      out vec4 fragColor;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;

      #define PI 3.14159265359

      // OKLab-inspired candy-acid palette (color_systems, glitchcore_style)
      vec3 palette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.00, 0.33, 0.67);
          vec3 col = a + b * cos(2.0 * PI * (c * t + d));
          
          // Push saturation to hyperpop neon
          col = mix(col, vec3(1.0, 0.0, 0.4), smoothstep(0.7, 1.0, sin(t * PI * 2.0))); // Hot Pink
          col = mix(col, vec3(0.0, 1.0, 0.8), smoothstep(0.7, 1.0, cos(t * PI * 2.0))); // Cyan
          col = mix(col, vec3(0.6, 1.0, 0.0), smoothstep(0.8, 1.0, sin(t * PI * 3.0))); // Acid Green
          
          return clamp(col * 1.3, 0.0, 1.0);
      }

      float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
      }

      float noise(vec2 p) {
          vec2 i = floor(p + (p.x+p.y)*0.36602540378);
          vec2 a = p - i + (i.x+i.y)*0.2113248654;
          float m = step(a.y, a.x); 
          vec2 o = vec2(m, 1.0-m);
          vec2 b = a - o + 0.2113248654;
          vec2 c = a - 1.0 + 2.0*0.2113248654;
          vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
          vec3 n = h*h*h*h*vec3(dot(a,hash22(i)-0.5), dot(b,hash22(i+o)-0.5), dot(c,hash22(i+1.0)-0.5));
          return dot(n, vec3(70.0));
      }

      float fbm(vec2 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i = 0; i < 4; i++) {
              f += amp * noise(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      // Hyperbolic warp (lovecraft_os, dream_physics)
      vec2 hyperbolicWarp(vec2 uv, vec2 center, float time) {
          vec2 d = uv - center;
          float r = length(d);
          float a = atan(d.y, d.x);
          float r_warp = log(r + 0.1) * 1.5 - time * 0.4;
          float a_warp = a + sin(r * 4.0 - time) * 0.5;
          return vec2(r_warp, a_warp);
      }

      // Quasicrystal Interference (op_art_style, moire)
      float quasicrystal(vec2 p, float time) {
          float v = 0.0;
          for(int i = 0; i < 5; i++) {
              float a = float(i) * PI / 5.0 + time * 0.05;
              vec2 dir = vec2(cos(a), sin(a));
              v += cos(dot(p, dir) * 8.0 + time);
          }
          return v * 0.2;
      }

      // Voronoi Slime (plateau_foam, cuttlefish_chromatics)
      vec3 voronoi(vec2 x, float time) {
          vec2 n = floor(x);
          vec2 f = fract(x);
          float res = 8.0;
          vec2 mr;
          for(int j = -1; j <= 1; j++)
          for(int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash22(n + g);
              o = 0.5 + 0.5 * sin(time + 6.2831 * o);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if(d < res) {
                  res = d;
                  mr = r;
              }
          }
          return vec3(sqrt(res), mr);
      }

      // I-Ching Hexagram SDF (i_ching_fields)
      float hexagram(vec2 uv, int state) {
          uv = abs(uv);
          if(uv.x > 0.4 || uv.y > 0.8) return 0.0;
          float lineY = fract((uv.y + 0.8) * 3.75);
          int idx = int(floor((uv.y + 0.8) * 3.75));
          if(lineY > 0.7) return 0.0;
          float bit = float((state >> idx) & 1);
          if(bit == 0.0 && uv.x < 0.1) return 0.0;
          return 1.0;
      }

      // Glitchcore Ticker Band (glitchcore_style, early_internet_aesthetic)
      vec3 glitchBand(vec2 uv, float time) {
          float band = step(0.95, sin(uv.y * 30.0 + time * 15.0));
          float glitch = noise(vec2(uv.x * 80.0, time * 20.0));
          if(band > 0.5 && glitch > 0.5) {
              return vec3(1.0, 0.0, 0.8) * 2.0; 
          }
          return vec3(0.0);
      }

      void main() {
          vec2 uv = (vUv - 0.5) * u_resolution / u_resolution.y;
          vec2 m = (u_mouse - 0.5) * u_resolution / u_resolution.y;
          float t = u_time * 0.4;

          vec3 col = vec3(0.0);

          // Background: Hyperbolic Moiré Quasicrystal
          vec2 hypUV = hyperbolicWarp(uv, m * 0.5, t);
          float qc = quasicrystal(hypUV * 4.0, t);
          vec3 bgCol = palette(qc + t * 0.1);
          
          float scan = sin(length(uv) * 60.0 - t * 12.0) * 0.5 + 0.5;
          bgCol *= mix(0.6, 1.0, scan);

          col += bgCol * 0.3;

          // Midground: Voronoi Slime Territories
          vec2 vUV = uv * 2.5;
          vUV += vec2(fbm(vUV + t), fbm(vUV - t)) * 0.4;
          vec3 v = voronoi(vUV, t * 1.5);
          
          float edge = 1.0 - smoothstep(0.0, 0.06, v.x);
          vec3 slimeCol = palette(hash12(floor(vUV)) + t * 0.2);
          
          float slimeMask = smoothstep(0.2, 0.6, fbm(uv * 3.0 + t));
          col = mix(col, slimeCol, slimeMask * 0.5);
          col += palette(v.x * 4.0 - t) * edge * slimeMask * 1.5; 

          // Center: Azathoth Oracle Core (Lenia + Prism Dispersion)
          float dCore = length(uv - m * 0.2);
          float mu_k = 0.25 + 0.05 * sin(t * 4.0);
          float sig_k = 0.04;
          
          vec3 coreDisp;
          coreDisp.r = exp(-(dCore - mu_k - 0.015)*(dCore - mu_k - 0.015) / (2.0 * sig_k * sig_k));
          coreDisp.g = exp(-(dCore - mu_k)*(dCore - mu_k) / (2.0 * sig_k * sig_k));
          coreDisp.b = exp(-(dCore - mu_k + 0.015)*(dCore - mu_k + 0.015) / (2.0 * sig_k * sig_k));
          
          float a = atan(uv.y - m.y * 0.2, uv.x - m.x * 0.2);
          float spikes = sin(a * 10.0 + t * 6.0) * 0.5 + 0.5;
          coreDisp *= (0.6 + 0.4 * spikes);
          
          col += coreDisp * palette(dCore * 3.0 - t) * 2.5;

          // Foreground: I-Ching Sigils (with Chromatic Aberration)
          vec2 sigilUV = uv * 6.0;
          vec2 gUV = fract(sigilUV + vec2(t * 0.6, sin(t)*0.2)) - 0.5;
          vec2 gID = floor(sigilUV + vec2(t * 0.6, sin(t)*0.2));
          float gHash = hash12(gID);
          
          if(gHash > 0.85) {
              int state = int(gHash * 64.0);
              vec3 gCol = vec3(0.0);
              gCol.r = hexagram(gUV + vec2(0.03, 0.0), state);
              gCol.g = hexagram(gUV, state);
              gCol.b = hexagram(gUV - vec2(0.03, 0.0), state);
              col += gCol * palette(gHash + t * 2.0) * 1.5;
          }

          // Ticker bands
          col += glitchBand(uv, t);

          // Post Finisher: ACES Tonemap & Vignette (crt_phosphor_fx)
          col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
          col *= 1.0 - 0.5 * dot(uv, uv);

          fragColor = vec4(col, 1.0);
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

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;
  
  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (material.uniforms.u_mouse) {
      const targetX = mouse.x / grid.width;
      const targetY = 1.0 - mouse.y / grid.height;
      material.uniforms.u_mouse.value.x += (targetX - material.uniforms.u_mouse.value.x) * 0.1;
      material.uniforms.u_mouse.value.y += (targetY - material.uniforms.u_mouse.value.y) * 0.1;
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
  throw e;
}