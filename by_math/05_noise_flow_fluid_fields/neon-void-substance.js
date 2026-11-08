if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width/grid.height, 0.1, 1000);
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
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      
      #define PI 3.14159265359
      
      // Feral Math: Hash & Noise Primitives
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
      
      float fbm(vec2 p) {
          float f = 0.0; 
          float amp = 0.5;
          for(int i = 0; i < 5; i++) {
              f += amp * noise(p); 
              p *= 2.0; 
              amp *= 0.5;
          }
          return f;
      }
      
      // Lithogenesis & Morphogenesis: Structural Scalar Field
      float getTopography(vec2 p, float t_slow, float t_med, float t_fast) {
          // Machine Hesitation: Horizontal sync glitch logic
          float glitch = step(0.985, hash(vec2(floor(t_fast * 5.0), floor(p.y * 3.0))));
          p.x += glitch * 0.15 * sin(t_fast * 20.0);
          
          // Deep Domain Warping: Thermal bloom / fluid advection
          vec2 w = vec2(fbm(p * 0.3 + t_slow), fbm(p * 0.3 - t_slow + 10.0));
          p += w * 2.5;
          
          // Islamic Girih Quasicrystal Base (5-fold symmetry metric competition)
          float grid = 0.0;
          for(int k = 0; k < 5; k++) {
              float a = float(k) * PI / 5.0;
              vec2 n = vec2(cos(a), sin(a));
              float proj = dot(p, n) * 2.5 + t_med;
              // Nonlinear strapwork - creates sharp interwoven ridges
              float line = abs(fract(proj) - 0.5) * 2.0; 
              grid += smoothstep(0.7, 1.0, line);
          }
          grid = grid * 0.15; 
          
          // Mycological breakdown / organic crystallization
          float organic = fbm(p * 4.0 - w * 1.5 + t_fast * 0.1);
          
          return grid * 0.6 + organic * 0.4;
      }
      
      void main() {
          vec2 uv = vUv;
          vec2 p = (uv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y)) * 12.0;
          
          // 3 Time scales (Deep Time / Structural / Shimmer)
          float t_slow = u_time * 0.05;
          float t_med  = u_time * 0.3;
          float t_fast = u_time * 2.0;
          
          // Compute topography (scalar field)
          float topo = getTopography(p, t_slow, t_med, t_fast);
          
          // Compute normal via central difference for physical lighting
          vec2 eps = vec2(0.015, 0.0);
          float tx = getTopography(p + eps.xy, t_slow, t_med, t_fast);
          float ty = getTopography(p + eps.yx, t_slow, t_med, t_fast);
          vec3 N = normalize(vec3(tx - topo, ty - topo, 0.08)); 
          
          // View vector (orthographic projection)
          vec3 V = vec3(0.0, 0.0, 1.0);
          float cosTheta = max(0.0, dot(N, V));
          
          // Thin Film Interference (Structural Color - Bragg Reflector Logic)
          float n_film = 1.56; // Chitin refractive index
          float thickness = topo * 1200.0; // Physical thickness in nm
          
          float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
          float pathDiff = 2.0 * n_film * thickness * sqrt(1.0 - pow(sinTheta/n_film, 2.0));
          
          // Map path difference to spectral phase
          float phase = pathDiff * 0.012 - t_slow * 5.0; 
          
          // Synthesize CMY neon peaks directly (Chromatic Cannibalism)
          vec3 cmy = vec3(
              1.0 - (0.5 + 0.5 * cos(phase)),            // Cyan
              1.0 - (0.5 + 0.5 * cos(phase + 2.094)),    // Magenta
              1.0 - (0.5 + 0.5 * cos(phase + 4.188))     // Yellow
          );
          
          // Boost contrast to make it feral neon
          cmy = smoothstep(0.1, 0.9, cmy);
          cmy = pow(cmy, vec3(1.8));
          
          // Add raw shimmer (metallic flake effect in the dry areas)
          float flake = pow(hash(p * 40.0 + floor(t_fast * 10.0)), 8.0) * 1.5;
          cmy += flake * vec3(1.0, 1.0, 0.0) * cosTheta * smoothstep(0.5, 1.0, topo); 
          
          // Structure depth masking (void black in crevices)
          float depthMask = smoothstep(0.3, 0.85, topo);
          
          // Rayleigh scattering in the deep logic (deep = magenta, shallow = cyan)
          vec3 scatter = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), topo);
          
          vec3 finalColor = cmy * depthMask;
          
          // Iridescent edge rim light via Fresnel approximation
          finalColor += scatter * 0.4 * pow(1.0 - cosTheta, 3.0) * depthMask;
          
          // Glitch / NaN propagation artifact emulation (Dead pixels behaving like pollen)
          float artifact = step(0.995, hash(p * 2.0 + t_fast));
          finalColor = mix(finalColor, vec3(0.0, 1.0, 1.0), artifact * 0.8);
          
          // Heavy vignette for the "void" constraint
          float vig = length(uv - 0.5) * 2.0;
          finalColor *= smoothstep(1.3, 0.3, vig);
          
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
      fragmentShader
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
if (material && material.uniforms && material.uniforms.u_time) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);