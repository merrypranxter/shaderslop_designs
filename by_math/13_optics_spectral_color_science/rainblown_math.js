try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      // Complex Arithmetic (Mobius Transforms)
      vec2 cMul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 cDiv(vec2 a, vec2 b) { return vec2(dot(a,b), a.y*b.x - a.x*b.y) / dot(b,b); }

      // Perceptual Color Space (OKLCh -> OKLab -> Linear sRGB -> sRGB)
      vec3 OKLCh_to_OKLab(vec3 lch) {
          return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
      }

      vec3 OKLab_to_linearSRGB(vec3 c) {
          float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
          float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
          float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
          float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
          return vec3(
               4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
              -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
              -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
          );
      }

      vec3 linear_to_sRGB(vec3 c) {
          vec3 sq1 = 1.055 * pow(clamp(c, 0.0, 1.0), vec3(1.0/2.4)) - 0.055;
          vec3 c12 = c * 12.92;
          return mix(c12, sq1, step(0.0031308, c));
      }

      // Procedural Noise (The Wind & The Rain)
      float hash(vec2 p) { 
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); 
      }
      
      float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                     mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
      }
      
      float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for(int i=0; i<5; i++) {
              v += a * noise(p);
              p = vec2(p.x*0.8 - p.y*0.6, p.x*0.6 + p.y*0.8) * 2.0;
              a *= 0.5;
          }
          return v;
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;

          // 1. Rainblown Domain Warp (Fluid Advection)
          // A storm of vector calculus blowing across the manifold
          vec2 wind = vec2(1.2, -1.8) * u_time * 0.15;
          vec2 warp = vec2(fbm(p * 2.5 + wind), fbm(p * 2.5 - wind + 10.0));
          p += warp * 0.35 * (1.0 + sin(u_time * 0.3) * 0.3);

          // 2. Mobius Transformation (Psychedelic Lens)
          // f(z) = (az+b)/(cz+d) - twisting the plane into a hyperbolic funnel
          vec2 a = vec2(cos(u_time*0.1), sin(u_time*0.1));
          vec2 b = vec2(sin(u_time*0.15), -cos(u_time*0.15));
          p = cDiv(cMul(a, p) + b, cMul(-b, p) + a);

          // 3. Apollonian Gasket / Kleinian Inversion
          // The bureaucratic failure of infinity trying to fold itself
          float scale = 1.0;
          float orbit = 1e20;
          float iter = 0.0;
          vec2 z = p;
          
          for(int i=0; i<14; i++) {
              z = -1.0 + 2.0 * fract(0.5 * z + 0.5); // spatial fold
              float r2 = dot(z, z);
              orbit = min(orbit, r2); // orbit trap
              
              // Spherical inversion with a hesitant core limit
              float k = 1.18 / max(r2, 0.12); 
              z *= k;
              scale *= k;
              iter += 1.0;
          }

          float d = length(z) / scale;

          // 4. Mycelial Anastomosis (Fungal Growth Logic)
          // Hyphae finding the paths of least resistance along the mathematical faults
          float hyphae = smoothstep(0.015, 0.0, abs(fract(d * 12.0 - u_time * 1.5) - 0.5));
          hyphae *= exp(-d * 8.0); // strict boundary adherence

          // 5. Structural Color (Thin Film / Perceptual Rainbow)
          // Instead of generic RGB, we treat the fractal depth as a physical thin-film thickness
          // and map it perceptually via OKLCh (Chroma / Hue / Lightness)
          float thickness = 300.0 + 450.0 * (iter / 14.0) + 200.0 * sin(orbit * 15.0 - u_time) + 150.0 * warp.x;
          
          // Hue driven by physical thickness, swept by time
          float hue = thickness * 0.015 + u_time * 0.6;
          
          // Chroma pulses where the orbit trap tightens
          float chroma = 0.16 + 0.08 * cos(orbit * 40.0);
          
          // Lightness modulated by depth, fungal lines, and the rain warp
          float lightness = 0.45 + 0.35 * exp(-d * 4.0) + 0.25 * hyphae;
          lightness -= 0.15 * warp.y; // Rain shadows

          vec3 lab = OKLCh_to_OKLab(vec3(lightness, chroma, hue));
          vec3 rgb = linear_to_sRGB(OKLab_to_linearSRGB(lab));

          // 6. Psychedelic Print Artifacts (CMYK Misregistration + Halftone)
          // The machine hesitates, separating the spectral channels
          float shift = 0.015 * fbm(p * 15.0 + u_time);
          vec3 labR = OKLCh_to_OKLab(vec3(lightness, chroma, hue + shift * 10.0));
          vec3 labB = OKLCh_to_OKLab(vec3(lightness, chroma, hue - shift * 10.0));
          
          rgb.r = linear_to_sRGB(OKLab_to_linearSRGB(labR)).r;
          rgb.b = linear_to_sRGB(OKLab_to_linearSRGB(labB)).b;

          // Newsprint halftone overlay to ground it in physical media
          float halftone = sin(vUv.x * u_resolution.x * 0.6) * sin(vUv.y * u_resolution.y * 0.6);
          rgb *= 0.92 + 0.08 * halftone;

          // Vignette
          float vig = length(vUv - 0.5) * 2.0;
          rgb *= 1.0 - smoothstep(0.8, 1.5, vig);

          fragColor = vec4(rgb, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
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
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Fungal-Apollonian Structural Collapse:", e);
}