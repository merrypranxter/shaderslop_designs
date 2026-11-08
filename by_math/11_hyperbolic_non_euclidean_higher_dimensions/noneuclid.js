if (!canvas.__three) {
  try {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error("WebGL 2 not supported or context occupied");
    
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, context: gl });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Hyperbolic {7,3} Tiling Math (Poincaré Disk)
    // We compute the fundamental domain reflection circle geodesics on the CPU.
    const p = 7;
    const q = 3;
    const PI = Math.PI;
    const A = Math.cos(PI/p) / Math.sin(PI/q);
    const x_m = Math.sqrt((A - 1) / (A + 1));
    const c = (1 + x_m * x_m) / (2 * x_m);
    const r = (1 - x_m * x_m) / (2 * x_m);
    const sin_p = Math.sin(PI/p);
    const cos_p = Math.cos(PI/p);

    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_c;
      uniform float u_r;
      uniform float u_sin_p;
      uniform float u_cos_p;

      // Lisa Frank Hyper-Vibrant Neon Palette
      vec3 getLisaFrankColor(float t) {
          t = fract(t);
          vec3 c1 = vec3(1.0, 0.0, 1.0); // Hot Magenta
          vec3 c2 = vec3(0.0, 1.0, 1.0); // Electric Cyan
          vec3 c3 = vec3(0.0, 1.0, 0.0); // Toxic Lime
          vec3 c4 = vec3(1.0, 1.0, 0.0); // Neon Yellow
          
          if(t < 0.25) return mix(c1, c2, t*4.0);
          if(t < 0.50) return mix(c2, c3, (t-0.25)*4.0);
          if(t < 0.75) return mix(c3, c4, (t-0.50)*4.0);
          return mix(c4, c1, (t-0.75)*4.0);
      }

      vec2 hash2(vec2 p) {
          vec2 h = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(h) * 43758.5453123);
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          vec2 z = uv * 2.0 - 1.0;
          z.x *= u_resolution.x / u_resolution.y;

          float r_z = length(z);
          
          // The Void outside the Poincaré Disk
          if(r_z > 0.995) {
              float star = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
              if(star > 0.99) {
                  gl_FragColor = vec4(vec3(1.0, 0.5, 1.0) * (star - 0.99)*100.0, 1.0);
              } else {
                  gl_FragColor = vec4(0.05, 0.0, 0.1, 1.0); // Deep space purple
              }
              return;
          }

          // Möbius translation to orbit the center of the hyperbolic universe
          float t = u_time * 0.4;
          vec2 a = vec2(cos(t * 0.6), sin(t * 0.7)) * 0.5 * sin(t * 0.3);

          // Apply Möbius transformation: T(z) = (z - a) / (1 - conj(a)*z)
          vec2 num = z - a;
          vec2 den = vec2(1.0, 0.0) - vec2(a.x*z.x + a.y*z.y, a.x*z.y - a.y*z.x);
          float d = dot(den, den);
          z = vec2(num.x*den.x + num.y*den.y, num.y*den.x - num.x*den.y) / d;

          // Rotate the entire disk
          float theta = u_time * 0.15;
          float cs = cos(theta), sn = sin(theta);
          z = vec2(z.x*cs - z.y*sn, z.x*sn + z.y*cs);

          // Fold into the fundamental domain of the {7,3} tiling
          int depth = 0;
          for(int i = 0; i < 60; i++) {
              bool changed = false;
              
              // Fold across x-axis
              if(z.y < 0.0) {
                  z.y = -z.y;
                  changed = true;
                  depth++;
              }
              
              // Fold across line at angle PI/7
              float dot_n = -z.x * u_sin_p + z.y * u_cos_p;
              if(dot_n > 0.0) {
                  z -= 2.0 * dot_n * vec2(-u_sin_p, u_cos_p);
                  changed = true;
                  depth++;
              }
              
              // Fold across the orthogonal geodesic circle
              float d2 = (z.x - u_c)*(z.x - u_c) + z.y*z.y;
              if(d2 < u_r * u_r) {
                  float factor = (u_r * u_r) / d2;
                  z.x = u_c + (z.x - u_c) * factor;
                  z.y = z.y * factor;
                  changed = true;
                  depth++;
              }
              
              if(!changed) break;
          }

          // Generate Lisa Frank base palette from fold depth and domain position
          vec3 baseColor = getLisaFrankColor(float(depth) * 0.08 - u_time * 0.3 + length(z)*5.0);

          // Liquid domain warp for the leopard print
          vec2 spot_z = z + 0.01 * vec2(sin(z.y * 150.0 + u_time), cos(z.x * 150.0 + u_time));
          
          // Voronoi Cellular Noise for Leopard Spots
          vec2 f_uv = spot_z * 80.0;
          vec2 i_uv = floor(f_uv);
          vec2 p_uv = fract(f_uv);
          float min_dist = 1.0;
          
          for(int y = -1; y <= 1; y++) {
              for(int x = -1; x <= 1; x++) {
                  vec2 neighbor = vec2(float(x), float(y));
                  vec2 pt = hash2(i_uv + neighbor);
                  
                  // Jitter points to make the spots writhe
                  pt = 0.5 + 0.4 * sin(u_time * 4.0 + 6.28318 * pt);
                  
                  vec2 diff = neighbor + pt - p_uv;
                  float dist = length(diff);
                  min_dist = min(min_dist, dist);
              }
          }

          // Sculpt the leopard spots (dark rings with hot pink centers)
          float ring = smoothstep(0.15, 0.25, min_dist) - smoothstep(0.35, 0.45, min_dist);
          float center = 1.0 - smoothstep(0.1, 0.2, min_dist);

          vec3 color = baseColor;
          color = mix(color, vec3(0.05), ring); // Black/Dark rings
          color = mix(color, vec3(1.0, 0.0, 0.8), center); // Hot pink centers

          // Highlight the geodesic scaffolding (edges of the fundamental domain)
          float d_y = abs(z.y);
          float d_angle = abs(-z.x * u_sin_p + z.y * u_cos_p);
          float d_circ = abs(length(z - vec2(u_c, 0.0)) - u_r);
          
          float edge = min(min(d_y, d_angle), d_circ);
          float edge_line = smoothstep(0.005, 0.001, edge);
          
          vec3 edgeColor = getLisaFrankColor(float(depth) * 0.15 + 0.5);
          color = mix(color, edgeColor, edge_line * 0.9);

          // Spinning 4-pointed stars at the heptagon centers (origin of the domain)
          vec2 sz = z;
          float stheta = u_time * 2.0;
          sz = vec2(sz.x * cos(stheta) - sz.y * sin(stheta), sz.x * sin(stheta) + sz.y * cos(stheta));
          
          // Star SDF
          float d_star = length(sz) + abs(sz.x * sz.y) * 200.0;
          color = mix(color, vec3(1.0, 1.0, 0.0), smoothstep(0.02, 0.015, d_star)); // Yellow body
          color = mix(color, vec3(1.0, 1.0, 1.0), smoothstep(0.01, 0.005, d_star)); // White hot core

          // Glinting Sparkles across the screen
          float sparkle = fract(sin(dot(gl_FragCoord.xy - u_time * 30.0, vec2(12.9898, 78.233))) * 43758.5453);
          if (sparkle > 0.996) {
              float intensity = (sparkle - 0.996) / 0.004;
              color += vec3(intensity * 1.5);
          }

          // Smooth fade at the boundary of infinity
          float boundary_fade = smoothstep(0.995, 0.97, r_z);
          color *= boundary_fade;

          gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_c: { value: c },
        u_r: { value: r },
        u_sin_p: { value: sin_p },
        u_cos_p: { value: cos_p }
      }
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL 2 Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material?.uniforms) {
  if (material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material.uniforms.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);