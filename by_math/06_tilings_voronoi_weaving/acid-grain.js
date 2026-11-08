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
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      // Feral Hash Generators
      float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      vec3 hash33(vec3 p3) {
          p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
          p3 += dot(p3, p3.yxz + 33.33);
          return fract((p3.xxy + p3.yxx) * p3.zyx);
      }

      // 3D Noise for smooth manifolds
      float noise3D(vec3 x) {
          vec3 p = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          float n = p.x + p.y * 157.0 + 113.0 * p.z;
          vec4 h1 = fract(sin(vec4(n, n+1.0, n+157.0, n+158.0)) * 43758.5453);
          vec2 res1 = mix(h1.xz, h1.yw, f.x);
          float n1 = mix(res1.x, res1.y, f.y);
          n += 113.0;
          vec4 h2 = fract(sin(vec4(n, n+1.0, n+157.0, n+158.0)) * 43758.5453);
          vec2 res2 = mix(h2.xz, h2.yw, f.x);
          float n2 = mix(res2.x, res2.y, f.y);
          return mix(n1, n2, f.z);
      }

      // Mycological Voronoi (Minkowski morphing + L-Infinity bias)
      float voronoi(vec3 x) {
          vec3 p = floor(x);
          vec3 f = fract(x);
          float res = 100.0;
          for(int k = -1; k <= 1; k++) {
              for(int j = -1; j <= 1; j++) {
                  for(int i = -1; i <= 1; i++) {
                      vec3 b = vec3(float(i), float(j), float(k));
                      vec3 r = vec3(b) - f + hash33(p + b);
                      
                      // L-Infinity / Minkowski distance for crystalline/fungal tension
                      float d_inf = max(abs(r.x), max(abs(r.y), abs(r.z))); 
                      float d_euc = length(r);
                      
                      // Phase shift between organic and bureaucratic geometric failure
                      float d = mix(d_euc, d_inf, 0.45);
                      res = min(res, d);
                  }
              }
          }
          return res;
      }

      // FBM for complex fields
      float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for(int i = 0; i < 4; i++) {
              v += a * noise3D(p);
              p *= 2.0;
              a *= 0.5;
          }
          return v;
      }

      void main() {
          // TIME SCALES: The three temporal directives
          // Slow: Global structural flow (AdS boundary expansion)
          float t_slow = u_time * 0.04;
          // Medium: Enzymatic breakdown, mycelial anastomosis, and structural motion
          float t_med  = u_time * 0.25;
          // Fast: Thin-film interference, sensor noise, and glitch shimmer
          float t_fast = u_time * 2.5;

          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= u_resolution.x / u_resolution.y;

          // DAMAGE AESTHETICS: Macroblocking & Interframe Smear
          vec2 blockUV = floor(vUv * 24.0) / 24.0;
          float blockTrigger = step(0.96, hash12(blockUV + floor(t_med * 4.0)));
          vec2 glitchUV = mix(uv, blockUV * 2.0 - 1.0, blockTrigger * 0.12);

          // HOLOGRAPHIC AdS WARP (Slow scale)
          // Radial depth = scale. Near boundary carries finer frequencies.
          float z = 1.0 + 0.85 * fbm(vec3(glitchUV * 1.2, t_slow));
          vec2 warpedUV = glitchUV / z;
          
          // Non-commutative curl / Domain Warp
          float angle = fbm(vec3(warpedUV * 2.5, t_slow * 0.7)) * 6.2831853;
          warpedUV += vec2(cos(angle), sin(angle)) * 0.35;

          // MYCELIAL ANASTOMOSIS / ENZYMATIC FRONT (Medium scale)
          // Voronoi cell walls simulate hyphal boundaries and sector constraints
          float cell = voronoi(vec3(warpedUV * 4.5, t_med));
          float lace = fbm(vec3(warpedUV * 10.0, t_med * 1.1));
          float structure = mix(cell, lace, 0.5);

          // Calculate pseudo-normal from structure for thin-film refraction
          vec2 eps = vec2(0.015, 0.0);
          float nx = voronoi(vec3((warpedUV + eps.xy) * 4.5, t_med)) - voronoi(vec3((warpedUV - eps.xy) * 4.5, t_med));
          float ny = voronoi(vec3((warpedUV + eps.yx) * 4.5, t_med)) - voronoi(vec3((warpedUV - eps.yx) * 4.5, t_med));
          vec3 normal = normalize(vec3(nx, ny, 0.25));

          // STRUCTURAL COLOR / THIN FILM INTERFERENCE (Fast scale shimmer)
          float viewAngle = max(0.0, dot(normal, vec3(0.0, 0.0, 1.0)));
          
          // Thickness fluctuates rapidly (fast time) simulating unstable lipid layers
          float thickness = 150.0 + 500.0 * noise3D(vec3(warpedUV * 12.0, t_fast)); 
          float pathDiff = 2.0 * 1.45 * thickness * viewAngle; // Assumed n=1.45
          
          // Map phase directly to ACID CANDY POP (Neon Cyan, Magenta, Yellow)
          float phase = (pathDiff / 350.0) + t_fast * 0.4;
          
          // Quantize phase for "banding failure" / "Y2K gloss"
          float qPhase = floor(phase * 8.0) / 8.0;
          float smoothPhase = mix(qPhase, phase, 0.4); // Partial banding

          // Acidic Color Palette
          vec3 c_cyan = vec3(0.0, 1.0, 1.0);
          vec3 c_mag  = vec3(1.0, 0.0, 1.0);
          vec3 c_yel  = vec3(1.0, 1.0, 0.0);
          
          vec3 texColor = vec3(0.0);
          float cycle = fract(smoothPhase);
          if (cycle < 0.333) {
              texColor = mix(c_cyan, c_mag, smoothstep(0.0, 0.333, cycle));
          } else if (cycle < 0.666) {
              texColor = mix(c_mag, c_yel, smoothstep(0.333, 0.666, cycle));
          } else {
              texColor = mix(c_yel, c_cyan, smoothstep(0.666, 1.0, cycle));
          }

          // VOID BLACK / ABYSSAL RENDERING
          // Carve out the void based on structural density
          float voidMask = smoothstep(0.42, 0.48, structure);
          
          // Add internal fungal cavities (sclerotium wait states / memory erosion)
          voidMask *= smoothstep(0.15, 0.25, fbm(vec3(warpedUV * 8.0, t_med * 0.4)));

          vec3 finalColor = texColor * voidMask;

          // DAMAGE: Sensor Noise & Hot Pixels
          float sensorNoise = hash12(vUv * u_time * 100.0);
          finalColor += vec3(sensorNoise * 0.06); // Base physical grain
          
          float hotPixel = step(0.998, hash12(vUv + floor(u_time * 45.0)));
          finalColor += c_mag * hotPixel * 1.5;

          // DAMAGE: Chroma Bleed (Analog Video)
          // Smear the red/magenta channel horizontally based on structure
          float bleed = fbm(vec3(warpedUV * 15.0 + vec2(t_fast, 0.0), 1.0));
          finalColor.r += bleed * 0.25 * voidMask;
          finalColor.b += bleed * 0.15 * voidMask;

          // Luminous Phosphor Bloom around structure edges
          float edgeBloom = smoothstep(0.48, 0.42, structure) * smoothstep(0.36, 0.42, structure);
          finalColor += c_cyan * edgeBloom * 1.2;

          // Gamma correct and output
          fragColor = vec4(pow(clamp(finalColor, 0.0, 1.0), vec3(1.0/2.2)), 1.0);
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
  if (material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material.uniforms.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);