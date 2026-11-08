try {
  // Check WebGL availability and initialize Three.js
  if (!canvas.__three && !canvas.__fallback2D) {
    try {
      if (!ctx) throw new Error("Context not available");

      const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;

      const vertexShader = `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `;

      // FERAL SHADER: Multi-scale Turing Morphogenesis + Acid Vibration Palette + CMYK Misregistration + Kaleidoscope
      const fragmentShader = `
        precision highp float;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        
        in vec2 vUv;
        out vec4 fragColor;

        // 2D Rotation Matrix
        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Gyroid function for organic structural noise
        float gyroid(vec3 p) {
            return dot(sin(p), cos(p.yzx));
        }

        // Fractional Brownian Motion using Gyroids
        float fbm(vec3 p) {
            float f = 0.0;
            float amp = 0.5;
            for(int i = 0; i < 6; i++) {
                f += amp * abs(gyroid(p));
                p.xy *= rot(1.1);
                p.yz *= rot(0.9);
                p *= 1.7;
                p.z += u_time * 0.1;
                amp *= 0.55;
            }
            return f;
        }

        // McCabe-style Cyclic Symmetry Fold
        vec2 fold(vec2 p, float sym) {
            float r = length(p);
            float a = atan(p.y, p.x);
            float s = 6.2831853 / sym;
            a = mod(a + u_time * 0.05, s);
            a = abs(a - s / 2.0);
            return vec2(cos(a), sin(a)) * r;
        }

        // Morphogenesis Ridge Extraction
        float morphogenesis(vec3 p) {
            float d1 = fbm(p);
            float d2 = fbm(p + vec3(d1 * 2.5));
            // Extract high-gradient ridges to simulate crystalline/tissue borders
            float ridge = abs(d2 - fbm(p + vec3(0.05)));
            return d2 + ridge * 1.5;
        }

        // Acid Vibration Palette (Cyberdelic Neon)
        vec3 acidPalette(float t) {
            // Base cosine interference palette
            vec3 a = vec3(0.5);
            vec3 b = vec3(0.5);
            vec3 c = vec3(2.0, 1.5, 1.0);
            vec3 d = vec3(0.0, 0.33, 0.67);
            vec3 col = a + b * cos(6.28318 * (c * t + d));
            
            // Inject aggressive neons (Hot Magenta, Acid Lime, Cyan, Electric Orange)
            vec3 neon = mix(vec3(1.0, 0.0, 0.78), vec3(0.0, 1.0, 0.93), smoothstep(0.0, 1.0, sin(t * 12.0) * 0.5 + 0.5));
            neon = mix(neon, vec3(0.66, 1.0, 0.0), smoothstep(0.5, 1.0, cos(t * 8.0) * 0.5 + 0.5));
            neon = mix(neon, vec3(1.0, 0.41, 0.0), smoothstep(0.8, 1.0, sin(t * 20.0) * 0.5 + 0.5));
            
            return mix(col, neon, 0.85); // 85% dominance of aggressive neon
        }

        void main() {
            vec2 uv = (vUv - 0.5) * 2.0;
            uv.x *= u_resolution.x / u_resolution.y;

            // Mouse interaction warp
            vec2 m = u_mouse * 2.0 - 1.0;
            uv -= m * 0.2;

            // Glitch / Scan-bend artifacts
            float glitch = step(0.96, fract(sin(u_time * 0.5) * 43758.5));
            float streak = step(0.9, fract(sin(vUv.y * 200.0 + u_time * 5.0) * 43758.5)) * glitch;

            // Apply cyclic symmetry
            vec2 folded = fold(uv, 8.0 + 2.0 * sin(u_time * 0.2));
            vec3 p = vec3(folded * 3.5, u_time * 0.15);
            
            vec3 color = vec3(0.0);
            
            // CMYK Misregistration & Chromatic Aberration loop
            for(int i = 0; i < 3; i++) {
                vec3 p_off = p;
                // Offset channels physically
                p_off.x += float(i) * (0.02 + streak * 0.15);
                p_off.y -= float(i) * 0.008;
                
                // Evaluate morphogenesis field
                float mField = morphogenesis(p_off);
                
                // Map to acid color
                vec3 channelColor = acidPalette(mField + u_time * 0.2);
                
                // Extract R, G, B
                if(i == 0) color.r = channelColor.r;
                if(i == 1) color.g = channelColor.g;
                if(i == 2) color.b = channelColor.b;
            }

            // Halftone Screen Print Artifact
            vec2 grid = fract(vUv * u_resolution * 0.4) - 0.5;
            float dotDist = length(grid);
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            float halftone = smoothstep(0.6 * luma, 0.6 * luma + 0.1, dotDist);
            color = mix(color, color * halftone, 0.2); // Subtle halftone overlay

            // Photocopy Noise / Film Grain
            float grain = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
            color += (grain - 0.5) * 0.15;

            // Vignette for depth
            float dist = distance(vUv, vec2(0.5));
            color *= smoothstep(0.9, 0.3, dist);

            fragColor = vec4(color, 1.0);
        }
      `;

      const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
          u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
        },
        vertexShader,
        fragmentShader
      });

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(mesh);
      
      canvas.__three = { renderer, scene, camera, material };
    } catch (err) {
      console.error("WebGL Initialization Failed. Falling back to feral 2D.", err);
      canvas.__fallback2D = true;
    }
  }

  // ---------------------------------------------------------
  // 2D FALLBACK (If WebGL context fails)
  // ---------------------------------------------------------
  if (canvas.__fallback2D) {
    const w = grid.width;
    const h = grid.height;
    ctx.fillStyle = '#020005';
    ctx.fillRect(0, 0, w, h);
    
    const t = time * 0.8;
    const cx = w / 2;
    const cy = h / 2;
    
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 400; i++) {
      const angle = i * 2.39996 + t; // Golden ratio approx
      const radius = i * (w / 800) + Math.sin(i * 0.1 - t * 3) * 80;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      
      // Cyberdelic Neon Acid Palette
      const colors = ['#FF00C8', '#AAFF00', '#00FFEE', '#FF6B00'];
      ctx.fillStyle = colors[i % colors.length];
      
      ctx.beginPath();
      const dotRadius = Math.max(1, 25 * Math.sin(i * 0.05 + t));
      ctx.arc(Math.max(0, x), Math.max(0, y), dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    return;
  }

  // ---------------------------------------------------------
  // WEBGL RENDER LOOP
  // ---------------------------------------------------------
  const { renderer, scene, camera, material } = canvas.__three;

  if (material?.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Normalize mouse coordinates (0 to 1), flip Y for WebGL
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    material.uniforms.u_mouse.value.set(mx, my);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (globalErr) {
  console.error("Critical error in Feral Generator:", globalErr);
}