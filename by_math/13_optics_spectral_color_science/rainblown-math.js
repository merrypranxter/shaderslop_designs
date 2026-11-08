try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      #define PI 3.14159265359

      // --- ALCHEMICAL MATH: PRNG & NOISE ---
      float hash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 47.53);
          return fract(p.x * p.y);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
          }
          return v;
      }

      // --- DIVERGENCE-FREE CURL NOISE (Rainblown Shear) ---
      vec2 curl(vec2 p) {
          float e = 0.01;
          float n1 = fbm(p + vec2(0.0, e));
          float n2 = fbm(p - vec2(0.0, e));
          float n3 = fbm(p + vec2(e, 0.0));
          float n4 = fbm(p - vec2(e, 0.0));
          return vec2(n1 - n2, n4 - n3) / (2.0 * e);
      }

      // --- COLOR SYSTEMS: OKLAB PERCEPTUAL SPACE ---
      vec3 srgb2lin(vec3 c) {
          vec3 cutoff = step(c, vec3(0.04045));
          vec3 higher = pow(max((c + vec3(0.055)) / 1.055, 0.0), vec3(2.4));
          vec3 lower = c / 12.92;
          return mix(higher, lower, cutoff);
      }

      vec3 lin2srgb(vec3 c) {
          vec3 cutoff = step(c, vec3(0.0031308));
          vec3 higher = 1.055 * pow(max(c, 0.0), vec3(1.0/2.4)) - vec3(0.055);
          vec3 lower = c * 12.92;
          return mix(higher, lower, cutoff);
      }

      vec3 lin2oklab(vec3 c) {
          float l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
          float m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
          float s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
          float l_ = pow(max(l, 0.0), 1.0/3.0);
          float m_ = pow(max(m, 0.0), 1.0/3.0);
          float s_ = pow(max(s, 0.0), 1.0/3.0);
          return vec3(
              0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
              1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
              0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
          );
      }

      vec3 oklab2lin(vec3 c) {
          float l_ = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
          float m_ = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
          float s_ = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
          float l = l_*l_*l_;
          float m = m_*m_*m_;
          float s = s_*s_*s_;
          return vec3(
               4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
              -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
              -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
          );
      }

      vec3 sRGB_to_OKLab(vec3 c) { return lin2oklab(srgb2lin(c)); }
      vec3 OKLab_to_sRGB(vec3 c) { return lin2srgb(oklab2lin(c)); }

      // --- STRUCTURAL COLOR: APOLLONIAN THIN-FILM ---
      // Calculates the optical path difference for thin-film interference
      // nested inside an Apollonian Kleinian limit set.
      vec2 apollonian_interference(vec2 uv) {
          float t = u_time * 0.4;
          
          // Rainblown Mycelial Shear: Domain warping via curl noise
          vec2 flow = curl(uv * 2.0 - vec2(t * 1.2, -t * 1.5));
          vec2 p = uv + flow * 0.15 + vec2(uv.y * 0.2, 0.0);
          
          // Hyperbolic Pre-fold
          p = p / (1.0 - dot(p, p) * 0.1);
          
          // Seed circles for (-1, 2, 2, 3) Integral Packing
          float scale = 1.0;
          vec2 c1 = vec2(0.5, 0.0); float r1 = 0.5;
          vec2 c2 = vec2(-0.5, 0.0); float r2 = 0.5;
          vec2 c3 = vec2(0.0, 0.47140452); float r3 = 0.333333;
          vec2 c4 = vec2(0.0, -0.47140452);

          for(int i = 0; i < 7; i++) {
              // Hostile Coordinates: slight rotational drift to simulate organic growth
              float angle = sin(t * 0.2 + float(i)) * 0.05;
              float ca = cos(angle), sa = sin(angle);
              p = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);

              float d1 = length(p - c1); float d2 = length(p - c2);
              float d3 = length(p - c3); float d4 = length(p - c4);
              float n1 = d1/r1, n2 = d2/r2, n3 = d3/r3, n4 = d4/r3;

              if(n1 < 1.0 && n1 <= n2 && n1 <= n3 && n1 <= n4) {
                  p = c1 + r1*r1*(p-c1)/(d1*d1); scale *= r1*r1/(d1*d1);
              } else if(n2 < 1.0 && n2 <= n3 && n2 <= n4) {
                  p = c2 + r2*r2*(p-c2)/(d2*d2); scale *= r2*r2/(d2*d2);
              } else if(n3 < 1.0 && n3 <= n4) {
                  p = c3 + r3*r3*(p-c3)/(d3*d3); scale *= r3*r3/(d3*d3);
              } else if(n4 < 1.0) {
                  p = c4 + r3*r3*(p-c4)/(d4*d4); scale *= r3*r3/(d4*d4);
              }
          }
          
          float d = (length(p) - r3) / scale;
          
          // Structural Color: 2nd cos(theta) = m * lambda
          // Simulating view angle via distance field gradient approximation
          float cosTheta = abs(sin(d * 25.0 - t * 2.0));
          
          // Mycelial hyphal ridges adding physical thickness
          float hyphae = abs(fbm(p * 8.0) - 0.5) * 2.0;
          float thickness = 250.0 + scale * 12.0 + hyphae * 300.0 + flow.x * 150.0;
          
          float pathDiff = 2.0 * 1.45 * thickness * cosTheta; // n=1.45 for fungal chitin
          
          return vec2(pathDiff, d);
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          uv *= 1.3;

          // CMYK Misregistration (Chromatic Aberration) to simulate print drift
          float offset = 0.004;
          vec2 resR = apollonian_interference(uv + vec2(offset, 0.0));
          vec2 resG = apollonian_interference(uv);
          vec2 resB = apollonian_interference(uv - vec2(offset, 0.0));

          // Spectral Rainbow Mapping (Cosine Palette)
          vec3 col;
          col.r = 0.5 + 0.5 * cos(6.28318 * (resR.x / 600.0)); // Red wavelength
          col.g = 0.5 + 0.5 * cos(6.28318 * (resG.x / 520.0)); // Green wavelength
          col.b = 0.5 + 0.5 * cos(6.28318 * (resB.x / 440.0)); // Blue wavelength

          // Acid Vibration via OKLab Chroma Boost
          vec3 lab = sRGB_to_OKLab(col);
          
          // Light/Dark contrast mapping based on fractal distance
          float distField = resG.y;
          float fractalEdge = smoothstep(0.0, 0.05, abs(distField));
          
          lab.x = 0.15 + 0.8 * fract(log(abs(distField) + 1.0) * 5.0 - u_time); // Pulsing luminance
          lab.y *= 2.2; // Boost Green-Red axis
          lab.z *= 2.2; // Boost Blue-Yellow axis
          
          col = OKLab_to_sRGB(lab);

          // Psychedelic Collage: Halftone Screen Artifacts
          vec2 screen_uv = gl_FragCoord.xy;
          float freq = 75.0;
          float angle = 0.785398; // 45 deg
          mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
          vec2 ht_uv = rot * screen_uv * (freq / u_resolution.y);
          
          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          float dot_rad = sqrt(1.0 - luma) * 0.45;
          float ht_pattern = length(fract(ht_uv) - 0.5);
          float halftone = smoothstep(dot_rad + 0.15, dot_rad - 0.05, ht_pattern);

          // Multiply blend the halftone ink
          col = mix(col * 0.1, col, halftone * 0.85 + 0.15);

          // Analog Zine: Paper Grain Overlay
          float grain = fract(sin(dot(uv * 1234.5 + u_time, vec2(12.9898, 78.233))) * 43758.5453);
          col += (grain - 0.5) * 0.12;

          fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
}