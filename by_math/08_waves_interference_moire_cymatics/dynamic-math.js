try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
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

      // HSB to RGB for the Lisa Frank / Acid Vibration palette fusion
      vec3 hue(float t) {
        vec3 c = vec3(t, t + 0.3333, t + 0.6666);
        return 0.5 + 0.5 * cos(6.28318 * c);
      }

      // Psychedelic Collage: Kaleidoscope / Mirror-Tile Pattern (psc.technique.kaleidoscope_pattern.v1)
      vec2 kaleidoscope(vec2 uv, float folds) {
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float sector = 6.2831853 / folds;
        angle = mod(angle, sector);
        if (angle > sector * 0.5) angle = sector - angle;
        return vec2(cos(angle), sin(angle)) * radius;
      }

      // The Strange Mechanism: Acoustic Cleavage
      // Chladni eigenmodes tearing apart a Trigonal (Calcite) crystal lattice
      vec3 acousticCleavage(vec2 uv) {
        // Möbius-like breathing inversion (Chrono-Stratigraphic Fluid)
        float pulse = sin(u_time * 0.4) * 0.5 + 0.5;
        vec2 inv_uv = uv / (dot(uv, uv) + 0.5);
        uv = mix(uv, inv_uv, pulse * 0.15);

        // Force Hexagonal/Trigonal symmetry (Crystal Systems: 04_trigonal)
        vec2 k_uv = kaleidoscope(uv, 6.0);
        
        // Vibration Physics: Sweeping Chladni eigenmodes (m, n indices)
        float f = u_time * 0.15;
        float m = 3.0 + sin(f) * 4.0;
        float n = 5.0 + cos(f * 0.73) * 3.0;
        
        // Chladni plate wave equation approximation
        float chladni = cos(m * 3.1415 * k_uv.x) * cos(n * 3.1415 * k_uv.y) 
                      - cos(n * 3.1415 * k_uv.x) * cos(m * 3.1415 * k_uv.y);
        
        // Crystalline lattice (intersecting planes) warped by the acoustic radiation pressure
        vec2 c_uv = uv * 12.0 * (1.0 + chladni * 0.15);
        float d1 = sin(c_uv.x * 6.28 + u_time);
        float d2 = sin((c_uv.x * 0.5 + c_uv.y * 0.866) * 6.28 - u_time * 1.2);
        float d3 = sin((c_uv.x * 0.5 - c_uv.y * 0.866) * 6.28 + u_time * 0.8);
        float lattice = d1 * d2 * d3;
        
        // Cyberdelic Neon / Lisa Frank Palette mapping
        vec3 voidBlack = vec3(0.02, 0.01, 0.04);
        vec3 hotMagenta = vec3(1.0, 0.0, 0.78);
        vec3 acidLime = vec3(0.66, 1.0, 0.0);
        
        // Rainbow chatoyancy along the crystal lattice
        vec3 latticeColor = hue(length(uv) * 2.0 - u_time * 0.5);
        
        // Structural Failure: Where nodes exist, the crystal fractures
        float node = smoothstep(0.15, 0.0, abs(chladni)); 
        float crystal_edge = smoothstep(0.2, 0.0, abs(lattice));
        
        // Base composite
        vec3 color = mix(voidBlack, latticeColor, crystal_edge);
        
        // Inject Acid Vibration at the fault lines
        color = mix(color, hotMagenta, node * 0.7);
        color += acidLime * node * crystal_edge * 2.5; // Extreme energy at intersections
        
        return color;
      }

      void main() {
        // Normalize coordinates to center, correct aspect ratio
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= u_resolution.x / u_resolution.y;
        
        // Global slow rotation
        float t = u_time * 0.05;
        mat2 rotGlobal = mat2(cos(t), -sin(t), sin(t), cos(t));
        uv *= rotGlobal;
        
        // Print Artifact: CMYK Misregistration / Chromatic Aberration
        vec2 offR = vec2(0.012, 0.0) * sin(u_time * 2.0);
        vec2 offG = vec2(-0.005, 0.01) * cos(u_time * 1.7);
        vec2 offB = vec2(0.0, -0.012) * sin(u_time * 2.3);
        
        float r = acousticCleavage(uv + offR).r;
        float g = acousticCleavage(uv + offG).g;
        float b = acousticCleavage(uv + offB).b;
        vec3 col = vec3(r, g, b);
        
        // Print Artifact: Halftone Screen (psc.print_artifact.halftone_screen.v1)
        // The halftone acts as the "sand" collecting at the nodal lines
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float rad = radians(45.0);
        mat2 rotHt = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
        vec2 ht_uv = rotHt * vUv * u_resolution * 60.0 / 1024.0;
        vec2 cell = fract(ht_uv) - 0.5;
        float dist = length(cell);
        
        // Halftone dots get larger in dark areas, smaller in bright areas
        float dotRadius = sqrt(clamp(1.0 - luma, 0.0, 1.0)) * 0.55;
        float ht = smoothstep(dotRadius + 0.05, dotRadius - 0.05, dist);
        
        // Multiply blend the halftone (dark purple/black ink)
        vec3 inkColor = vec3(0.05, 0.0, 0.1);
        col = mix(col, col * inkColor, ht * 0.85);
        
        // Print Artifact: Photocopy Noise / Grain
        float grain = fract(sin(dot(vUv * 1000.0 + fract(u_time), vec2(127.1, 311.7))) * 43758.5453);
        col += (grain - 0.5) * 0.15;
        
        // Vignette burn
        float vig = length(vUv - 0.5) * 2.0;
        col *= 1.0 - pow(vig, 2.5) * 0.6;
        
        fragColor = vec4(col, 1.0);
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
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  // Handle aspect ratio updates safely
  if (camera.aspect !== grid.width / grid.height) {
    camera.aspect = grid.width / grid.height;
    camera.updateProjectionMatrix();
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
}