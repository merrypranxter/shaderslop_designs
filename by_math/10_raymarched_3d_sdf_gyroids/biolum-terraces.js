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
      uniform float u_time;
      uniform vec2 u_resolution;
      
      in vec2 vUv;
      out vec4 fragColor;

      #define MAX_STEPS 120
      #define MAX_DIST 30.0
      #define SURF_DIST 0.002

      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      float hash(float n) { return fract(sin(n) * 1e4); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      vec3 map(vec3 p) {
          // --- THE OCEAN / MATH (Diagonal Terrace SDF) ---
          vec3 pt = p;
          
          // Emotional Gravity Lensing: space warping based on time
          pt.x += sin(pt.z * 1.2 + u_time * 0.4) * 0.25;
          
          // Diagonal rotation
          pt.xz *= rot(3.14159265 * 0.25);
          
          // Terracing logic (Quantized Laplacian failure / Stepping)
          float t_step = floor(pt.z) + smoothstep(0.2, 0.8, fract(pt.z));
          
          // Spatial Moiré interference injected into the math
          float moire = sin(p.x * 35.0) * sin(p.z * 35.0) * 0.015;
          
          float d_terr = pt.y + t_step * 0.4 + 2.5 + moire;

          // --- MNEMONIC GRAVITY (8 Particle Columns) ---
          float viewWidth = (u_resolution.x / u_resolution.y) * 4.0; 
          float spacing = viewWidth / 8.0;
          
          // Isolate columns to a specific Z plane to act as a barrier grid
          vec3 pp = p;
          pp.z = p.z - (-1.0); // Fixed at z = -1.0
          
          float cx = floor(pp.x / spacing);
          pp.x = fract(pp.x / spacing) * spacing - spacing * 0.5;
          
          // Kairotempics: Individual temporal flow per column
          float speed = pow(hash(cx * 1.33), 2.0) * 3.0 + 1.0;
          float phase = hash(cx * 7.11) * 10.0;
          float py = pp.y + u_time * speed + phase;
          
          float cy = floor(py / 0.4);
          pp.y = fract(py / 0.4) * 0.4 - 0.2;
          
          // Identity Shifts: Outlier detection (Magenta Glitch)
          float isOutlier = step(0.96, hash2(vec2(cx, cy)));
          
          // Particle radius pulses if outlier
          float radius = 0.025 + isOutlier * 0.015 * sin(u_time * 15.0 + cy);
          float d_part = length(pp) - radius;
          
          // Bound particles so they don't render infinitely deep
          // We only want them near z = -1.0
          float z_bound = abs(p.z - (-1.0)) - 0.2;
          d_part = max(d_part, z_bound);

          // Return: x = dist, y = mat_id (0: terrace, 1: particle), z = outlier flag
          if (d_terr < d_part) {
              return vec3(d_terr, 0.0, 0.0);
          } else {
              return vec3(d_part, 1.0, isOutlier);
          }
      }

      vec3 getNormal(vec3 p) {
          vec2 e = vec2(0.002, 0);
          float d = map(p).x;
          vec3 n = d - vec3(
              map(p - e.xyy).x,
              map(p - e.yxy).x,
              map(p - e.yyx).x
          );
          return normalize(n);
      }

      void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;

          // Camera setup (The Observer)
          vec3 ro = vec3(0.0, 0.0, -4.0);
          vec3 rd = normalize(vec3(uv, 1.0));

          // Anxious Photons: Slight camera drift
          rd.xy *= rot(sin(u_time * 0.2) * 0.05);

          float t = 0.0;
          vec3 p;
          vec3 res;
          
          // Accumulated affective energy (Exponential Edge Glow)
          vec3 glow = vec3(0.0);

          for(int i = 0; i < MAX_STEPS; i++) {
              p = ro + rd * t;
              res = map(p);
              float d = res.x;

              // Separate glow accumulation based on material
              if (res.y == 0.0) {
                  // Terrace bioluminescence (Cyan/Green)
                  glow += exp(-d * 18.0) * vec3(0.0, 0.7, 0.5) * 0.015;
              } else {
                  // Particle glow (Cyan core or Magenta outlier)
                  vec3 pColor = res.z > 0.5 ? vec3(1.0, 0.1, 0.8) : vec3(0.05, 0.9, 0.7);
                  glow += exp(-d * 25.0) * pColor * 0.035;
              }

              if(d < SURF_DIST || t > MAX_DIST) break;
              t += d * 0.8; // Dampened step for moiré stability
          }

          // The Void Rule: Background is near-black void
          vec3 col = vec3(0.01, 0.01, 0.02);

          if(t < MAX_DIST) {
              vec3 n = getNormal(p);
              
              if (res.y == 0.0) {
                  // Terrace Lighting (Lit from below - The Ocean/Math)
                  vec3 lightDir = normalize(vec3(sin(u_time*0.5), -1.0, cos(u_time*0.5)));
                  
                  // Subsurface scattering approximation (light penetrating upward)
                  float sss = max(dot(n, -lightDir), 0.0);
                  float diff = max(dot(n, lightDir), 0.0);
                  float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
                  
                  col = vec3(0.0, 0.1, 0.1) * diff;
                  col += vec3(0.0, 0.6, 0.4) * sss * 0.4;
                  col += vec3(0.0, 0.9, 0.7) * fresnel * 0.5;
              } else {
                  // Particle Lighting (Self-luminous neons)
                  float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
                  col = res.z > 0.5 ? vec3(0.9, 0.0, 0.6) : vec3(0.0, 0.8, 0.6);
                  col += vec3(1.0) * fresnel;
              }
          }

          // Inject exponential glow
          col += glow;

          // Atmospheric Fog in the gaps (The Ship's heavy fog)
          float fog = 1.0 - exp(-t * 0.12);
          col = mix(col, vec3(0.005, 0.01, 0.02), fog);

          // Contrast push (Moiré emphasis)
          col = pow(col, vec3(0.85));

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
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);