try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: ctx,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(1); // Force 1:1 pixel mapping for crisp scanlines

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

      // Pristine CRT curve
      vec2 curveUV(vec2 uv) {
        vec2 centered = uv * 2.0 - 1.0;
        float r = dot(centered, centered);
        centered *= 1.0 + r * 0.04; 
        return centered * 0.5 + 0.5;
      }

      // Square lattice moiré
      float grid(vec2 p, float scale, vec2 offset) {
        vec2 st = p * scale + offset;
        vec2 g = abs(fract(st) - 0.5);
        // Crisp, sub-pixel smooth lines
        float line = smoothstep(0.06, 0.0, g.x) + smoothstep(0.06, 0.0, g.y);
        return clamp(line, 0.0, 1.0);
      }

      void main() {
        // Apply CRT geometry distortion
        vec2 crtUv = curveUV(vUv);

        // Map to physical screen pixels for scanline/interlace math
        vec2 pixelCoord = crtUv * u_resolution;

        // Map to aspect-corrected UV for the moiré grids
        vec2 aspectUv = crtUv * 2.0 - 1.0;
        aspectUv.x *= u_resolution.x / u_resolution.y;

        // --- MOIRÉ KINETICS ---
        // Slow, precise drift to create sweeping interference fringes
        vec2 offset1 = vec2(u_time * 0.015, u_time * 0.011);
        vec2 offset2 = vec2(-u_time * 0.008, u_time * 0.018);

        // Scale differential creates the beat frequency (moiré)
        float g1 = grid(aspectUv, 60.0, offset1);
        float g2 = grid(aspectUv, 61.2, offset2);

        // Multiplicative blending for pure interference
        float moireInterference = g1 * g2;
        float faintGrid = (g1 + g2) * 0.15;

        // --- CRT RASTER & INTERLACING ---
        // Scanlines tied to curved physical pixels
        float scanline = sin(pixelCoord.y * 2.09439) * 0.5 + 0.5; // ~ 2*PI/3

        // Interlacing field: alternates every other line
        float fieldIndex = mod(floor(pixelCoord.y * 0.5), 2.0);
        
        // Electric shimmer alternating between fields
        float shimmer = sin(u_time * 35.0 + fieldIndex * 3.14159) * 0.5 + 0.5;

        // --- COLOR PALETTE ---
        vec3 cobaltBase = vec3(0.01, 0.03, 0.12);
        vec3 electricBlue = vec3(0.05, 0.35, 0.95);
        vec3 nearWhite = vec3(0.85, 0.95, 1.0);

        // Base monitor glow
        vec3 col = cobaltBase;

        // Apply scanline and interlaced shimmer
        col += electricBlue * scanline * (0.3 + 0.7 * shimmer) * 0.4;

        // Apply moiré grid layers
        // Faint underlying grid in electric blue
        col += electricBlue * faintGrid * scanline;
        
        // Bright interference fringes in near-white
        col += nearWhite * moireInterference * (0.8 + 0.2 * shimmer);

        // Pristine phosphor bloom on the interference
        col += electricBlue * moireInterference * 0.6;

        // Screen vignette (monitor bezel shadow)
        float dist = length(crtUv * 2.0 - 1.0);
        float vignette = smoothstep(1.2, 0.4, dist);
        
        // Darken edges slightly to emphasize the cold, pristine screen
        col *= vignette;

        // Hard crop outside the curved CRT bounds
        if (crtUv.x < 0.0 || crtUv.x > 1.0 || crtUv.y < 0.0 || crtUv.y > 1.0) {
          col = vec3(0.005, 0.01, 0.03); // Deep bezel color
        }

        fragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
      },
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
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}