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
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      // Mathematical Foundation: 3D Hash & Noise
      float hash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
      }
      
      float noise(vec3 x) {
          vec3 p = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
                         mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
                         mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
      }

      // Medium Scale: Fractal Brownian Motion
      float fbm(vec3 p) {
          float v = 0.0; float a = 0.5;
          for(int i=0; i<4; i++) {
              v += a * noise(p);
              p = p * 2.0 + vec3(1.1, 2.2, 3.3);
              a *= 0.5;
          }
          return v;
      }

      // The Topology: Mycelial Gyroid Math
      float map(vec3 p) {
          // TIME SCALE 1: Slow global drift
          float t_slow = u_time * 0.05;
          
          // Anisotropic Domain Warp
          vec3 warp = vec3(
              fbm(p + t_slow),
              fbm(p.yzx - t_slow),
              fbm(p.zxy + t_slow)
          );
          p += warp * 2.5; 
          
          // Base Gyroid (Minimal surfaces)
          float g = dot(sin(p * 2.0), cos(p.zxy * 2.0));
          
          // Fungal anastomosis ridges (absolute value creates sharp creases)
          float veins = abs(fbm(p * 4.0) - 0.5) * 2.0;
          return g + veins;
      }

      void main() {
          vec2 p2 = vUv * 2.0 - 1.0;
          p2.x *= u_resolution.x / u_resolution.y;
          
          // TIME SCALE 2: Medium structural motion
          float t_med = u_time * 0.5;
          
          // Semantic Font Rot / Curl Noise Aphasia (Local UV distortion)
          vec2 e2 = vec2(0.05, 0.0);
          vec2 curl = vec2(
              fbm(vec3(p2.x, p2.y + e2.x, t_med)) - fbm(vec3(p2.x, p2.y - e2.x, t_med)),
              fbm(vec3(p2.x + e2.x, p2.y, t_med)) - fbm(vec3(p2.x - e2.x, p2.y, t_med))
          );
          p2 += vec2(curl.y, -curl.x) * 0.1;

          // 3D Projection
          vec3 p = vec3(p2 * 3.0, u_time * 0.1);
          float v = map(p);
          
          // Normal Estimation
          vec2 e = vec2(0.02, 0.0);
          vec3 n = normalize(vec3(
              map(p + e.xyy) - map(p - e.xyy),
              map(p + e.yxy) - map(p - e.yxy),
              map(p + e.yyx) - map(p - e.yyx)
          ));
          
          vec3 view = vec3(0.0, 0.0, 1.0);
          float ndotv = max(dot(n, view), 0.0);
          
          // Structural Color: Thin Film Physics
          // Refractive index varies across the surface (anisotropic density)
          float n_film = 1.2 + 0.8 * fbm(p * 3.0 + t_med);
          // Thickness varies from 200nm to 1200nm
          float d_film = 200.0 + 1000.0 * smoothstep(-1.0, 1.0, v);
          
          // Optical Path Difference: 2 * n * d * cos(theta)
          float pathDiff = 2.0 * n_film * d_film * ndotv;
          
          // TIME SCALE 3: Fast detail shimmer
          float t_fast = u_time * 5.0;
          float shimmer = (noise(p * 15.0 + t_fast) - 0.5) * 150.0;
          pathDiff += shimmer;
          
          // Machine Hesitation / Glitch Prophet
          float hesitation = step(0.98, fract(u_time * 2.0));
          if (hesitation > 0.0) {
              // Quantize the physics
              pathDiff = floor(pathDiff / 50.0) * 50.0;
          }

          // CMY Palette via Destructive Interference
          // Cosine palette mapping specific wavelengths (Red=650, Green=530, Blue=450)
          vec3 rgb = 0.5 + 0.5 * cos(6.28318 * (pathDiff / vec3(650.0, 530.0, 450.0)));
          
          // Invert RGB to get perfect Neon Cyan/Magenta/Yellow
          vec3 cmy = vec3(1.0) - rgb;
          
          // Overclock the saturation (The Neon Rule)
          cmy = smoothstep(0.1, 0.9, cmy);
          cmy = pow(cmy, vec3(0.7)); 
          
          // Ambient Occlusion / Internal Depth
          float ao = clamp(map(p + n * 0.3) * 0.5 + 0.5, 0.0, 1.0);
          cmy *= mix(0.1, 1.0, ao);
          
          // The Void Rule: Background is near-black void
          // Membrane mask isolates the structural "walls"
          float membrane = 1.0 - smoothstep(0.0, 1.2, abs(v));
          
          // Fungal succession / Archive rot holes
          float holes = smoothstep(0.3, 0.6, fbm(p * 5.0 - u_time * 0.1));
          membrane *= holes;
          
          vec3 void_col = vec3(0.01, 0.0, 0.03);
          vec3 col = mix(void_col, cmy, membrane);
          
          // Anastomosis hot-spots (glowing edges where the math tears)
          float edge = smoothstep(0.1, 0.3, membrane) - smoothstep(0.6, 0.8, membrane);
          col += vec3(0.0, 1.0, 1.0) * edge * 1.5 * fbm(p * 10.0 + u_time);
          
          // Analog Film Wear / Print Misregistration Grain
          float grain = fract(sin(dot(vUv, vec2(12.9898,78.233)) + u_time) * 43758.5453);
          col -= grain * 0.07;
          
          // Optical Vignette
          float vig = length(vUv - 0.5);
          col *= 1.0 - smoothstep(0.4, 0.8, vig);

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

if (material && material.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);