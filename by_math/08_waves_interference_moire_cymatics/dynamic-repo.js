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
      uniform vec2 u_mouse;

      // --- NOISE FIELDS: Compact Simplex 2D ---
      vec3 permute(vec3 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
      float snoise2(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m * m; m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 a0 = x - floor(x + 0.5);
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        return 130.0 * dot(m, vec3(a0.x * x0.x + h.x * x0.y, a0.y * x12.x + h.y * x12.y, a0.z * x12.z + h.z * x12.w));
      }

      // --- VIBRATION: Chladni Plate Modal Analysis ---
      float chladni(vec2 p, float m, float n) {
        float pi = 3.14159265359;
        // Superimposing degenerate modes to find nodal lines
        return cos(n * pi * p.x) * cos(m * pi * p.y) - cos(m * pi * p.x) * cos(n * pi * p.y);
      }

      // --- STRUCTURAL COLOR: Thin Film Interference ---
      vec3 thinFilm(float thickness, float cosTheta) {
        float n_film = 1.56; // Chitin / Crystal lattice
        float pathDiff = 2.0 * n_film * thickness * cosTheta;
        // Phase offsets for R, G, B based on Black Body / Cyberdelic Neon
        vec3 phase = vec3(0.0, 0.33, 0.67);
        // Optical vibration via cosine palette logic
        return 0.5 + 0.5 * cos(6.28318 * (pathDiff * vec3(1.2, 1.0, 0.8) + phase));
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        vec2 mPos = u_mouse * 2.0 - 1.0;
        mPos.x *= u_resolution.x / u_resolution.y;

        // --- NOISE FIELDS: Psychedelic Iterative Domain Warp ---
        // Simulates "Alien Membrane" and "Fungal Growth" recipes
        vec2 wp = p;
        float warpStr = 0.15 + 0.1 * snoise2(p + u_time * 0.1);
        for(int i = 0; i < 3; i++) {
            float fi = float(i);
            float n1 = snoise2(wp * 2.0 + u_time * 0.2 + fi);
            float n2 = snoise2(wp * 2.0 - u_time * 0.15 + vec2(5.2, 1.3) + fi);
            wp += vec2(n1, n2) * warpStr;
        }

        // Interaction: Fluid displacement
        float dist = length(wp - mPos);
        wp += normalize(wp - mPos) * exp(-dist * 4.0) * 0.25;

        // Dynamic Chladni Eigenfrequencies
        float modeM = 2.0 + snoise2(vec2(u_time * 0.05, 0.0)) * 2.5;
        float modeN = 3.0 + snoise2(vec2(0.0, u_time * 0.07)) * 3.5;

        // --- PSYCHEDELIC COLLAGE: CMYK Misregistration (Chromatic Aberration) ---
        vec2 offR = vec2(0.02, -0.01) * sin(u_time * 0.8);
        vec2 offB = vec2(-0.01, 0.02) * cos(u_time * 1.2);

        float cR = chladni(wp + offR, modeM, modeN);
        float cG = chladni(wp, modeM, modeN);
        float cB = chladni(wp + offB, modeM, modeN);

        // Nodal lines (where Chladni == 0) accumulate particles / fluid thickness
        float thickR = pow(1.0 - abs(cR), 3.0) * 700.0;
        float thickG = pow(1.0 - abs(cG), 3.0) * 700.0;
        float thickB = pow(1.0 - abs(cB), 3.0) * 700.0;

        // --- CRYSTALLINE: Optical Properties & Lattice Angles ---
        float eps = 0.01;
        float dx = chladni(wp + vec2(eps, 0.0), modeM, modeN) - chladni(wp - vec2(eps, 0.0), modeM, modeN);
        float dy = chladni(wp + vec2(0.0, eps), modeM, modeN) - chladni(wp - vec2(0.0, eps), modeM, modeN);
        vec3 normal = normalize(vec3(dx, dy, 0.6));
        float cosTheta = dot(normal, vec3(0.0, 0.0, 1.0));

        vec3 col;
        col.r = thinFilm(thickR, cosTheta).r;
        col.g = thinFilm(thickG, cosTheta).g;
        col.b = thinFilm(thickB, cosTheta).b;

        // --- COLOR FIELDS: Cyberdelic Neon Highlights ---
        // Injecting Electric Magenta and Neon Cyan at peak nodal accumulations
        col = mix(col, vec3(1.0, 0.0, 0.8), smoothstep(0.8, 1.0, thickG / 700.0));
        col = mix(col, vec3(0.0, 1.0, 0.94), smoothstep(0.8, 1.0, thickB / 700.0));

        // --- PSYCHEDELIC COLLAGE: Print Artifacts ---
        // Xerox Electrostatic Grain & Platen Streaks
        float grain = fract(sin(dot(vUv * 1000.0 + u_time, vec2(127.1, 311.7))) * 43758.5453);
        float streak = snoise2(vec2(vUv.x * 45.0, u_time * 4.0));
        col -= grain * 0.18;
        col *= 1.0 - (smoothstep(0.7, 1.0, streak) * 0.35);

        // Offset Halftone Screen
        float angle = 0.785398; // 45 degrees
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 gridUV = rot * vUv * u_resolution.y * 0.22; // LPI frequency
        vec2 cell = fract(gridUV) - 0.5;
        float d = length(cell);
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float radius = sqrt(1.0 - luma) * 0.7;
        float ht = smoothstep(radius + 0.1, radius - 0.1, d);

        // Composite over Void Black
        vec3 voidBlack = vec3(0.015, 0.023, 0.031);
        vec3 finalCol = mix(voidBlack, col * 1.3, ht);

        // Radial Vignette
        float v = length(vUv - 0.5) * 2.0;
        finalCol *= 1.0 - smoothstep(0.5, 1.5, v);

        fragColor = vec4(finalCol, 1.0);
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
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
  
  // Smooth mouse interpolation into the shader
  if (!canvas.__three_mouse) canvas.__three_mouse = { x: 0.5, y: 0.5 };
  const targetX = mouse.isPressed ? mouse.x / grid.width : 0.5 + Math.sin(time * 0.5) * 0.2;
  const targetY = mouse.isPressed ? 1.0 - (mouse.y / grid.height) : 0.5 + Math.cos(time * 0.3) * 0.2;
  
  canvas.__three_mouse.x += (targetX - canvas.__three_mouse.x) * 0.05;
  canvas.__three_mouse.y += (targetY - canvas.__three_mouse.y) * 0.05;
  
  material.uniforms.u_mouse.value.set(canvas.__three_mouse.x, canvas.__three_mouse.y);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);