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
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;

      in vec2 vUv;
      out vec4 fragColor;

      // Complex Math (domain_coloring)
      vec2 c_mul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 c_div(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/(d + 1e-8); }

      // Hash for Voronoi
      vec3 hash32(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
          p3 += dot(p3, p3.yxz+33.33);
          return fract((p3.xxy+p3.yzz)*p3.zyx);
      }

      // Weaire-Phelan / Foam approximation (plateau_foam)
      float voronoi(vec2 p, float t) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float md = 8.0;
          for(int j=-1; j<=1; j++)
          for(int i=-1; i<=1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec3 o = hash32(n + g);
              vec2 r = g + 0.5 + 0.5*sin(t + 6.2831*o.xy) - f;
              float d = dot(r,r);
              if(d < md) { md = d; }
          }
          return sqrt(md);
      }

      // Maximalist candy-acid palette (color_cycling, metamerism, structural_color)
      vec3 acid_palette(float t) {
          t = fract(t);
          vec3 c[7];
          c[0] = vec3(1.0, 0.0, 0.5); // hot pink
          c[1] = vec3(1.0, 1.0, 0.0); // neon yellow
          c[2] = vec3(0.2, 1.0, 0.0); // acid green
          c[3] = vec3(0.0, 1.0, 1.0); // cyan
          c[4] = vec3(0.1, 0.0, 1.0); // electric blue
          c[5] = vec3(1.0, 0.4, 0.0); // orange
          c[6] = vec3(0.7, 0.0, 1.0); // violet
          
          float p = t * 7.0;
          int i = int(p);
          float f = smoothstep(0.0, 1.0, fract(p));
          
          return mix(c[i], c[(i+1)%7], f);
      }

      void main() {
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;
          
          float t = u_time * 0.4;
          
          // Macroblocking & Saccadic Masking (damage_aesthetics)
          vec2 block_p = floor(p * 16.0) / 16.0;
          float glitch = step(0.98, fract(sin(dot(block_p, vec2(12.3, 45.6)) + t) * 4375.0));
          p = mix(p, block_p, glitch * 0.8);
          
          // Horizontal Tearing / Sync Instability
          float tear = step(0.99, fract(sin(p.y * 60.0 + t*3.0) * 123.0));
          p.x += tear * 0.4 * sin(t * 25.0);
          
          // Vascular flow / Domain warping / Mobius (domain_coloring, vascular_branching)
          vec2 flow = p;
          for(int i=0; i<3; i++) {
              vec2 inv = c_div(vec2(1.0, 0.0), flow + vec2(0.1*sin(t), 0.1*cos(t)));
              flow = inv + 0.3 * vec2(sin(flow.y * 3.0 + t), cos(flow.x * 3.0 - t));
          }
          
          // Acoustic Impedance / Ultrasound waves (acoustic_impedance_tessellation)
          float wave = sin(length(p - flow) * 20.0 - t * 10.0);
          wave *= exp(-length(p) * 1.2); // Attenuation
          
          vec3 finalColor = vec3(0.0);
          
          // Chromatic Aberration & Chromostereopsis (red floats, blue sinks)
          float ca_shift = 0.04 + 0.06 * sin(t * 0.5);
          
          for(int i=0; i<3; i++) {
              // Shift UV for R, G, B
              vec2 sp = flow + float(i - 1) * ca_shift * vec2(1.0, 0.3);
              
              // Autostereogram repeating pattern
              sp.x = mod(sp.x, 2.5) - 1.25;
              
              // Weaire-Phelan foam layers (plateau_foam)
              float f1 = voronoi(sp * 3.0 + wave * 0.3, t);
              float f2 = voronoi(sp * 6.0 - f1, t * 1.3);
              float depth = f1 - f2 * 0.6;
              
              // Thin-film interference & Structural Color
              float thickness = depth * 2.5 + wave * 0.5;
              float interference = cos(thickness * 12.0 - t * 4.0);
              
              // Spectral / Color Cycling
              vec3 color = acid_palette(depth * 1.5 + interference * 0.3 + t * 0.2 + float(i)*0.15);
              
              // Accumulate channels
              if(i == 0) finalColor.r = color.r;
              if(i == 1) finalColor.g = color.g;
              if(i == 2) finalColor.b = color.b;
          }
          
          // Enforce max saturation (chromostereopsis rule)
          float maxC = max(finalColor.r, max(finalColor.g, finalColor.b));
          if(maxC > 0.0) finalColor /= maxC;
          
          // Add iridescent structural bloom
          float interference_bloom = cos(length(flow)*10.0 - t*5.0);
          finalColor += pow(interference_bloom * 0.5 + 0.5, 3.0) * acid_palette(t * 1.5 + length(flow)) * 0.5;
          
          // Speckle / Film Grain (damage_aesthetics)
          float speckle = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor = mix(finalColor, vec3(speckle), 0.1);
          
          // CRT / Vignette
          float vig = length(vUv - 0.5) * 2.0;
          finalColor *= 1.0 - 0.3 * vig * vig;
          
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
    throw e;
  }
}

const { renderer, scene, camera, material } = canvas.__three;
if (material && material.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);