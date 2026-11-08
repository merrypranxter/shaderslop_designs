if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

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

      // --- Hash & Noise Functions ---
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
      }

      float hash1(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash1(i);
        float b = hash1(i + vec2(1.0, 0.0));
        float c = hash1(i + vec2(0.0, 1.0));
        float d = hash1(i + vec2(1.0, 1.0));
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

      // --- Crackle Network (Anisotropic Voronoi) ---
      // Adapted from resist_dye_patterns (wax crackle) and mycelial_networks (anastomosis)
      vec3 voronoi(vec2 p) {
        vec2 n = floor(p);
        vec2 f = fract(p);
        float F1 = 8.0;
        float F2 = 8.0;
        vec2 mr;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash2(n + g);
            // Medium Time Scale: Structural Motion / Cell Jitter
            o = 0.5 + 0.5 * sin(u_time * 0.3 + 6.2831 * o);
            vec2 r = g - f + o;
            float d = dot(r, r);
            if (d < F1) {
              F2 = F1;
              F1 = d;
              mr = r;
            } else if (d < F2) {
              F2 = d;
            }
          }
        }
        return vec3(sqrt(F1), sqrt(F2), F2 - F1);
      }

      // --- Perceptual Color Math (OKLab) ---
      // Sourced from color_systems repo to prevent muddy midpoints
      vec3 linear_srgb_to_oklab(vec3 c) {
        float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
        float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
        float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
        float l_ = pow(max(l, 0.0), 1.0/3.0);
        float m_ = pow(max(m, 0.0), 1.0/3.0);
        float s_ = pow(max(s, 0.0), 1.0/3.0);
        return vec3(
          0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
          1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
          0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        );
      }

      vec3 oklab_to_linear_srgb(vec3 c) {
        float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
        float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
        float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
        float l = l_ * l_ * l_;
        float m = m_ * m_ * m_;
        float s = s_ * s_ * s_;
        return vec3(
           4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        );
      }

      vec3 oklab_mix(vec3 c1, vec3 c2, float t) {
        vec3 o1 = linear_srgb_to_oklab(c1);
        vec3 o2 = linear_srgb_to_oklab(c2);
        return oklab_to_linear_srgb(mix(o1, o2, t));
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // --- Slow Time Scale: Tectonic Domain Warping ---
        // Simulates the slow creeping growth of a fungal mat
        vec2 warp = vec2(
          fbm(uv * 1.5 + u_time * 0.015),
          fbm(uv * 1.5 - u_time * 0.012 + 10.0)
        );
        vec2 w_uv = uv + warp * 0.5;

        // --- Medium Time Scale: Crackle & Anastomosis ---
        vec3 v = voronoi(w_uv * 3.0);
        vec3 v_micro = voronoi(w_uv * 15.0 - warp);

        // Calculate crack lines (F2 - F1)
        float crack = smoothstep(0.12, 0.0, v.z);
        float micro_crack = smoothstep(0.04, 0.0, v_micro.z) * 0.8;
        
        // Combine into a hierarchical network
        float network = max(crack, micro_crack * smoothstep(0.2, 0.6, v.x));

        // --- Fast Time Scale: Thin-Film Interference Shimmer ---
        // Derived from structural_color repo (Bragg reflection & iridescence)
        // Film thickness varies based on distance to the cell edge
        float thickness = v.x + fbm(uv * 25.0) * 0.2;
        
        // High-frequency phase shifting
        float phase_c = thickness * 15.0 - u_time * 2.1;
        float phase_m = thickness * 18.0 - u_time * 3.4;
        float phase_y = thickness * 12.0 - u_time * 2.7;

        // Constructive/destructive interference waves
        float ic = 0.5 + 0.5 * cos(phase_c);
        float im = 0.5 + 0.5 * cos(phase_m);
        float iy = 0.5 + 0.5 * cos(phase_y);

        // Neon CMY Palette
        vec3 CYAN = vec3(0.0, 1.0, 1.0);
        vec3 MAGENTA = vec3(1.0, 0.0, 1.0);
        vec3 YELLOW = vec3(1.0, 1.0, 0.0);

        // Perceptually uniform mixing for vibrant structural color
        vec3 structColor = oklab_mix(CYAN, MAGENTA, im);
        structColor = oklab_mix(structColor, YELLOW, iy);
        
        // Amplify intensity where interference aligns constructively
        float shimmer = pow(ic * im * iy, 0.4) * 2.5;
        structColor *= (0.4 + shimmer);

        // --- Material Synthesis ---
        // Laccase stain / Enzymatic halo bleeding from the cracks
        float halo = smoothstep(0.4, 0.0, v.z);
        vec3 haloColor = oklab_mix(vec3(0.0), structColor, pow(halo, 1.5) * 0.6);

        // Deep void substrate (textured black)
        float voidNoise = fbm(w_uv * 20.0);
        vec3 voidColor = vec3(0.01 + 0.02 * voidNoise);

        // Composite the material layers
        vec3 finalColor = mix(voidColor, haloColor, halo);
        finalColor = mix(finalColor, structColor * 1.5, network);

        // Add physical substance (film grain / chitin micro-texture)
        float grain = hash1(uv * (u_time + 1.0)) * 0.15;
        finalColor += grain * (network + halo * 0.5);

        // Simple Reinhard tone mapping / Gamma
        finalColor = pow(clamp(finalColor, 0.0, 1.0), vec3(1.0/2.2));

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
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
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