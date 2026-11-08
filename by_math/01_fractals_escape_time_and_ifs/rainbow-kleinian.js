if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      // 4x4 Bayer Matrix for structural dither
      const float bayerMatrix[16] = float[](
          0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
          12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
          3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
          15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
      );

      float getBayer(vec2 fc) {
          int x = int(fc.x) % 4;
          int y = int(fc.y) % 4;
          return bayerMatrix[y * 4 + x];
      }

      // IQ Cosine Palette - Neon Acid (color_fields)
      vec3 cosinePaletteNeon(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.33);
          vec3 c = vec3(2.0, 1.0, 1.0);
          vec3 d = vec3(0.5, 0.2, 0.25);
          return a + b * cos(6.28318 * (c * t + d));
      }

      // Möbius Circle Inversion
      vec2 invert(vec2 z, vec2 center, float radius) {
          vec2 d = z - center;
          // Tiny epsilon to invite controlled hardware NaN glitches near singularities
          float r2 = dot(d, d) + 0.00001; 
          return center + d * (radius * radius) / r2;
      }

      // Kleinian Schottky Group Limit Set Approximation
      float schottky(vec2 z, float time) {
          vec2 c1 = vec2(1.0, 0.0);
          vec2 c2 = vec2(-1.0, 0.0);
          vec2 c3 = vec2(0.0, 1.0);
          vec2 c4 = vec2(0.0, -1.0);
          
          // Rotate the limit set generators
          float a = time * 0.15;
          float c = cos(a), s = sin(a);
          mat2 rot = mat2(c, -s, s, c);
          c1 *= rot; c2 *= rot; c3 *= rot; c4 *= rot;
          
          // Oscillate radius into overlapping territory (triggers non-Schottky chaos)
          float r = 0.92 + sin(time * 0.4) * 0.15;
          
          float iter = 0.0;
          for(int i = 0; i < 24; i++) {
              float d1 = distance(z, c1);
              float d2 = distance(z, c2);
              float d3 = distance(z, c3);
              float d4 = distance(z, c4);
              
              // Find nearest reflection circle
              float minDist = min(min(d1, d2), min(d3, d4));
              
              if (minDist < r) {
                  if (minDist == d1) z = invert(z, c1, r);
                  else if (minDist == d2) z = invert(z, c2, r);
                  else if (minDist == d3) z = invert(z, c3, r);
                  else z = invert(z, c4, r);
                  iter += 1.0;
              } else {
                  break; // Escaped the limit set
              }
          }
          return iter / 24.0;
      }

      // HUD Reticle Element
      float crosshair(vec2 uv, float radius) {
          float c = smoothstep(0.015, 0.0, abs(length(uv) - radius));
          float vDash = smoothstep(0.01, 0.0, abs(uv.x)) * step(radius * 0.7, abs(uv.y)) * step(abs(uv.y), radius * 1.3);
          float hDash = smoothstep(0.01, 0.0, abs(uv.y)) * step(radius * 0.7, abs(uv.x)) * step(abs(uv.x), radius * 1.3);
          return clamp(c + vDash + hDash, 0.0, 1.0);
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          vec3 finalColor = vec3(0.0);
          float totalWeight = 0.0;
          
          // Multi-plane Parallax Depth Field
          const int NUM_PLANES = 7;
          float focalDepth = mix(0.2, 0.8, u_mouse.y);
          vec2 mouseOffset = (u_mouse - 0.5) * vec2(-2.0, 2.0);

          for (int i = 0; i < NUM_PLANES; i++) {
              float depth = float(i) / float(NUM_PLANES - 1);
              
              // Perspective scaling
              float z_scale = mix(0.4, 3.5, depth);
              vec2 scaledUV = uv * z_scale;
              
              // Parallax shift based on depth
              vec2 offset = mouseOffset * depth * 1.5;
              
              // Terminator HUD Chromatic Parallax Split
              float disp = (depth - focalDepth) * 0.15;
              
              vec2 uvR = scaledUV + offset + vec2(disp, disp * 0.2);
              vec2 uvG = scaledUV + offset;
              vec2 uvB = scaledUV + offset - vec2(disp, disp * 0.2);
              
              // Evaluate Kleinian fractal for each channel
              float vR = schottky(uvR, u_time + depth);
              float vG = schottky(uvG, u_time + depth);
              float vB = schottky(uvB, u_time + depth);
              
              vec3 rgb = vec3(vR, vG, vB);
              
              // Rainblow Color Mapping
              vec3 planeCol = cosinePaletteNeon(vG * 2.0 + u_time * 0.2 - depth);
              planeCol *= rgb; 
              
              // Focal Plane HUD Lock
              if (abs(depth - focalDepth) < 0.05) {
                  float ch = crosshair(uvG + offset * 0.5, 0.6);
                  planeCol += ch * vec3(0.0, 1.0, 0.8); 
              }
              
              // Structural Grid
              float gridLine = max(
                  abs(sin((uvG.x + offset.x) * 15.0)),
                  abs(sin((uvG.y + offset.y) * 15.0))
              );
              gridLine = pow(gridLine, 30.0) * 0.3;
              planeCol += gridLine * cosinePaletteNeon(depth + 0.5) * vG;
              
              // Depth of Field Weighting
              float distToFocus = abs(depth - focalDepth);
              float weight = 1.0 - smoothstep(0.0, 0.5, distToFocus);
              weight = pow(weight, 2.0) + 0.05; 
              
              // Atmospheric Decay
              planeCol = mix(vec3(0.02, 0.0, 0.05), planeCol, smoothstep(1.0, 0.0, depth));
              
              finalColor += planeCol * weight;
              totalWeight += weight;
          }
          
          finalColor /= totalWeight;
          
          // Structural Dither Injection
          float dither = getBayer(gl_FragCoord.xy) - 0.5;
          finalColor += dither * 0.25;
          
          // HDR Tonemapping (Reinhard + Gamma)
          finalColor = finalColor / (1.0 + finalColor);
          finalColor = pow(finalColor, vec3(1.0 / 2.2)); 
          
          // Vignette
          float vig = length(uv * 0.8);
          finalColor *= 1.0 - smoothstep(0.5, 1.5, vig);
          
          fragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { 
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
          u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: fragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
    canvas.__targetMouse = { x: 0.5, y: 0.5 };
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
    
    // Smooth damp mouse tracking for parallax
    if (mouse.x !== 0 || mouse.y !== 0) {
        canvas.__targetMouse.x = mouse.x / grid.width;
        canvas.__targetMouse.y = mouse.y / grid.height;
    }
    if (material.uniforms.u_mouse) {
        material.uniforms.u_mouse.value.x += (canvas.__targetMouse.x - material.uniforms.u_mouse.value.x) * 0.1;
        material.uniforms.u_mouse.value.y += (canvas.__targetMouse.y - material.uniforms.u_mouse.value.y) * 0.1;
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);