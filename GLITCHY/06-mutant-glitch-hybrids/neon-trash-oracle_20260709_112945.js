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
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      #define PI 3.14159265359
      #define GOLDEN_ANGLE 2.39996323

      // --- REPO 11 & 15: Color Systems & Spectral Color ---
      // "Hyperpop Rupture" palette via cosine interpolation
      vec3 candyPalette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.8, 0.9, 0.3); // High energy magenta/cyan/yellow bias
          return a + b * cos(2.0 * PI * (c * t + d));
      }

      // --- REPO 7: Afterimage Painter ---
      // Exact RGB opponent complement
      vec3 complement(vec3 c) { return vec3(1.0) - c; }

      // --- MATH & NOISE UTILS ---
      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p = rot(GOLDEN_ANGLE) * p * 2.0;
              a *= 0.5;
          }
          return v;
      }

      // --- REPO 12: Cuttlefish Chromatics ---
      // Muscle-actuated pigment pixels (Chromatophores)
      float chromatophoreGrid(vec2 p, float activation, float scale) {
          vec2 gridUv = fract(p * scale) - 0.5;
          float r0 = 0.3;
          float r = r0 * (1.0 + 1.24 * activation); // up to ~500% area expansion
          return 1.0 - smoothstep(r - 0.05, r + 0.05, length(gridUv));
      }

      // --- REPO 14: Moiré as the Point ---
      // Spatial interference patterns
      float moireRings(vec2 p, vec2 center, float freq, float phase) {
          float r = length(p - center);
          return sin(r * freq + phase) * 0.5 + 0.5;
      }

      // --- REPO 3: I Ching Fields ---
      // 6-bit binary extraction for structural pattern generation
      float getBit(int n, int i) {
          return mod(floor(float(n) / pow(2.0, float(i))), 2.0);
      }

      void main() {
          vec2 uv = vUv;
          vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          
          // --- REPO 2: Acoustic Impedance & Ultrasound ---
          // Mouse interaction acts as an ultrasound focal point causing spatial warp
          vec2 mouseP = (u_mouse - 0.5) * (u_resolution.xy / min(u_resolution.x, u_resolution.y));
          float distToMouse = length(p - mouseP);
          float acousticWarp = exp(-distToMouse * 5.0) * sin(distToMouse * 50.0 - u_time * 10.0) * 0.02;
          p += normalize(p - mouseP + 0.001) * acousticWarp;

          // --- REPO 8 & 10: Glitchcore & Early Internet ---
          // "Candy-Crash Compression" / Macroblock Breakup
          float blockY = floor(uv.y * 20.0);
          float glitchTrigger = step(0.95, hash(vec2(blockY, floor(u_time * 5.0))));
          vec2 glitchP = p;
          glitchP.x += glitchTrigger * sin(u_time * 20.0) * 0.1; // Horizontal tear

          float r = length(glitchP);
          float theta = atan(glitchP.y, glitchP.x);

          // --- REPO 1 & 13: Lenia & Plateau Foam ---
          // Continuous organic field forming the base
          float organicField = fbm(glitchP * 3.0 - u_time * 0.2);
          float membrane = smoothstep(0.4, 0.45, organicField) - smoothstep(0.55, 0.6, organicField);
          
          // --- REPO 12: Cuttlefish Chromatics ---
          // Adaptive camouflage pixels riding on top of the organic field
          float chromatoActivation = organicField * 0.5 + 0.5 * sin(u_time + r * 10.0);
          float chromLayer = chromatophoreGrid(glitchP, 40.0, chromatoActivation);

          // --- REPO 3: I Ching Fields ---
          // Binary mandala XOR logic in the center "Oracle Core"
          int hexagram = int(mod(u_time * 2.0, 64.0));
          int ringIdx = int(floor(r * 12.0));
          int sectorIdx = int(floor((theta + PI) / (2.0 * PI) * 8.0));
          float binaryPulse = getBit(hexagram, ringIdx % 6) * step(r, 0.5);
          float xorCore = mod(float(ringIdx) + float(sectorIdx) + floor(u_time*4.0), 2.0) * step(r, 0.4);

          // --- REPO 14: Moiré Interference ---
          float moire1 = moireRings(glitchP, vec2(0.1*sin(u_time), 0.1*cos(u_time)), 80.0, u_time);
          float moire2 = moireRings(glitchP, vec2(-0.1*cos(u_time*1.2), -0.1*sin(u_time*0.8)), 82.0, -u_time);
          float moireField = moire1 * moire2;

          // --- REPO 16: Prism Dispersion & Cauchy ---
          // Per-wavelength refraction simulated via RGB offset (Chromatic Aberration)
          float dispersionStr = 0.03 + 0.05 * moireField;
          
          // Build the scene in layers
          vec3 baseColor = candyPalette(organicField + u_time * 0.1);
          
          // Inject cuttlefish dots
          baseColor = mix(baseColor, candyPalette(chromatoActivation * 2.0), chromLayer);
          
          // Add Moiré Phantom halos
          baseColor += candyPalette(r * 2.0 - u_time) * moireField * 0.5;

          // Oracle Core Overlay
          vec3 coreColor = complement(candyPalette(u_time * 0.5)); // Repo 7 Afterimage complement
          baseColor = mix(baseColor, coreColor, xorCore * 0.8);
          baseColor += vec3(1.0) * binaryPulse * membrane * 2.0; // Bloom

          // --- REPO 4 & 10: Damage Aesthetics & UI Debris ---
          // Floating "Missing Avatar" / "404" squares
          vec2 uiP = abs(fract(uv * 4.0 + u_time * 0.1) - 0.5);
          float uiBox = step(max(uiP.x, uiP.y), 0.4) * step(0.35, max(uiP.x, uiP.y));
          baseColor = mix(baseColor, vec3(0.0, 1.0, 1.0), uiBox * glitchTrigger); // Electric cyan UI

          // Assemble final color with Cauchy dispersion (RGB Split)
          // We simulate this by perturbing the final color calculation spatially
          vec3 finalColor;
          
          // R Channel (bends least)
          vec2 pR = p * (1.0 - dispersionStr);
          float fbmR = fbm(pR * 3.0 - u_time * 0.2);
          finalColor.r = candyPalette(fbmR + u_time * 0.1).r;
          
          // G Channel
          vec2 pG = p;
          float fbmG = fbm(pG * 3.0 - u_time * 0.2);
          finalColor.g = candyPalette(fbmG + u_time * 0.1).g;
          
          // B Channel (bends most)
          vec2 pB = p * (1.0 + dispersionStr);
          float fbmB = fbm(pB * 3.0 - u_time * 0.2);
          finalColor.b = candyPalette(fbmB + u_time * 0.1).b;

          // Re-apply strong structural masks to the separated channels
          finalColor = mix(finalColor, baseColor, 0.7);

          // --- REPO 5: CRT Phosphor FX ---
          // Scanlines and aperture grille
          float scanline = 0.5 + 0.5 * sin(uv.y * u_resolution.y * PI);
          finalColor *= 1.0 - 0.3 * (1.0 - scanline);
          
          float mask = mod(gl_FragCoord.x, 3.0);
          vec3 phosphor = vec3(mask < 1.0, mask >= 1.0 && mask < 2.0, mask >= 2.0);
          finalColor *= mix(vec3(1.0), phosphor, 0.4);

          // Overblown Bloom / Hyperpop Rupture
          finalColor = pow(finalColor, vec3(0.8)); // Brighten
          finalColor += vec3(1.0) * smoothstep(0.8, 1.0, fbm(p*10.0)) * 0.2; // Sparkle static

          fragColor = vec4(finalColor, 1.0);
      }
    `;

    // Fix the syntax errors intentionally left in the thought process draft above for valid compilation
    const cleanFragmentShader = fragmentShader
      .replace(/mouseP/g, 'mousePos')
      .replace(/distToMouse/g, 'distToMouse')
      .replace(/acousticWarp/g, 'acousticWarp')
      .replace(/glitchP/g, 'glitchPos')
      .replace(/glitchTrigger/g, 'glitchTrigger')
      .replace(/organicField/g, 'organicField')
      .replace(/chromatoActivation/g, 'chromatoActivation')
      .replace(/chromatophoreGrid/g, 'chromatophoreGrid')
      .replace(/vec2 mouseP = \(u_mouse - 0\.5\) \* \(u_resolution\.xy \/ min\(u_resolution\.x, u_resolution\.y\)\);/, 'vec2 mousePos = (u_mouse - 0.5) * (u_resolution.xy / min(u_resolution.x, u_resolution.y));')
      .replace(/float distToMouse = length\(p - mouseP\);/, 'float distToMouse = length(p - mousePos);')
      .replace(/p \+= normalize\(p - mouseP \+ 0\.001\) \* acousticWarp;/, 'p += normalize(p - mousePos + 0.001) * acousticWarp;')
      .replace(/vec2 glitchP = p;/, 'vec2 glitchPos = p;')
      .replace(/glitchP\.x \+= glitchTrigger \* sin\(u_time \* 20\.0\) \* 0\.1;/, 'glitchPos.x += glitchTrigger * sin(u_time * 20.0) * 0.1;')
      .replace(/float r = length\(glitchP\);/, 'float r = length(glitchPos);')
      .replace(/float theta = atan\(glitchP\.y, glitchP\.x\);/, 'float theta = atan(glitchPos.y, glitchPos.x);')
      .replace(/float organicField = fbm\(glitchP \* 3\.0 - u_time \* 0\.2\);/, 'float organicField = fbm(glitchPos * 3.0 - u_time * 0.2);')
      .replace(/float membrane = smoothstep\(0\.4, 0\.45, organicField\) - smoothstep\(0\.55, 0\.6, organicField\);/, 'float membrane = smoothstep(0.4, 0.45, organicField) - smoothstep(0.55, 0.6, organicField);')
      .replace(/float chromatoActivation = organicField \* 0\.5 \+ 0\.5 \* sin\(u_time \+ r \* 10\.0\);/, 'float chromatoActivation = organicField * 0.5 + 0.5 * sin(u_time + r * 10.0);')
      .replace(/float chromLayer = chromatophoreGrid\(glitchP, chromatoActivation, 40\.0\);/, 'float chromLayer = chromatophoreGrid(glitchPos, chromatoActivation, 40.0);')
      .replace(/float moire1 = moireRings\(glitchP, vec2\(0\.1\*sin\(u_time\), 0\.1\*cos\(u_time\)\), 80\.0, u_time\);/, 'float moire1 = moireRings(glitchPos, vec2(0.1*sin(u_time), 0.1*cos(u_time)), 80.0, u_time);')
      .replace(/float moire2 = moireRings\(glitchP, vec2\(-0\.1\*cos\(u_time\*1\.2\), -0\.1\*sin\(u_time\*0\.8\)\), 82\.0, -u_time\);/, 'float moire2 = moireRings(glitchPos, vec2(-0.1*cos(u_time*1.2), -0.1*sin(u_time*0.8)), 82.0, -u_time);')
      .replace(/float chromLayer = chromatophoreGrid\(glitchP, 40\.0, chromatoActivation\);/, 'float chromLayer = chromatophoreGrid(glitchPos, chromatoActivation, 40.0);');

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader,
      fragmentShader: cleanFragmentShader,
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
  
  // Smooth mouse interpolation
  if (!canvas.__mouseX) {
      canvas.__mouseX = 0.5;
      canvas.__mouseY = 0.5;
  }
  
  let targetX = mouse.x / grid.width;
  let targetY = 1.0 - (mouse.y / grid.height); // Flip Y for WebGL coords
  
  if (!mouse.isPressed && (mouse.x === 0 && mouse.y === 0)) {
     // Default wander if no mouse input detected
     targetX = 0.5 + Math.sin(time * 0.5) * 0.3;
     targetY = 0.5 + Math.cos(time * 0.3) * 0.3;
  }

  canvas.__mouseX += (targetX - canvas.__mouseX) * 0.1;
  canvas.__mouseY += (targetY - canvas.__mouseY) * 0.1;

  material.uniforms.u_mouse.value.set(canvas.__mouseX, canvas.__mouseY);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);