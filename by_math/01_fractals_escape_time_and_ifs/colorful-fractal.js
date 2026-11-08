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
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      #define PI 3.14159265359

      // --- COLOR SYSTEMS: OKLab to sRGB ---
      vec3 oklch_to_srgb(float l, float c, float h) {
          float hr = h * PI / 180.0;
          float a = c * cos(hr);
          float b = c * sin(hr);
          
          float l_ = l + 0.3963377774 * a + 0.2158037573 * b;
          float m_ = l - 0.1055613458 * a - 0.0638541728 * b;
          float s_ = l - 0.0894841775 * a - 1.2914855480 * b;
          
          float l3 = l_*l_*l_;
          float m3 = m_*m_*m_;
          float s3 = s_*s_*s_;
          
          vec3 rgb = vec3(
               4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
              -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
              -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
          );
          
          vec3 srgb = vec3(
              rgb.r <= 0.0031308 ? rgb.r * 12.92 : 1.055 * pow(max(rgb.r, 0.0), 1.0/2.4) - 0.055,
              rgb.g <= 0.0031308 ? rgb.g * 12.92 : 1.055 * pow(max(rgb.g, 0.0), 1.0/2.4) - 0.055,
              rgb.b <= 0.0031308 ? rgb.b * 12.92 : 1.055 * pow(max(rgb.b, 0.0), 1.0/2.4) - 0.055
          );
          return clamp(srgb, 0.0, 1.0);
      }

      // --- ALCHEMICAL MATH: Complex Operations ---
      vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
      vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }

      // --- WET ENGINE: Fungal Noise / FBM ---
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
                     mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for(int i=0; i<4; i++) { v+=a*noise(p); p*=2.0; a*=0.5; }
          return v;
      }

      // --- THE CORE: Mutated Newton Fractal ---
      vec3 calcFractal(vec2 uv, float timeOffset) {
          float t = u_time + timeOffset;
          
          // Semantic Infestation: Domain warping the complex plane before iteration
          vec2 w = vec2(fbm(uv * 2.5 + t * 0.15), fbm(uv * 2.5 - t * 0.1));
          vec2 z = uv * 2.5 + (w - 0.5) * 0.4;
          
          // Machine Hesitation: Relaxation factor oscillates, causing spiral basins
          vec2 relax = vec2(0.8 + 0.2 * sin(t * 0.4), 0.3 * cos(t * 0.5));
          
          int iters = 40;
          float trap1 = 1e10;
          float trap2 = 1e10;
          vec2 root = vec2(0.0);
          
          for(int i=0; i<40; i++) {
              vec2 z2 = cmul(z, z);
              vec2 z3 = cmul(z2, z);
              
              // Bureaucratic Failure: The equation itself drifts
              vec2 f = z3 - vec2(1.0, 0.0) + vec2(sin(t*1.1), cos(t*1.3)) * 0.15;
              vec2 fp = 3.0 * z2;
              
              vec2 step = cmul(relax, cdiv(f, fp));
              z = z - step;
              
              // Orbit Traps (Parasite-Host logic)
              trap1 = min(trap1, length(z - vec2(sin(t*0.9), cos(t*0.7)) * 0.5));
              trap2 = min(trap2, abs(z.x * z.y)); // Melanized sector boundaries
              
              if(dot(step, step) < 0.0001) {
                  iters = i;
                  root = z;
                  break;
              }
          }
          
          // --- COLORFUL WEIRDNESS (Gross-But-Cute) ---
          float angle = atan(root.y, root.x) * 180.0 / PI;
          
          // Iteration-based decay (darkens deep basins)
          float l = 0.7 - float(iters) * 0.012; 
          
          // High chroma acid-vibration mapping
          float c = 0.35 + 0.1 * sin(trap2 * 15.0 - t * 3.0); 
          vec3 baseColor = oklch_to_srgb(l, c, angle + t * 20.0);
          
          // Structural Color: Thin-film interference on the primary trap (Gumball Iridescence)
          float filmThickness = 300.0 + 800.0 * trap1;
          float interference = 0.5 + 0.5 * cos((filmThickness / 500.0) * 6.2831);
          vec3 iridescence = oklch_to_srgb(0.85, 0.35, interference * 360.0);
          
          // Blend base with gummy iridescence based on trap proximity
          vec3 col = mix(baseColor, iridescence, exp(-trap1 * 6.0));
          
          // Print Misregistration / Halftone (Psychedelic Collage)
          float freq = 100.0;
          vec2 cell = fract(uv * freq) - 0.5;
          float dotRad = 0.45 * (float(iters) / 40.0);
          float ht = smoothstep(dotRad + 0.05, dotRad - 0.05, length(cell));
          
          // Colored Sprinkles (Complementary Hue Halftone)
          vec3 sprinkleColor = oklch_to_srgb(0.8, 0.3, angle + 180.0);
          col = mix(col, sprinkleColor, ht * 0.85);
          
          // Melanized Hyphal Boundaries (Mycelial Networks)
          col *= 1.0 - 0.4 * exp(-trap2 * 20.0);
          
          return col;
      }

      void main() {
          vec2 uv = vUv - 0.5;
          uv.x *= u_resolution.x / u_resolution.y;
          
          // Panpsychic Ouroboros: Mouse interaction warps the spatial fabric
          vec2 mouseOffset = (u_mouse - 0.5) * 2.0;
          uv += mouseOffset * 0.15;
          
          // --- CHROMATIC ABERRATION (Psychedelic Collage) ---
          // Radial RGB split simulating cheap lens distortion and glitch
          vec2 dir = normalize(uv) * 0.02 * length(uv);
          
          float r = calcFractal(uv + dir, 0.0).r;
          float g = calcFractal(uv, 0.0).g;
          float b = calcFractal(uv - dir, 0.0).b;
          
          vec3 finalCol = vec3(r, g, b);
          
          // --- DAMAGE AESTHETICS (VHS / CRT) ---
          // Scanline interference
          float scanline = sin(vUv.y * u_resolution.y * 1.5) * 0.04;
          finalCol -= scanline;
          
          // Machine Hesitation / Glitch Band
          if (fract(u_time * 8.0 + vUv.y * 4.0) < 0.03) {
              finalCol.rgb = finalCol.brg * 1.2; // Channel swap
          }
          
          fragColor = vec4(finalCol, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    canvas.__three = { renderer, scene, camera, material };
    
  } catch (e) {
    console.error("Feral WebGL Engine Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
  material.uniforms.u_mouse.value.set(mouse.x, 1.0 - mouse.y); // Invert Y for shader coords
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);