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

      // --- Mathematical & Feral Noise ---
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      // --- Acidic Toxic Palettes ---
      vec3 acidPal(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.6, 0.6, 0.6);
          vec3 c = vec3(2.0, 1.5, 1.0);
          vec3 d = vec3(0.1, 0.8, 0.4);
          return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
      }

      vec3 neonPal(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.6, 0.6, 0.6);
          vec3 c = vec3(1.0, 2.0, 1.5);
          vec3 d = vec3(0.9, 0.2, 0.6);
          return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
      }

      // --- Autophagic Weave Topology ---
      // Returns vec3(height, top_thread_id, local_coordinate_along_thread)
      vec3 weaveMap(vec2 p) {
          vec2 cell = floor(p);
          vec2 local = fract(p);
          
          // Fungal decay of the mathematical structure
          float decay = noise(cell * 0.05 + u_time * 0.2);
          
          // Base Twill 2/1 logic
          float twill = step(1.0, mod(cell.x + cell.y, 3.0));
          
          // XOR-Ghost Manifold (Rule-30-esque CA approximation)
          ivec2 icell = ivec2(cell + 10000.0); // prevent negative bitwise
          float xor_rule = float((icell.x ^ icell.y) % 2);
          
          // Machine hesitation: interpolate between perfect twill and chaotic XOR
          float warp_top = step(0.5, mix(twill, xor_rule, smoothstep(0.4, 0.7, decay)));
          
          // Thread cylindrical profiles
          float w = 0.45; // tight thread packing
          float dx = abs(local.x - 0.5);
          float dy = abs(local.y - 0.5);
          
          float warp_vis = smoothstep(w, w - 0.08, dx);
          float weft_vis = smoothstep(w, w - 0.08, dy);
          
          float warp_h = sqrt(max(0.0, w * w - dx * dx)) * warp_vis;
          float weft_h = sqrt(max(0.0, w * w - dy * dy)) * weft_vis;
          
          // Structural elevation
          warp_h += (warp_top == 1.0 ? 0.35 : 0.0) * warp_vis;
          weft_h += (warp_top == 0.0 ? 0.35 : 0.0) * weft_vis;
          
          if (warp_h > weft_h) {
              return vec3(warp_h, 1.0, local.y); // Warp (vertical)
          } else {
              return vec3(weft_h, 0.0, local.x); // Weft (horizontal)
          }
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          vec2 p = (uv - 0.5) * 2.0;
          p.x *= u_resolution.x / u_resolution.y;
          
          // 1. Stereographic / Hyperbolic projection
          float r2 = dot(p, p);
          vec2 proj = p / (1.0 + r2 * 0.15);
          
          // Glitch Prophet: Semantic Infestation band
          float glitch = step(0.99, fract(sin(u_time * 10.0 + uv.y * 50.0) * 43758.5453));
          proj.x += glitch * 0.05;

          // 2. Julia Set Topological Warping (z -> z^2 + c)
          vec2 z = proj * 1.8;
          vec2 c = vec2(0.285, 0.01) + vec2(sin(u_time * 0.15) * 0.06, cos(u_time * 0.22) * 0.06);
          float trap = 100.0;
          
          for(int i = 0; i < 4; i++) {
              z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
              trap = min(trap, dot(z, z)); // Orbit trap for coloring
          }
          
          // 3. Woven Grid Mapping
          vec2 grid_uv = z * 45.0; // Weave density
          
          // 4. Birefringence / Finite Difference Normal Map
          float eps = 0.05;
          vec3 w0 = weaveMap(grid_uv);
          vec3 wx = weaveMap(grid_uv + vec2(eps, 0.0));
          vec3 wy = weaveMap(grid_uv + vec2(0.0, eps));
          
          // Normal derived from the physical heightmap of the threads
          vec3 normal = normalize(vec3(w0.x - wx.x, w0.x - wy.x, eps));
          
          // 5. Lighting (Anisotropic Specular for Silk/Synthetic sheen)
          vec3 light_dir = normalize(vec3(sin(u_time), 0.7, cos(u_time)));
          vec3 view_dir = vec3(0.0, 0.0, 1.0);
          
          // Thread tangent direction (warp runs y, weft runs x)
          vec2 tangent = w0.y == 1.0 ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
          
          vec3 H = normalize(light_dir + view_dir);
          float NdotH = max(dot(normal, H), 0.0);
          float HdotT = dot(H, vec3(tangent, 0.0));
          
          // Ward anisotropic approximation
          float aniso = exp(-2.0 * pow(HdotT, 2.0) / (NdotH * 0.08 + 0.001));
          float diff = max(dot(normal, light_dir), 0.0);
          
          // 6. Chromatic Splitting & Coloring
          vec3 base_col = w0.y == 1.0 
              ? acidPal(trap * 2.0 + u_time * 0.2 + w0.z * 0.1) 
              : neonPal(trap * 1.5 - u_time * 0.15 + w0.z * 0.1);
              
          // Fiber fuzz (high frequency noise along the thread)
          float fuzz = noise(grid_uv * 15.0) * 0.15;
          
          vec3 final_col = base_col * (diff * 0.8 + 0.2) + (aniso * vec3(0.9, 1.0, 0.8) * 0.9) + fuzz;
          
          // Deep void shadowing in the gaps
          final_col *= smoothstep(0.0, 0.2, w0.x);
          
          // Vignette
          final_col *= 1.0 - smoothstep(0.8, 2.5, length(p));
          
          fragColor = vec4(final_col, 1.0);
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

    const plane = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(plane, material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);