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

      // Feral Hash functions
      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
      }

      float hash12(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      // Value noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = dot(hash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0, f - vec2(0.0, 0.0));
        float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
        float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
        float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Fractional Brownian Motion (Enzymatic Flow)
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 5; ++i) {
          v += a * noise(p);
          p = rot * p * 2.0 + vec2(100.0, 100.0);
          a *= 0.5;
        }
        return v;
      }

      // Diatom Silica Hex Pores
      float hex(vec2 p) {
        vec2 s = vec2(1.0, 1.7320508);
        vec2 p1 = mod(p, s) - s * 0.5;
        vec2 p2 = mod(p - s * 0.5, s) - s * 0.5;
        return min(length(p1), length(p2));
      }

      // Extremely Acidic Candy Pop Palette (Thin-Film Interference)
      vec3 candyAcid(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(2.0, 1.5, 1.0); 
        vec3 d = vec3(0.8, 0.2, 0.5); 
        
        vec3 col = a + b * cos(6.28318 * (c * t + d));
        
        // Push into neon clipping for that toxic hyper-pop look
        col = smoothstep(0.0, 0.85, col);
        col = pow(col, vec3(0.7)); 
        return col;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
        
        // 1. Semantic Infestation Glitch (W-36)
        float glitch = step(0.99, hash12(vec2(vUv.y * 5.0, floor(u_time * 15.0))));
        uv.x += glitch * 0.03 * sin(u_time * 30.0);

        // 2. Diatomic Symmetry + Enzymatic Domain Warp
        float a = atan(uv.y, uv.x);
        float r = length(uv);
        
        // Radial striae (Diatom architecture)
        float striae = pow(abs(sin(a * 16.0 + r * 10.0)), 2.0);
        
        float t = u_time * 0.15;
        vec2 warpedUv = uv;
        warpedUv += vec2(fbm(uv * 5.0 - t), fbm(uv * 5.0 + t * 1.2)) * 0.15;

        // 3. Silica Architecture (Hex lattice + Mycelial decay)
        float scale = 22.0 + 4.0 * sin(u_time * 0.2);
        float hexField = hex(warpedUv * scale);
        float decay = fbm(warpedUv * 8.0 - t * 2.0);
        
        // Interaction: enzymatic decay hollowing out the structured hex walls
        float structure = hexField * (0.6 + 0.4 * striae) - decay * 0.4;
        
        // 4. Optical Sparkle & Thin Film (Holographic Rainbows)
        float eps = 0.005;
        float hx = hex(vec2(warpedUv.x + eps, warpedUv.y) * scale) * (0.6 + 0.4 * striae) - decay * 0.4;
        float hy = hex(vec2(warpedUv.x, warpedUv.y + eps) * scale) * (0.6 + 0.4 * striae) - decay * 0.4;
        
        vec3 normal = normalize(vec3((hx - structure) / eps, (hy - structure) / eps, 0.8));
        
        // Interference phase based on structure depth and normal viewing angle
        float phase = structure * 3.0 + dot(normal, vec3(0.0, 0.0, 1.0)) * 2.0;
        vec3 color = candyAcid(phase - u_time * 0.3);
        
        // 5. Anastomosis Melanization (Deep fungal crevices)
        float crevice = smoothstep(0.25, -0.05, structure);
        color = mix(color, vec3(0.05, 0.0, 0.15), crevice); // Deep toxic violet
        
        // 6. Stochastic Sparkles (from 'sparkles' repo)
        float NdotV = max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
        float sparkleHash = hash12(vUv * 400.0 + fract(u_time * 0.1));
        float sparkleMask = step(0.97 - NdotV * 0.05, sparkleHash) * smoothstep(0.0, 0.3, structure);
        color += vec3(1.0, 0.95, 0.2) * sparkleMask * 4.0; // Electric lemon flashes
        
        // 7. Vignette & Chromatic Aberration
        float iris = smoothstep(1.2, 0.2, r);
        color *= iris;

        // Glitch chroma bleed
        color.r += glitch * 0.6 * candyAcid(phase + 0.1).r;
        color.b -= glitch * 0.3 * candyAcid(phase - 0.1).b;

        fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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