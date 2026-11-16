if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: false, // Antialiasing off to preserve raw dither pixelation
      powerPreference: "high-performance"
    });

    const scene = new THREE.Scene();
    // Use an OrthographicCamera to perfectly map the plane to the screen
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        // Bypass projection matrices for a direct full-screen quad
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      // 3D Hash & Noise for FBM
      float hash3(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float noise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
              mix(mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                  mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
              mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                  mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
      }

      float fbm3(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i = 0; i < 4; i++) {
              f += amp * noise3(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      void main() {
          // Normalize coordinates to [-1, 1] with aspect ratio correction
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;

          // Three simultaneous time scales
          float t_slow = u_time * 0.05;
          float t_med = u_time * 0.2;
          float frame = floor(u_time * 24.0); // 24fps filmic shimmer

          // Feral Machine Hesitation (Glitch Tearing)
          float tear = step(0.98, fract(sin(frame * 13.1) * 43758.5453));
          if (tear > 0.5) {
              float tear_offset = (fract(sin(floor(gl_FragCoord.y * 0.05) + frame) * 43758.5453) - 0.5) * 0.3;
              p.x += tear_offset;
          }

          // Morphogenesis Domain Warp (Fluid Base)
          vec2 z = p * 2.0;
          float qx = fbm3(vec3(z, t_slow));
          float qy = fbm3(vec3(z + vec2(5.2, 1.3), t_slow));
          z += vec2(qx, qy) * 1.5;

          vec3 density = vec3(0.0);
          vec2 w = z;

          // Kleinian Apollonian Inversion with Entropy Mutator
          for(int i = 0; i < 7; i++) {
              w = abs(w) - 0.5;
              
              // Math Corruption / Entropy Injection
              float entropy = step(0.97, fract(sin(frame * 0.05 + float(i)) * 43758.5));
              w += entropy * (fract(vec2(w.y, w.x) * 123.45) - 0.5) * 0.15;
              
              float r2 = dot(w, w);
              
              // "Forbidden" singularity artifact detection
              float singularity = 1.0 / (r2 + 1e-5);
              
              if (r2 < 0.1) {
                  w *= 10.0;
              } else if (r2 < 1.0) {
                  w *= 1.0 / r2;
              }
              
              // Mobius-like rotation and translation
              float a = t_med * 0.5 + float(i) * 1.618;
              float c = cos(a), s = sin(a);
              w = vec2(w.x * c - w.y * s, w.x * s + w.y * c);
              w = w * 1.2 - vec2(0.2, 0.1);
              
              // Accumulate structural elements along anisotropic axes
              density.x += exp(-abs(w.x) * 2.0); // Cyan fibers
              density.y += exp(-abs(w.y) * 2.0); // Magenta fibers
              // Yellow nodes + Singularity flashes
              density.z += exp(-length(w) * 2.0) + step(1000.0, singularity) * 0.5; 
          }

          // Normalize accumulated densities
          float wC = (density.x / 7.0);
          float wM = (density.y / 7.0);
          float wY = (density.z / 7.0);

          // Multi-scale Turing/FBM structural modulation
          wC *= fbm3(vec3(p * 2.0, t_med)) * 2.5;
          wM *= fbm3(vec3(p * 2.0 + 10.0, t_med)) * 2.5;
          wY *= fbm3(vec3(p * 2.0 + 20.0, t_med)) * 3.0; // Yellow pops more intensely

          // Base void weight (Vignette)
          float wK = 0.5 + dot(p, p) * 0.4;

          // Dither Confetti / Fast Detail Shimmer
          float seed1 = dot(gl_FragCoord.xy, vec2(12.9898, 78.233));
          float seed2 = dot(gl_FragCoord.xy, vec2(39.346, 11.135));

          float rC = fract(sin(seed1 + frame * 1.1) * 43758.5453);
          float rM = fract(sin(seed2 + frame * 1.2) * 43758.5453);
          float rY = fract(sin(seed1 - seed2 + frame * 1.3) * 43758.5453);
          float rK = fract(sin(seed1 + seed2 + frame * 1.4) * 43758.5453);

          // Apply probabilistic CMYK thresholding
          float pC = wC + rC * 1.2;
          float pM = wM + rM * 1.2;
          float pY = wY + rY * 1.2;
          float pK = wK + rK * 1.2;

          float max_p = max(max(pC, pM), max(pY, pK));

          // Strict assignment to pure CMYK components (Void Black, Neon Cyan/Magenta/Yellow)
          vec3 col = vec3(0.0);
          if (max_p == pC) col = vec3(0.0, 1.0, 1.0);
          else if (max_p == pM) col = vec3(1.0, 0.0, 1.0);
          else if (max_p == pY) col = vec3(1.0, 1.0, 0.0);
          // Else remains vec3(0.0) for Void Black

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
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  if (material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material.uniforms.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);