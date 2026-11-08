let useWebGL = true;

if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
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

      // ─── ALCHEMICAL FOUNDATION ─────────────────────────────────────────────
      // Fast hash for structural noise
      vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
      }

      // Cellular noise for photonic crystal structures & tissue bounds
      float voronoi(vec2 x) {
          vec2 n = floor(x);
          vec2 f = fract(x);
          float m = 8.0;
          for(int j=-1; j<=1; j++) {
              for(int i=-1; i<=1; i++) {
                  vec2 g = vec2(float(i), float(j));
                  vec2 o = hash2(n + g);
                  vec2 r = g - f + o;
                  float d = dot(r, r);
                  m = min(m, d);
              }
          }
          return sqrt(m);
      }

      // ─── CANDY-ACID PALETTE ───────────────────────────────────────────────
      // Violently bright, saturated structural color
      vec3 acidCandy(float t) {
          float f = fract(t);
          vec3 c1 = vec3(1.0, 0.05, 0.5); // Hot Pink
          vec3 c2 = vec3(0.8, 1.0, 0.0);  // Neon Lemon / Acid Green
          vec3 c3 = vec3(0.0, 1.0, 0.9);  // Turquoise / Cyan
          vec3 c4 = vec3(0.5, 0.0, 1.0);  // Ultraviolet
          vec3 c5 = vec3(1.0, 0.4, 0.0);  // Electric Coral
          
          float step_val = f * 5.0;
          float i = floor(step_val);
          float fr = smoothstep(0.0, 1.0, fract(step_val));
          
          if(i == 0.0) return mix(c1, c2, fr);
          if(i == 1.0) return mix(c2, c3, fr);
          if(i == 2.0) return mix(c3, c4, fr);
          if(i == 3.0) return mix(c4, c5, fr);
          return mix(c5, c1, fr);
      }

      mat2 rot(float a) {
          float s = sin(a), c = cos(a);
          return mat2(c, -s, s, c);
      }

      // ─── G₂ SYMBOLIC GRAMMAR ──────────────────────────────────────────────

      // 1. PRIMARY ORIENTATION FIELD (φ)
      // The latent structural direction field, folded over itself.
      vec3 getPhi(vec2 p, float t) {
          vec2 wp = p;
          float z = 0.0;
          for(int i = 0; i < 3; i++) {
              wp += vec2(sin(wp.y * 2.0 + t), cos(wp.x * 2.0 - t * 0.8)) * 0.4;
              wp *= rot(0.5);
              wp *= 1.3;
              z += sin(wp.x * wp.y);
          }
          return normalize(vec3(
              sin(wp.x * 2.0 + t),
              cos(wp.y * 2.0 - t),
              sin(z * 1.5 + t)
          ));
      }

      // 2. DUAL RESPONSE FIELD
      // The shadow geometry, counter-rotating and misaligned.
      vec3 getDual(vec2 p, float t, vec3 phi) {
          return normalize(vec3(
              -phi.y,
              phi.x,
              cos((p.x - p.y) * 6.0 - t)
          ));
      }

      // 3. TORSION (STRAIN)
      // Misalignment between φ and dual, mapped onto a Voronoi cellular lattice.
      float getTorsion(vec3 phi, vec3 dual, vec2 p) {
          float baseStrain = pow(abs(dot(phi, dual)), 0.5);
          float cells = voronoi(p * 5.0 + phi.xy * 2.0);
          return mix(baseStrain, cells, 0.35); 
      }

      // 4. SINGULARITY WOUNDS
      // Concentrated cracks where the manifold fails to settle.
      float getSingularity(vec2 p, vec3 phi, vec3 dual, float tau, float t) {
          float radial = length(p);
          float fracture = sin(radial * 40.0 - tau * 20.0 + phi.z * 10.0 + t * 2.0);
          fracture = 0.5 + 0.5 * fracture;
          float stress = abs(phi.x - dual.y);
          float mask = smoothstep(0.75, 0.98, fracture + stress * 0.5 + tau * 0.6);
          return clamp(mask, 0.0, 1.0);
      }

      // ─── PROJECTION & HEALING SEAMS ───────────────────────────────────────
      vec3 evaluateColor(vec2 p, vec2 offset, float t) {
          vec2 pp = p + offset;
          vec3 phi = getPhi(pp, t);
          vec3 dual = getDual(pp, t, phi);
          float tau = getTorsion(phi, dual, pp);
          float sing = getSingularity(pp, phi, dual, tau, t);
          
          // Projection Flow (Chamber Drift)
          float chamber = 0.5 + 0.5 * sin(length(pp) * 20.0 - t + phi.z * 5.0);
          vec3 col = acidCandy(chamber + tau);
          
          // Resolution Seam (Healing Scar Glow)
          float seam = smoothstep(0.1, 1.0, sing) * (0.2 + 0.8 * tau);
          vec3 scarGlow = vec3(1.0, 0.9, 0.8) * seam * 3.0; // White-hot bloom
          
          // Structural Shine (Photonic crystal ridges)
          float ridge = smoothstep(0.5, 0.8, tau) * smoothstep(1.0, 0.8, sing);
          vec3 shine = vec3(1.0) * pow(ridge, 5.0) * 2.0;
          
          // Torsion Veins (Kintsugi gloss where math strains)
          float crack = smoothstep(0.95, 1.0, sin(tau * 50.0));
          vec3 vein = acidCandy(tau * 4.0 + t) * crack * 2.5;
          
          // Composite Layers
          vec3 finalCol = col * 0.5 + scarGlow + shine + vein;
          
          // Equilibrium Drift (Ambient ultraviolet/cyan backing)
          finalCol += vec3(0.0, 0.4, 0.8) * pow(1.0 - abs(phi.z), 5.0) * 0.4;
          
          return finalCol;
      }

      void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          p.x *= u_resolution.x / max(u_resolution.y, 1.0);
          
          float t = u_time * 0.25;
          
          // Evaluate tension map at center to drive chromatic aberration
          vec3 phi = getPhi(p, t);
          vec3 dual = getDual(p, t, phi);
          float tau = getTorsion(phi, dual, p);
          float sing = getSingularity(p, phi, dual, tau, t);
          
          // Chromatic Aberration Vector
          // ONLY exists where the mathematical tension (tau) and singularity (sing) peak
          vec2 aberration = phi.xy * pow(tau, 3.0) * 0.08 * (0.5 + 0.5 * sing);
          
          // RGB Split Projection
          vec3 colR = evaluateColor(p, aberration, t);
          vec3 colG = evaluateColor(p, vec2(0.0), t);
          vec3 colB = evaluateColor(p, -aberration, t);
          
          vec3 color = vec3(colR.r, colG.g, colB.b);
          
          // ACES Tone Mapping (Film-like curve to handle extreme blooms)
          color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
          
          // Gamma Correction
          color = pow(color, vec3(1.0 / 2.2));
          
          fragColor = vec4(color, 1.0);
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
    console.error("Feral WebGL Engine Overheated:", e);
    useWebGL = false;
    canvas.__three_failed = true;
  }
} else if (canvas.__three_failed) {
  useWebGL = false;
}

if (useWebGL) {
  const { renderer, scene, camera, material } = canvas.__three;
  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
} else {
  // Feral 2D fallback if WebGL completely rejects the ritual
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, grid.width, grid.height);
  ctx.globalCompositeOperation = 'screen';
  
  for (let i = 0; i < 150; i++) {
    const t = time * 0.5 + i * 0.05;
    const r = 100 + Math.sin(t * 3.1) * 80;
    const x = grid.width / 2 + Math.cos(t) * r * Math.sin(t * 0.5);
    const y = grid.height / 2 + Math.sin(t) * r * Math.cos(t * 0.7);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(t * 5.0) * 40, y + Math.cos(t * 4.0) * 40);
    
    // Acid Candy Palette via HSL
    const hue = (i * 12 + time * 60) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.8)`;
    ctx.lineWidth = 2 + Math.sin(t * 10) * 2;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}