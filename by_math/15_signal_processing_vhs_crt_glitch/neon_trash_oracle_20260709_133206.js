/**
 * NEON TRASH ORACLE WEATHER SYSTEM
 * 
 * A feral hybridization of the provided repos.
 * 
 * INGREDIENTS EXTRACTED:
 * - [plateau_foam] + [lenia]: Midground cellular slime-weather. Voronoi relaxation morphed into a continuous reaction-diffusion pulse.
 * - [cuttlefish_chromatics]: The cells act as "chromatophores", expanding and contracting their pigment radii based on a neural time-field.
 * - [runic_galdr] + [i_ching_fields]: The central Oracle Core. Polar-coordinate hexagrams and bindrune fragments spinning in resonance.
 * - [moire] + [op_art_style]: The background is a "liquid sinusoidal moiré" causing perceptual instability.
 * - [prism_dispersion] + [glitchcore_style]: "Diamond Fire" chromatic aberration and "Candy-Crash Compression" tearing across the field.
 * - [color_systems] + [shoegaze_style]: Hyperpop/acid palette mapped through perceptual gradients, drowned in film grain and halation bloom.
 * - [early_internet_aesthetic] + [damage_aesthetics]: CRT scanlines, dead pixel sparks, and scraped-data ticker bands.
 */

try {
  // Guard: Ensure we have a WebGL2 context via Three.js
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1.0;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      // glslVersion: THREE.GLSL3 applies implicitly via ShaderMaterial
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      #define PI 3.14159265359
      #define TWO_PI 6.28318530718

      // [color_systems] + [glitchcore_style] Hyperpop Acid Palette
      vec3 acidPalette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          // Offsets for Hot Pink, Electric Cyan, Neon Yellow, Ultraviolet
          vec3 d = vec3(0.8, 0.3, 0.5); 
          return a + b * cos(TWO_PI * (c * t + d));
      }

      // Procedural Hash / Noise (The Entropy Mutator)
      float hash1(float n) { return fract(sin(n) * 43758.5453123); }
      float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 19.19);
          return fract(p.x * p.y);
      }
      vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
      }

      // [moire] Wave Sinusoidal Interference
      float liquidMoire(vec2 p, float t) {
          float w1 = sin(p.x * 20.0 + t) * cos(p.y * 15.0 - t * 0.5);
          float w2 = sin((p.x + p.y) * 12.0 + t * 1.2);
          float w3 = cos(length(p) * 25.0 - t * 2.0);
          return smoothstep(-0.5, 1.5, w1 * w2 + w3 * 0.5);
      }

      // [plateau_foam] + [cuttlefish_chromatics] Cellular Slime
      // Returns: x = center dist, y = border dist (Plateau edge), z = cell id
      vec3 chromatophoreFoam(vec2 uv, float t) {
          vec2 g = floor(uv);
          vec2 f = fract(uv);
          float d1 = 8.0;
          float d2 = 8.0;
          float id = 0.0;
          
          for(int y = -1; y <= 1; y++) {
              for(int x = -1; x <= 1; x++) {
                  vec2 lattice = vec2(x, y);
                  vec2 offset = hash22(g + lattice);
                  
                  // Cuttlefish muscle pulse: cells expand and contract
                  float pulse = 0.5 + 0.5 * sin(t * 2.0 + 6.28 * offset.x);
                  offset = 0.5 + 0.4 * pulse * sin(t + 6.28 * offset);
                  
                  vec2 r = lattice + offset - f;
                  float d = dot(r, r);
                  
                  if(d < d1) {
                      d2 = d1;
                      d1 = d;
                      id = hash21(g + lattice);
                  } else if(d < d2) {
                      d2 = d;
                  }
              }
          }
          return vec3(sqrt(d1), d2 - d1, id);
      }

      // [i_ching_fields] + [runic_galdr] The Oracle Core
      float galdrCore(vec2 p, float t) {
          float r = length(p);
          float a = atan(p.y, p.x);
          
          // Concentric resonance rings (Galdr)
          float rings = sin(r * 40.0 - t * 4.0);
          rings = smoothstep(0.8, 1.0, rings);
          
          // I-Ching / Runic broken staves (Polar quantization)
          float segments = 12.0; // 12-fold symmetry
          float polarQuant = floor(a * segments / TWO_PI);
          float dash = fract(a * segments / TWO_PI);
          
          // Changing lines (cellular automaton logic simulation)
          float activeLine = step(0.5, hash1(polarQuant + floor(t * 2.0)));
          float stave = step(0.1, dash) * step(dash, 0.9) * activeLine;
          
          // Combine rings and staves within a specific radius
          float coreMask = smoothstep(0.4, 0.35, r) * smoothstep(0.1, 0.15, r);
          
          return (rings + stave) * coreMask;
      }

      void main() {
          // Normalize coordinates
          vec2 uv = (vUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 mouse = (u_mouse - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
          float t = u_time * 0.5;

          // --- [dream_physics] Mnemonic Gravity / Non-Euclidean Lens ---
          // Mouse pulls the space like a memory well
          vec2 toMouse = mouse - uv;
          float distToMouse = length(toMouse);
          vec2 warpedUV = uv + toMouse * exp(-distToMouse * 5.0) * 0.2 * sin(t);

          // --- [glitchcore_style] Candy-Crash Compression Chew ---
          // Quantize horizontal bands occasionally
          if (hash1(floor(warpedUV.y * 10.0) + floor(t * 4.0)) > 0.95) {
              warpedUV.x = floor(warpedUV.x * 30.0) / 30.0;
          }

          // --- LAYER 1: The Deep Void (Moiré + Acid Palette) ---
          float moireVal = liquidMoire(warpedUV * 2.0, t);
          vec3 bgColor = acidPalette(moireVal * 0.5 + t * 0.1) * 0.4;
          // Avoid dull black: ensure minimum luminous presence
          bgColor += vec3(0.05, 0.0, 0.1); 

          // --- LAYER 2: Chromatophore Foam (Midground) ---
          vec3 foamData = chromatophoreFoam(warpedUV * 5.0, t);
          float cellDist = foamData.x;
          float borderDist = foamData.y;
          float cellId = foamData.z;

          // Plateau border highlight
          float borderGlow = smoothstep(0.05, 0.0, borderDist);
          // Cell interior pigment
          vec3 cellColor = acidPalette(cellId + t * 0.2);
          // Cuttlefish iridophore under-glow (view-dependent shimmer simulated by noise)
          float shimmer = smoothstep(0.2, 0.8, sin(cellDist * 20.0 - t * 5.0));
          
          vec3 midColor = mix(bgColor, cellColor * shimmer, smoothstep(0.4, 0.2, cellDist));
          midColor += acidPalette(borderDist * 10.0) * borderGlow * 1.5; // Neon veins

          // --- LAYER 3: The Oracle Core (Foreground) ---
          // [prism_dispersion] Diamond Fire Chromatic Aberration on the core
          vec2 coreUV = uv - mouse * 0.2; // Parallax
          
          float coreR = galdrCore(coreUV * (1.0 - 0.02 * sin(t)), t);
          float coreG = galdrCore(coreUV, t);
          float coreB = galdrCore(coreUV * (1.0 + 0.02 * cos(t)), t);
          
          vec3 oracleGlow = vec3(coreR, coreG, coreB);
          // Boost Oracle bloom
          oracleGlow = pow(oracleGlow, vec3(1.5)) * 2.5;

          // Combine Layers
          vec3 finalColor = mix(midColor, oracleGlow, clamp(length(oracleGlow), 0.0, 1.0));

          // --- [early_internet_aesthetic] & [damage_aesthetics] Post-FX ---
          
          // Scraped-data ticker band (Glitch overlay)
          float tickerMask = step(0.98, fract(vUv.y * 5.0 + t * 0.1));
          float tickerData = step(0.5, hash1(floor(vUv.x * 50.0) + floor(t * 10.0)));
          finalColor += vec3(0.0, 1.0, 0.8) * tickerMask * tickerData * 0.8;

          // CRT Scanlines
          float scanline = 0.5 + 0.5 * sin(vUv.y * u_resolution.y * 0.5);
          finalColor *= 0.9 + 0.1 * scanline;

          // Hot / Dead Pixels (Sensor Noise)
          float pixelNoise = hash21(vUv * u_resolution + fract(t));
          if (pixelNoise > 0.995) finalColor = vec3(1.0, 0.96, 0.0); // Neon yellow spark
          if (pixelNoise < 0.005) finalColor = vec3(0.0); // Dead pixel

          // [shoegaze_style] Vignette & Halation Bloom
          float vignette = 1.0 - smoothstep(0.5, 1.5, length(vUv - 0.5));
          finalColor *= vignette;
          
          // Soften and push to perceptual output (approximate OKLab vibrancy boost)
          finalColor = mix(finalColor, smoothstep(0.0, 1.0, finalColor), 0.2);

          fragColor = vec4(finalColor, 1.0);
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

  // Update loop
  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Smooth mouse interpolation for the mnemonic gravity well
    if (!material.__smoothedMouse) material.__smoothedMouse = { x: 0.5, y: 0.5 };
    const targetMouseX = mouse.isPressed ? mouse.x / grid.width : 0.5 + Math.sin(time * 0.3) * 0.2;
    const targetMouseY = mouse.isPressed ? 1.0 - (mouse.y / grid.height) : 0.5 + Math.cos(time * 0.4) * 0.2;
    
    material.__smoothedMouse.x += (targetMouseX - material.__smoothedMouse.x) * 0.05;
    material.__smoothedMouse.y += (targetMouseY - material.__smoothedMouse.y) * 0.05;
    
    material.uniforms.u_mouse.value.set(material.__smoothedMouse.x, material.__smoothedMouse.y);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Oracle Weather System Initialization Failed:", e);
  throw e;
}