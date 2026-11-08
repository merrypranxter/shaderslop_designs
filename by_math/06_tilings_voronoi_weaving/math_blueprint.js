try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: true
    });
    
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
      
      out vec4 fragColor;
      
      #define PI 3.14159265359

      // --- STRUCTURAL COLOR PALETTE (Repo 3) ---
      vec3 thinFilm(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.0, 0.33, 0.67);
          return a + b * cos(2.0 * PI * (c * t + d));
      }

      // --- HEXAGONAL TESSELLATION (Repo 4) ---
      vec4 hexCoords(vec2 uv) {
          vec2 r = vec2(1.0, 1.73205081);
          vec2 h = r * 0.5;
          vec2 a = mod(uv, r) - h;
          vec2 b = mod(uv - h, r) - h;
          vec2 gv = dot(a, a) < dot(b, b) ? a : b;
          vec2 id = uv - gv;
          return vec4(gv.x, gv.y, id.x, id.y);
      }

      float hexDist(vec2 p) {
          p = abs(p);
          return max(dot(p, normalize(vec2(1.0, 1.73205081))), p.x);
      }

      // --- MOIRÉ SPIRAL PHANTOMS (Repo 2) ---
      float spiral(vec2 uv, float tightness, float rotation, float arms) {
          float r = length(uv);
          float angle = atan(uv.y, uv.x);
          float phase = angle * arms + log(r + 0.0001) * tightness + rotation;
          return sin(phase);
      }

      // High-frequency hash for entropic degradation
      float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
          float t = u_time * 0.4;

          // 1. BASE BLUEPRINT: Deep cyan/navy
          vec3 bg = vec3(0.02, 0.06, 0.15) - length(uv) * 0.15;

          // 2. MATHEMATICAL TENSION: Competing Spiral Moiré Fields
          // Two spirals counter-rotating create a phantom interference pattern
          float s1 = spiral(uv, 45.0, t, 7.0);
          float s2 = spiral(uv, 46.5, -t * 0.8, 7.0);
          float stressField = s1 * s2; 

          // Topographic lines revealing the underlying stress field
          float topoLines = smoothstep(0.95, 1.0, sin(stressField * 40.0 - t * 3.0));
          bg += vec3(0.05, 0.15, 0.3) * topoLines;

          // 3. DOMAIN WARPING: The Euclidean grid is bent by the Moiré stress
          vec2 warpedUV = uv + normalize(uv + 0.001) * stressField * 0.04;

          // 4. CHROMATIC SEPARATION & KINTSUGI (Repos 1 & 2)
          vec3 gridLines = vec3(0.0);
          vec3 structuralGlow = vec3(0.0);
          
          float globalNoise = hash21(uv * 10.0 + t);

          // We render the grid 3 times (R, G, B) with slight scale/rotation offsets.
          // Where they align, the blueprint lines are white. 
          // Where they misalign due to the scale differential, Chromatic Moiré emerges.
          for(int i = 0; i < 3; i++) {
              float fi = float(i);
              
              // Scale differential is the engine of the moiré
              float scale = 22.0 + fi * 0.15; 
              
              // Rotational drift
              float angle = fi * 0.01 + sin(t * 0.5) * 0.02;
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              vec2 c_uv = warpedUV * rot;
              
              vec4 hex = hexCoords(c_uv * scale);
              float hd = hexDist(hex.xy);
              
              // OBSESSIVE BLUEPRINT DRAFTING
              // Outer cell wall
              float line = smoothstep(0.05, 0.0, abs(hd - 0.5));
              // Inner concentric echo
              line += smoothstep(0.015, 0.0, abs(hd - 0.38)) * 0.5;
              // Center registration mark
              line += smoothstep(0.04, 0.0, length(hex.xy)) * 0.7;
              // Radial spokes (6-fold symmetry constraint)
              float hexAngle = atan(hex.y, hex.x);
              float spokes = sin(hexAngle * 6.0);
              line += smoothstep(0.98, 1.0, spokes) * 0.3 * smoothstep(0.0, 0.3, hd);

              // Entropic degradation: paper grain eats the lines where stress is low
              line *= smoothstep(0.1, 0.4, globalNoise + abs(stressField) * 0.8);

              // Assign to specific RGB channel
              gridLines[i] = line;

              // STRUCTURAL COLOR & SHINE (Repo 1 & 3)
              // Color pools in the cells based on mathematical tension and time
              float cellPhase = sin(hex.z * 0.2 + hex.w * 0.3 + t);
              float filmThickness = stressField * 0.5 + 0.5 + cellPhase * 0.2;
              vec3 iridescence = thinFilm(filmThickness);
              
              // Kintsugi Logic: The grid only shines where the moiré stress fractures it
              float kintsugi = smoothstep(0.7, 0.95, abs(stressField));
              
              // Rare explosive glints
              float glint = smoothstep(0.98, 1.0, sin(hex.z * 17.3 + hex.w * 29.6 + t * 4.0));
              
              structuralGlow += iridescence * kintsugi * (1.0 - hd) * 0.6;
              structuralGlow += glint * vec3(1.0, 0.9, 0.8) * kintsugi * 2.0;
          }

          // 5. COMPOSITING
          vec3 finalColor = bg;
          
          // Print Misregistration: additive RGB lines over the dark blueprint
          finalColor.r += gridLines.r * 0.8;
          finalColor.g += gridLines.g * 0.9;
          finalColor.b += gridLines.b * 1.0;
          
          // Add the feral structural color bleeding through the fractures
          finalColor += structuralGlow;

          // Vignette & Contrast
          finalColor = smoothstep(0.0, 1.2, finalColor);
          finalColor *= 1.0 - dot(uv, uv) * 0.6;

          fragColor = vec4(finalColor, 1.0);
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
  console.error("WebGL Initialization Failed:", e);
}