try {
  if (!canvas.__three) {
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

      // ─── ALCHEMICAL NOISE ENGINE ──────────────────────────────────────────
      vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // ─── PERCEPTUAL COLOR SPACE (OKLCh) ───────────────────────────────────
      vec3 oklch2rgb(vec3 c) {
        float L = c.x;
        float C = c.y;
        float h = c.z;
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

        // sRGB Gamma encoding
        vec3 linear_cutoff = vec3(0.0031308);
        vec3 lower = rgb * 12.92;
        vec3 higher = 1.055 * pow(max(rgb, vec3(0.0)), vec3(1.0/2.4)) - 0.055;
        return mix(lower, higher, step(linear_cutoff, rgb));
      }

      // ─── I-CHING 6-BIT FOSSILIZATION ──────────────────────────────────────
      float ichingField(vec2 p) {
        ivec2 ip = ivec2(p * 48.0);
        int val = (ip.x ^ ip.y) & 63; 
        return float(val) / 63.0;
      }

      // ─── ACIDIC CANDY POP PALETTE ─────────────────────────────────────────
      vec3 getAcidColor(float v, float t) {
        // High L, High C, sweeping Hue for toxic neon candy vibes
        float L = 0.70 + 0.15 * sin(v * 14.0 + t);
        float C = 0.25 + 0.12 * cos(v * 11.0 - t * 0.5);
        float H = v * 8.28318 + t * 0.8; 
        return oklch2rgb(vec3(L, C, H));
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;
        
        // 1. Mycelial Anastomosis Domain Warping (Enzymatic Decay Fronts)
        vec2 q = vec2(snoise(p * 1.5 + u_time * 0.15), snoise(p * 1.5 - u_time * 0.2));
        vec2 r = vec2(snoise(p * 3.0 + q + u_time * 0.1), snoise(p * 3.0 - q - u_time * 0.12));
        
        // 2. Semantic Infestation: I-Ching logic corrupts the fungal veins
        float hexGlitch = ichingField(p + r * 0.5);
        
        // Warp coordinates with the glitch
        vec2 warpedP = p + r * 0.4 + (vec2(hexGlitch) - 0.5) * 0.05;
        
        // 3. Fungal Ridge Noise (Cord formers / White rot lace)
        float n = snoise(warpedP * 4.0 - u_time * 0.1);
        float veins = 1.0 - abs(n);
        veins = pow(veins, 3.0); 
        
        float decay = snoise(warpedP * 8.0 + q * 3.0) * 0.5 + 0.5;
        
        // Merging biology with binary artifact
        float v = mix(decay, veins, 0.65) + hexGlitch * 0.15;
        
        // 4. Anisotropic Chromatic Aberration (VHS Chroma Bleed)
        float eps = 0.015;
        float nx = snoise(warpedP * 4.0 + vec2(eps, 0.0)) - n;
        float ny = snoise(warpedP * 4.0 + vec2(0.0, eps)) - n;
        vec2 grad = normalize(vec2(nx, ny) + 0.0001);
        
        vec3 colA = getAcidColor(v, u_time);
        vec3 colB = getAcidColor(v + grad.x * 0.04, u_time + 0.08);
        vec3 colC = getAcidColor(v + grad.y * 0.04, u_time + 0.16);
        
        vec3 finalCol = vec3(colA.r, colB.g, colC.b);
        
        // 5. New Age Glam Fantasy Halation & Bloom
        // Hot pink/magenta toxic glow accumulating in the crevices
        float bloom = smoothstep(0.55, 0.95, v);
        finalCol += vec3(0.9, 0.1, 0.7) * bloom * 0.6; 
        
        // 6. Analog Wear: CRT Scanlines & Print Fade
        float scanline = sin(vUv.y * u_resolution.y * 2.5) * 0.04;
        finalCol -= scanline;
        
        // Lift shadows slightly for that faded VHS print look
        finalCol = mix(finalCol, vec3(0.1, 0.0, 0.2), 0.1);
        
        // Vignette
        float vig = length(vUv - 0.5);
        finalCol *= 1.0 - smoothstep(0.4, 1.0, vig * vig * 2.0);
        
        fragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
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
  }

  const { renderer, scene, camera, material } = canvas.__three;
  
  if (material?.uniforms?.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
}