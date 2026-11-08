if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      // CORE MATH: Hash and Value Noise (Foam / Mycelial / Lenia / Datamosh)
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      // FBM: Multi-scale fluid warping
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for(int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      // CROSS-PROCESSING: Photographic S-Curve Contrast
      vec3 sCurve(vec3 c, float contrast, float pivot) {
        vec3 p = vec3(pivot);
        vec3 a = 1.0 / (1.0 + exp(-contrast * (c - p)));
        vec3 lo = vec3(1.0 / (1.0 + exp(-contrast * (vec3(0.0) - p))));
        vec3 hi = vec3(1.0 / (1.0 + exp(-contrast * (vec3(1.0) - p))));
        return (a - lo) / (hi - lo);
      }

      // SPECTRAL COLOR / REACTION-DIFFUSION: Candy-Acid Palette
      vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      // UNIFIED SYSTEM: The Coherent Computational Soup
      float field(vec2 p) {
        // DATAMOSH: Macroblock motion vector bleeding
        vec2 block = floor(p * 16.0) / 16.0;
        float moshTime = floor(u_time * 5.0) / 5.0; // I-frame freezing
        vec2 moshDisp = vec2(hash(block + moshTime), hash(block + moshTime + 1.0)) * 0.06;
        p += moshDisp * smoothstep(0.7, 1.0, noise(vec2(u_time * 0.5, 0.0)));

        // GLITCH STRATA: Horizontal shearing / tearing
        float strata = step(0.95, hash(vec2(floor(p.y * 15.0), u_time * 0.2))) * 0.15;
        p.x += strata * (hash(vec2(u_time, 0.0)) - 0.5);

        // LENIA / MYCELIAL: Organic, continuous fluid warping
        vec2 q = p + vec2(fbm(p * 2.0 + u_time * 0.2), fbm(p * 2.0 - u_time * 0.15));
        vec2 r = p + vec2(fbm(q * 3.0 - u_time * 0.1), fbm(q * 3.0 + u_time * 0.25));

        // QUASICRYSTALS / MOIRÉ: 5-Fold aperiodic interference (Penrose / Radial Beats)
        float qc = 0.0;
        for(int i = 0; i < 5; i++) {
          float angle = float(i) * 3.14159265 * 0.2;
          vec2 dir = vec2(cos(angle), sin(angle));
          qc += cos(dot(r, dir) * 15.0 + u_time);
        }
        qc = qc * 0.2 + 0.5;

        // VASCULAR / FOAM: Ridged noise for branching veins and Plateau borders
        float ridge = 1.0 - abs(fbm(r * 5.0) * 2.0 - 1.0);
        ridge = pow(ridge, 3.0);

        // VIBRATION / CHLADNI: Acoustic resonance nodes
        float chladni = abs(cos(p.x * 20.0) * cos(p.y * 20.0) - cos(p.x * 20.0 + u_time));
        
        return qc * 0.35 + ridge * 0.55 + chladni * 0.1;
      }

      void main() {
        vec2 p = (vUv - 0.5) * u_resolution / u_resolution.y;
        
        // CHROMATIC ABERRATION: Radial displacement per channel
        float focus = length(p);
        float ca = 0.02 + 0.03 * focus; 
        vec2 dir = normalize(p + 0.001);
        
        float fR = field(p + dir * ca);
        float fG = field(p);
        float fB = field(p - dir * ca * 0.6); // Blue shifts inward differently
        
        // METAMERISM: Assembling the spectral field
        vec3 col = vec3(
          palette(fR + u_time * 0.1).r,
          palette(fG + u_time * 0.11).g,
          palette(fB + u_time * 0.12).b
        );
        
        // CROSS-PROCESSING: Aggressive S-Curve
        col = sCurve(col, 8.0, 0.45);
        
        // SPLIT TONING: Cyan shadows, Orange highlights
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 shadowTone = mix(col, col * vec3(0.0, 0.8, 1.0) * 2.0, 0.5);
        vec3 highlightTone = mix(col, 1.0 - (1.0 - col) * (1.0 - vec3(1.0, 0.6, 0.1)), 0.5);
        float shW = 1.0 - smoothstep(0.0, 0.5, l);
        float hiW = smoothstep(0.5, 1.0, l);
        col = mix(col, shadowTone, shW * 0.8);
        col = mix(col, highlightTone, hiW * 0.8);
        
        // CHROMOSTEREOPSIS: Force Max Saturation (Candy-Acid Output)
        float maxC = max(col.r, max(col.g, col.b));
        if(maxC > 0.0) col /= maxC;
        
        // ABELIAN SANDPILE / LENIA: Hot glowing blooms at max concentration
        float bloom = smoothstep(0.75, 1.0, fG);
        col += vec3(1.0, 0.2, 0.8) * bloom * 2.0;
        
        // CRT PHOSPHOR FX: Aperture Grille subpixel mask
        float maskCol = mod(gl_FragCoord.x, 3.0);
        vec3 stripe = vec3(
          smoothstep(1.0, 0.0, abs(maskCol - 0.5)),
          smoothstep(1.0, 0.0, abs(maskCol - 1.5)),
          smoothstep(1.0, 0.0, abs(maskCol - 2.5))
        );
        col *= mix(vec3(1.0), stripe, 0.3);
        
        // CRT PHOSPHOR FX: Horizontal Damper Wires
        float w1 = exp(-pow(vUv.y - 0.33, 2.0) / 0.0009);
        float w2 = exp(-pow(vUv.y - 0.66, 2.0) / 0.0009);
        col *= 1.0 - 0.2 * (w1 + w2); 
        
        // ACOUSTIC IMPEDANCE: High-frequency ultrasound speckle noise
        float speckle = hash(vUv + u_time) * 0.1;
        col += speckle;
        
        fragColor = vec4(col, 1.0);
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