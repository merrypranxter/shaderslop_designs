if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;

      in vec2 vUv;
      out vec4 fragColor;

      const float PI = 3.14159265359;

      // ─── ALCHEMY & PRNG ──────────────────────────────────────────────
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
      }

      // ─── NOISE & FBM (Mycelial Advection) ────────────────────────────
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for(int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
          }
          return v;
      }

      // ─── PLATEAU FOAM / WEAIRE-PHELAN ────────────────────────────────
      vec3 voronoi(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 8.0, d2 = 8.0;
          vec2 id = vec2(0.0);
          for(int j = -1; j <= 1; j++) {
              for(int i = -1; i <= 1; i++) {
                  vec2 g = vec2(float(i), float(j));
                  vec2 o = hash2(n + g);
                  // Lenia-like organic jitter
                  o = 0.5 + 0.5 * sin(u_time * 0.4 + 6.2831 * o); 
                  vec2 r = g + o - f;
                  float d = dot(r, r);
                  if(d < d1) {
                      d2 = d1;
                      d1 = d;
                      id = n + g;
                  } else if(d < d2) {
                      d2 = d;
                  }
              }
          }
          return vec3(sqrt(d1), sqrt(d2), hash(id));
      }

      // ─── SPECTRAL COLOR INTEGRATION ──────────────────────────────────
      float lobe(float x, float a, float mu, float sl, float sr) {
          float s = x < mu ? sl : sr;
          float t = (x - mu) / s;
          return a * exp(-0.5 * t * t);
      }

      vec3 wavelengthToRGB(float lambda) {
          // CIE 1931 Multi-lobe Gaussian Fit
          float x = lobe(lambda, 1.056, 599.8, 37.9, 31.0) 
                  + lobe(lambda, 0.362, 442.0, 16.0, 26.7) 
                  + lobe(lambda, -0.065, 501.1, 20.4, 26.2);
          float y = lobe(lambda, 0.821, 568.8, 46.9, 40.5) 
                  + lobe(lambda, 0.286, 530.9, 16.3, 31.1);
          float z = lobe(lambda, 1.217, 437.0, 11.8, 36.0) 
                  + lobe(lambda, 0.681, 459.0, 26.0, 13.8);
                  
          vec3 rgb = vec3(
               3.2406 * x - 1.5372 * y - 0.4986 * z,
              -0.9689 * x + 1.8758 * y + 0.0415 * z,
               0.0557 * x - 0.2040 * y + 1.0570 * z
          );
          
          // Color Systems Protocol: Soft-clip negatives to preserve hue
          float lift = min(min(rgb.r, rgb.g), min(rgb.b, 0.0));
          rgb -= lift;
          
          // Chromostereopsis Protocol: Enforce absolute max saturation
          float maxC = max(max(rgb.r, rgb.g), rgb.b);
          if (maxC > 1e-5) rgb /= maxC;
          
          return clamp(rgb, 0.0, 1.0);
      }

      // ─── THE COMPUTATIONAL SOUP (Density Field) ──────────────────────
      float getDensity(vec2 uv) {
          // Mechanism: False Memory / Fungal Succession
          // The center attempts to hold the memory of an Abelian Sandpile Mandala
          // while the edges are digested by a feral mycelial network.
          
          vec2 symUv = uv - 0.5;
          float angle = atan(symUv.y, symUv.x);
          float rad = length(symUv);
          
          // 8-fold symmetry folding
          float fold = mod(angle, PI / 4.0) - PI / 8.0; 
          vec2 foldedUv = rad * vec2(cos(fold), sin(fold)) + 0.5;
          
          // Memory strength fades with distance and time
          float memory = smoothstep(0.8, 0.0, rad) * (0.5 + 0.5 * sin(u_time * 0.2));
          vec2 p = mix(uv, foldedUv, memory);
          p *= 5.0; // Scale the petri dish
          
          // Vascular Branching / Lenia Advection
          for(int i = 0; i < 4; i++) {
              vec2 q = p + u_time * 0.12;
              float n = fbm(q);
              float a = n * PI * 4.0;
              // Anastomosis: hyphae fuse and redirect
              p += vec2(cos(a), sin(a)) * 0.35; 
          }
          
          // Plateau Foam (Weaire-Phelan relaxation)
          vec3 v = voronoi(p);
          float plateau = smoothstep(0.15, 0.0, v.y - v.x);
          float wetness = 0.5 + 0.5 * sin(u_time * 0.3);
          float foam = mix(plateau, 1.0 - v.x, wetness);
          
          // Lenia Organisms (Multi-kernel continuous CA)
          float lenia = 0.0;
          for(int i = 0; i < 4; i++) {
              float fi = float(i);
              vec2 c = hash2(vec2(fi * 17.3)) * 12.0 - 6.0;
              // Orbital friction maps
              c += vec2(sin(u_time * 0.25 + fi), cos(u_time * 0.3 - fi)) * 2.5;
              float r = length(p - c);
              
              // Multi-ring kernel (Ch0: body, Ch1: excitation, Ch2: inhibition)
              float body = exp(-pow(r - 0.4, 2.0)/0.02);
              float excite = 0.8 * exp(-pow(r - 0.8, 2.0)/0.04);
              float inhibit = -0.5 * exp(-pow(r - 1.2, 2.0)/0.06);
              lenia += body + excite + inhibit;
          }
          
          // Acoustic Impedance Tessellation (Speckle & Reverberation)
          float baseDensity = foam * 0.6 + lenia * 0.8 + v.z * 0.3;
          float speckle = hash(uv * 150.0 + u_time);
          float reverb = sin(baseDensity * 30.0 - u_time * 5.0) * 0.5 + 0.5;
          
          float density = baseDensity + speckle * 0.08 + reverb * 0.15;
          
          // Log compression (Ultrasound physics)
          density = log(density * 4.0 + 1.0) / 1.6;
          
          return density;
      }

      // ─── PERCEPTUAL COLOR MAPPING ────────────────────────────────────
      vec3 getColor(vec2 uv) {
          float d = getDensity(uv);
          
          // Machine Hesitation / Abelian Sandpile Criticality
          // The continuous field stutters into discrete toppling states
          float sandpile = floor(d * 12.0) / 12.0; 
          float mixD = mix(d, sandpile, 0.4 + 0.4 * sin(u_time * 0.5));
          
          // Reaction-Diffusion Contours / Enzymatic Decay fronts
          float contour = sin(mixD * 22.0 - u_time * 2.0) * 0.5 + 0.5;
          
          // Chromostereopsis axis mapping:
          // Red (700nm) advances, Blue (400nm) recedes.
          float lambda = mix(700.0, 400.0, clamp(contour, 0.0, 1.0));
          
          return wavelengthToRGB(lambda);
      }

      void main() {
          vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 uvCenter = (vUv - 0.5) * aspect;
          
          // Chromatic Aberration (Lateral Shift & Dispersion)
          vec2 dir = normalize(uvCenter);
          float dist = length(uvCenter);
          // Dispersion grows non-linearly toward the edges (Lens physics)
          float disp = 0.025 * dist * dist; 
          
          // Sample the soup 3 times to rip the spectrum apart
          vec3 colR = getColor(vUv + dir * disp);
          vec3 colG = getColor(vUv);
          vec3 colB = getColor(vUv - dir * disp);
          
          vec3 finalCol = vec3(colR.r, colG.g, colB.b);
          
          // Coma Stars / White-Hot Highlights
          // High-luminance peaks bleed outward radially
          float lum = dot(finalCol, vec3(0.2126, 0.7152, 0.0722));
          if (lum > 0.8) {
              float coma = smoothstep(0.8, 1.0, lum);
              // Additive solar bloom
              finalCol += vec3(1.0, 0.9, 0.6) * coma * dist * 0.8;
          }
          
          // Overall bloom
          finalCol += max(vec3(0.0), finalCol - 0.7) * 0.4;
          
          // Vignette (Microscope / Lens boundary)
          float vig = 1.0 - smoothstep(0.35, 1.3, dist);
          finalCol *= vig;
          
          // sRGB Gamma Correction
          fragColor = vec4(pow(clamp(finalCol, 0.0, 1.0), vec3(1.0/2.2)), 1.0);
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
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    throw e;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);