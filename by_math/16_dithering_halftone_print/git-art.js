if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_isPressed;

      // pxv.technique.bayer_4x4.v1
      const float bayer4[16] = float[16](
         0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
        12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
         3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
        15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
      );

      // Lisa Frank x Voxel Palette
      const vec3 paletteColors[6] = vec3[6](
        vec3(0.06, 0.02, 0.15), // Deep Velvet
        vec3(0.95, 0.05, 0.75), // Hot Magenta
        vec3(0.05, 0.95, 0.95), // Electric Cyan
        vec3(0.95, 0.95, 0.05), // Acid Yellow
        vec3(0.50, 0.05, 0.95), // Ultraviolet
        vec3(0.95, 0.95, 0.95)  // White
      );

      // pxv.shader.palette_map_nearest.v1
      vec3 nearestPalette(vec3 col) {
        vec3 best = paletteColors[0];
        float bestDist = 10.0;
        for(int i = 0; i < 6; i++) {
          // YUV-ish perceptual weighting
          vec3 diff = col - paletteColors[i];
          float d = dot(diff * vec3(0.299, 0.587, 0.114), diff * vec3(0.299, 0.587, 0.114));
          if(d < bestDist) {
            bestDist = d;
            best = paletteColors[i];
          }
        }
        return best;
      }

      // structural_color: Thin Film Interference Cosine Palette
      vec3 thinFilmInterference(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(2.0, 2.0, 2.0); // High frequency for iridescence
        vec3 d = vec3(0.0, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        // pxv.shader.pixelate_grid_lock.v1
        vec2 virtualRes = vec2(320.0, 240.0);
        vec2 pxUv = floor(vUv * virtualRes) / virtualRes;

        vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
        vec2 p = (pxUv - 0.5) * aspect * 20.0;
        vec2 m = (u_mouse - 0.5) * aspect * 20.0;

        // Defect injection via interaction
        float distToMouse = length(p - m);
        float defect = exp(-distToMouse * 0.5) * sin(distToMouse * 10.0 - u_time * 8.0) * u_isPressed;
        p += normalize(p - m + 0.001) * defect;

        // quasicrystals: 5-fold Penrose projection field
        float phi = 1.6180339887;
        float qc = 0.0;
        
        // Base aperiodic field
        for(int i = 0; i < 5; i++) {
            float angle = float(i) * 3.14159265 / 5.0;
            vec2 dir = vec2(cos(angle), sin(angle));
            qc += cos(dot(p, dir) + u_time * 0.5);
        }

        // Domain warping using the field to create biological folds
        vec2 warp = vec2(cos(qc), sin(qc)) * phi;
        p += warp * 0.5;

        // Second layer of quasicrystal over warped domain
        float qc2 = 0.0;
        for(int i = 0; i < 5; i++) {
            float angle = float(i) * 3.14159265 / 5.0 + (3.14159265 / 10.0);
            vec2 dir = vec2(cos(angle), sin(angle));
            qc2 += cos(dot(p, dir) * 0.618033 - u_time * 0.2);
        }

        // Combine into a "thickness" map for structural color
        float thickness = (qc + qc2) * 0.1 + 0.5;
        
        // Add artificial Bragg reflection bands
        thickness += sin(thickness * 20.0) * 0.05;

        // Generate raw iridescent color
        vec3 rawColor = thinFilmInterference(thickness + u_time * 0.1);
        
        // Boost saturation for Lisa Frank aesthetic
        rawColor = pow(rawColor, vec3(0.6));

        // pxv.shader.ordered_dither.v1
        int bx = int(mod(vUv.x * virtualRes.x, 4.0));
        int by = int(mod(vUv.y * virtualRes.y, 4.0));
        float bayer = bayer4[by * 4 + bx];

        // Apply dither spread based on luminance
        float spread = 0.35;
        vec3 ditheredColor = rawColor + (bayer - 0.5) * spread;

        // Snap to palette
        vec3 finalColor = nearestPalette(ditheredColor);

        // pxv.shader.outline_sobel.v1 (approximated via edge detection on thickness)
        float edge = abs(dFdx(thickness)) + abs(dFdy(thickness));
        if (edge > 0.03) {
            finalColor = paletteColors[0]; // Dark velvet outline
        }

        fragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_isPressed: { value: 0.0 }
      },
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material?.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
  
  // Normalize mouse to 0.0 - 1.0, flip Y for WebGL
  const mx = mouse.x / grid.width;
  const my = 1.0 - (mouse.y / grid.height);
  
  // Smooth mouse follow
  material.uniforms.u_mouse.value.x += (mx - material.uniforms.u_mouse.value.x) * 0.1;
  material.uniforms.u_mouse.value.y += (my - material.uniforms.u_mouse.value.y) * 0.1;
  
  // Smooth click interaction
  const targetPress = mouse.isPressed ? 1.0 : 0.0;
  material.uniforms.u_isPressed.value += (targetPress - material.uniforms.u_isPressed.value) * 0.1;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);