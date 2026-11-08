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
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      // The Three Time Scales
      // Slow: Global tectonic drift & domain warping
      // Med:  Structural cleavage growth & fluid advection
      // Fast: High-frequency lattice shimmer & Bragg diffraction
      #define T_SLOW (u_time * 0.05)
      #define T_MED  (u_time * 0.3)
      #define T_FAST (u_time * 3.0)

      // Feral PRNG
      float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      vec2 hash22(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.xx + p3.yz) * p3.zy);
      }

      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      // Art Nouveau Whiplash Domain Warp
      vec2 whiplash(vec2 p) {
          vec2 pp = p;
          for(float i = 1.0; i <= 3.0; i++) {
              pp.x += sin(p.y * 2.0 * i + T_SLOW) * 0.5 / i;
              pp.y += cos(p.x * 1.5 * i - T_SLOW) * 0.5 / i;
              p = rot(0.1 * sin(T_SLOW)) * pp;
          }
          return p;
      }

      // Neon CMY Palette Generator (The Neon Rule against The Void Rule)
      // Mathematically guarantees pure CMY peaks
      vec3 neonCMY(float t) {
          float c = pow(0.5 + 0.5 * sin(t * 6.28318 + 0.0), 24.0);
          float m = pow(0.5 + 0.5 * sin(t * 6.28318 + 2.094), 24.0);
          float y = pow(0.5 + 0.5 * sin(t * 6.28318 + 4.188), 24.0);
          return vec3(m + y, c + y, c + m);
      }

      // Birefringent Lithogenesis Lattice (Cellular + L-infinity hybrid)
      vec4 lattice(vec2 p) {
          vec2 id = floor(p);
          vec2 f = fract(p);
          
          float minDist = 10.0;
          float secondMinDist = 10.0;
          vec2 closestCell;
          
          for(int y = -1; y <= 1; y++) {
              for(int x = -1; x <= 1; x++) {
                  vec2 neighbor = vec2(float(x), float(y));
                  vec2 pt = hash22(id + neighbor);
                  
                  // Medium scale: Cellular drift
                  pt = 0.5 + 0.4 * sin(T_MED + 6.2831 * pt);
                  
                  vec2 diff = neighbor + pt - f;
                  
                  // Anisotropic L-infinity metric for cubic/bismuth cleavage planes
                  diff *= rot(T_SLOW + hash12(id) * 2.0);
                  float dist = max(abs(diff.x), abs(diff.y)) * 0.8 + length(diff) * 0.2;
                  
                  if(dist < minDist) {
                      secondMinDist = minDist;
                      minDist = dist;
                      closestCell = id + neighbor;
                  } else if(dist < secondMinDist) {
                      secondMinDist = dist;
                  }
              }
          }
          
          float cleavage = secondMinDist - minDist;
          return vec4(minDist, cleavage, closestCell.x, closestCell.y);
      }

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          p.x *= u_resolution.x / u_resolution.y;

          // Apply slow tectonic Art Nouveau warping
          vec2 warpedP = whiplash(p * 3.0);
          
          // Deep internal structure (Layer 1)
          vec4 crystal1 = lattice(warpedP * 2.0 + vec2(T_SLOW));
          // Surface structure (Layer 2)
          vec4 crystal2 = lattice(warpedP * 4.0 - vec2(T_SLOW * 0.5));
          
          float cleav1 = crystal1.y;
          float cleav2 = crystal2.y;
          
          float hash1 = hash12(crystal1.zw);
          float hash2 = hash12(crystal2.zw);
          
          // High-frequency Bragg diffraction phase offsets
          float bragg1 = crystal1.x * 10.0 - cleav1 * 5.0 + hash1 * 10.0 + T_FAST;
          float bragg2 = crystal2.x * 20.0 - cleav2 * 10.0 + hash2 * 10.0 - T_FAST * 1.5;
          
          vec3 col = vec3(0.0);
          
          // Accumulate neon light from deep cleavage fractures
          vec3 neon1 = neonCMY(bragg1 * 0.1);
          col += neon1 * smoothstep(0.15, 0.0, cleav1) * 1.5;
          
          // Accumulate neon light from surface fractures
          vec3 neon2 = neonCMY(bragg2 * 0.1);
          col += neon2 * smoothstep(0.08, 0.0, cleav2) * 2.5;
          
          // Moiré vibration pattern on the flat crystal faces (Cyan/Magenta tension)
          float moire = sin(dot(p, vec2(cos(hash2 * 6.28), sin(hash2 * 6.28))) * 250.0 + T_FAST);
          moire = smoothstep(0.9, 1.0, moire);
          col += neonCMY(hash2 + T_FAST * 0.2) * moire * smoothstep(0.0, 0.2, cleav2) * 0.6;

          // Physical substance grain / noise
          float grain = hash12(vUv * u_resolution + u_time);
          col *= 0.8 + 0.2 * grain;
          
          // The Void Rule: Background must be abyssal
          col = max(col, vec3(0.005, 0.0, 0.01)); 
          
          // Crush contrast for intense saturation
          col = pow(col, vec3(1.1));

          // Subtle vignette
          float vig = length(p);
          col *= smoothstep(2.5, 0.5, vig);

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
    console.error("Feral WebGL Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);