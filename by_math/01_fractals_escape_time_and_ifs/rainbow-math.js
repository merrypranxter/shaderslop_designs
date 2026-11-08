try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL2 context required");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
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
      #define GOLDEN_ANGLE 2.39996323

      // Feral Noise Generator
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      // OKLCh to Linear sRGB (Color Systems Principle)
      vec3 oklch2rgb(float L, float C, float h) {
          float a = C * cos(h);
          float b = C * sin(h);
          
          float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
          float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
          float s_ = L - 0.0894841775 * a - 1.2914855480 * b;
          
          float l = l_ * l_ * l_;
          float m = m_ * m_ * m_;
          float s = s_ * s_ * s_;
          
          vec3 rgb = vec3(
               4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
              -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
              -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
          );
          return rgb;
      }

      // Circle Inversion (Apollonian Gasket / Kleinian Limit)
      vec2 invert(vec2 z, vec2 c, float r) {
          vec2 w = z - c;
          return c + (r * r * w) / dot(w, w);
      }

      // Rainblown Hyperbolic Fold
      vec4 evaluateFractal(vec2 p, float channelOffset) {
          // Wind vector (Rainblown effect)
          vec2 wind = vec2(0.8, -1.2);
          float t = u_time * 0.25;
          
          // Parallax Chromatic Shift (Depth Fields)
          p += wind * channelOffset * 0.015;
          
          // Fluid noise shear (Mycelial growth simulation)
          float n1 = noise(p * 2.5 - wind * t);
          float n2 = noise(p * 5.0 - wind * t * 1.5);
          p += wind * (n1 * 0.18 + n2 * 0.06);

          // Schottky Generators for Kleinian Group
          vec2 c1 = vec2(0.5, 0.0);
          vec2 c2 = vec2(-0.5, 0.0);
          vec2 c3 = vec2(0.0, 0.81649658);
          float r1 = 0.5, r2 = 0.5, r3 = 0.40824829;
          
          // Anxious Photons / Mouse Repulsion
          vec2 m = u_mouse * 2.0 - 1.0;
          c3 += m * 0.15 * noise(p * 2.0 + u_time);

          float iters = 0.0;
          float minDist = 100.0;
          
          for(int i = 0; i < 28; i++) {
              float d1 = length(p - c1);
              float d2 = length(p - c2);
              float d3 = length(p - c3);
              
              minDist = min(minDist, min(d1, min(d2, d3)));
              
              if(d1 < r1) { p = invert(p, c1, r1); iters++; }
              else if(d2 < r2) { p = invert(p, c2, r2); iters++; }
              else if(d3 < r3) { p = invert(p, c3, r3); iters++; }
              else { break; }
              
              // Feral corruption: warp space *inside* the inversion
              // This shreds the rigid geometry into mycelial, rain-swept streaks
              p += wind * 0.004 * noise(p * 12.0 + u_time + float(i));
          }
          
          return vec4(p, iters, minDist);
      }

      void main() {
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;
          uv *= 1.1; // Frame zoom
          
          // Chromatic Parallax Offsets (Red shifted left, Blue right)
          float rOff = -1.0;
          float gOff = 0.0;
          float bOff = 1.5;
          
          vec4 resR = evaluateFractal(uv, rOff);
          vec4 resG = evaluateFractal(uv, gOff);
          vec4 resB = evaluateFractal(uv, bOff);
          
          // Extract structural color using OKLCh mapped to Golden Angle
          // R channel
          float hR = resR.z * GOLDEN_ANGLE + u_time * 0.4;
          float lR = 0.55 + 0.35 * sin(resR.w * 30.0 - u_time * 1.5);
          float cR = 0.18 + 0.08 * cos(resR.z * 8.0);
          float valR = oklch2rgb(lR, cR, hR).r;
          
          // G channel
          float hG = resG.z * GOLDEN_ANGLE + u_time * 0.4;
          float lG = 0.55 + 0.35 * sin(resG.w * 30.0 - u_time * 1.5);
          float cG = 0.18 + 0.08 * cos(resG.z * 8.0);
          float valG = oklch2rgb(lG, cG, hG).g;
          
          // B channel
          float hB = resB.z * GOLDEN_ANGLE + u_time * 0.4;
          float lB = 0.55 + 0.35 * sin(resB.w * 30.0 - u_time * 1.5);
          float cB = 0.18 + 0.08 * cos(resB.z * 8.0);
          float valB = oklch2rgb(lB, cB, hB).b;
          
          vec3 col = clamp(vec3(valR, valG, valB), 0.0, 1.0);
          
          // Thin-Film Interference (Structural Color Physics)
          // 2nd cos(theta) = m * lambda -> Approximated via Cosine Palette
          vec3 iridescence = 0.5 + 0.5 * cos(6.28318 * (col * 1.8 + vec3(0.0, 0.33, 0.67)));
          
          // Blend base fractal with iridescence based on "rain" mask
          float rainMask = smoothstep(0.2, 0.8, noise(uv * 8.0 + u_time * 3.0));
          col = mix(col, iridescence, rainMask * 0.6 + 0.2);
          
          // Xerox/Glitch Artifacts
          float scanline = sin(vUv.y * u_resolution.y * 0.5) * 0.03;
          col -= scanline;
          
          // Tone mapping & Gamma Correction (Cyberdelic Neon)
          col = pow(col, vec3(1.0 / 2.2)); // sRGB curve
          col = smoothstep(0.0, 1.0, col);
          col = pow(col, vec3(0.85)) * 1.15; // Contrast punch
          
          // Vignette
          float vignette = length(vUv - 0.5) * 2.0;
          col *= 1.0 - smoothstep(0.7, 1.5, vignette);
          
          fragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2() },
        u_mouse: { value: new THREE.Vector2() }
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    material.uniforms.u_mouse.value.set(mx, my);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
  
} catch (error) {
  console.error("Feral WebGL Error:", error);
}