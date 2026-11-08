try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

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

    const fragmentShader = `
      out vec4 fragColor;
      in vec2 vUv;

      uniform float u_time;
      uniform vec2 u_resolution;

      mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      vec3 getPalette(float v) {
        vec3 c1 = vec3(1.0, 0.05, 0.5); // Hot Pink
        vec3 c2 = vec3(1.0, 0.3, 0.1);  // Electric Coral
        vec3 c3 = vec3(0.8, 1.0, 0.0);  // Acid Green / Neon Lemon
        vec3 c4 = vec3(0.0, 1.0, 0.8);  // Cyan / Turquoise
        vec3 c5 = vec3(0.4, 0.0, 1.0);  // Ultraviolet
        
        float t = fract(v);
        if(t < 0.2) return mix(c1, c2, t * 5.0);
        if(t < 0.4) return mix(c2, c3, (t - 0.2) * 5.0);
        if(t < 0.6) return mix(c3, c4, (t - 0.4) * 5.0);
        if(t < 0.8) return mix(c4, c5, (t - 0.6) * 5.0);
        return mix(c5, c1, (t - 0.8) * 5.0);
      }

      vec3 getPhi(vec2 p, float t) {
        vec2 q = p * rot(t * 0.15);
        float a = sin(q.x * 2.1 + t * 0.55);
        float b = cos(q.y * 2.7 - t * 0.31);
        float c = sin((q.x + q.y) * 3.2 + t * 0.22);
        return normalize(vec3(a + 0.3 * c, b - 0.25 * c, sin(q.x * q.y * 2.0 + t * 0.18)));
      }

      vec3 getDual(vec2 p, float t, vec3 phi) {
        vec2 q = p * rot(-t * 0.1);
        return normalize(vec3(-phi.y, phi.x, cos((q.x - q.y) * 2.4 - t * 0.27)));
      }

      float getTorsion(vec3 phi, vec3 dual) {
        return abs(dot(phi, dual));
      }

      float getMembrane(vec2 p, float t) {
        vec2 w = p;
        // Iterative domain warp (machine hesitation / fungal succession)
        for(int i = 0; i < 3; i++) {
          vec3 phi_w = getPhi(w, t + float(i) * 1.1);
          w += phi_w.xy * 0.12;
        }
        vec3 phi = getPhi(w, t);
        vec3 dual = getDual(w, t, phi);
        float torsion = getTorsion(phi, dual);
        
        float chamber = sin(length(w) * 8.0 - t * 1.2 + phi.z * 3.0) * cos(w.x * 5.0 + w.y * 4.0);
        return 0.5 + 0.5 * chamber + torsion * 0.4;
      }

      vec3 getNormal(vec2 p, float t) {
        vec2 e = vec2(0.005, 0.0);
        float d = getMembrane(p, t);
        float dx = getMembrane(p + e.xy, t) - d;
        float dy = getMembrane(p + e.yx, t) - d;
        
        // Photonic crystal edge micro-faceting
        float micro = (hash(p * 150.0 + t) - 0.5) * 0.04;
        return normalize(vec3(dx + micro, dy + micro, 0.015)); 
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
        
        float t = u_time * 0.4;
        
        // Metric Competition: Hyperbolic Poincare-ish fold
        float r2 = dot(uv, uv);
        vec2 p = uv / (1.0 + r2 * 0.15 * sin(t * 0.8));
        
        // Calculate fields
        vec3 phi = getPhi(p, t);
        vec3 dual = getDual(p, t, phi);
        float torsion = getTorsion(phi, dual);
        
        // Base structure
        float mem = getMembrane(p, t);
        vec3 N = getNormal(p, t);
        
        // Singularity mask (wounds & apertures)
        float fracture = 0.5 + 0.5 * sin(length(p) * 16.0 - torsion * 8.0 + phi.z * 5.0);
        float axisStress = abs(phi.x - dual.y);
        float sing = smoothstep(0.72, 0.98, fracture + axisStress * 0.4 + torsion * 0.6);
        
        // Acidic Base Color
        vec3 baseColor = getPalette(mem * 1.8 + t * 0.3 + phi.x * 0.6);
        
        // Lighting & Structural Shine (Shine is a structure, not a texture)
        vec3 L = normalize(vec3(sin(t * 1.3) * 0.6, 0.8, cos(t * 1.1) * 0.6));
        vec3 V = vec3(0.0, 0.0, 1.0);
        float diff = max(dot(N, L), 0.0);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        
        // Chromatic Aberration on Tension Peaks
        float tension = torsion + sing;
        vec3 H = normalize(L + V);
        float specR = pow(max(dot(reflect(-L, normalize(N + vec3(0.12 * tension, 0.0, 0.0))), V), 0.0), 48.0);
        float specG = pow(max(dot(reflect(-L, N), V), 0.0), 48.0);
        float specB = pow(max(dot(reflect(-L, normalize(N - vec3(0.12 * tension, 0.0, 0.0))), V), 0.0), 48.0);
        
        // Glossy veins only appear where tension/torsion is high
        vec3 shine = vec3(specR, specG, specB) * (1.0 + fresnel * 4.0);
        
        // Resolution (Healing Seams & Scar Glow)
        float halo = exp(-2.5 * length(p));
        vec3 scarGlow = vec3(1.0, 0.9, 0.95) * pow(sing, 1.5) * 2.5;
        vec3 coolBloom = vec3(0.0, 1.0, 0.8) * halo * (1.0 - sing) * 0.4 * torsion;
        
        // Compositing
        vec3 color = baseColor * (0.2 + 0.8 * diff);
        
        // Abyssal wound interior
        color = mix(color, vec3(0.04, 0.0, 0.1), sing * 0.85); 
        
        // Add structural shine and healing blooms
        color += shine * (0.2 + tension * 2.5); 
        color += scarGlow + coolBloom;
        
        // Projection drift (vignette and edge distortion)
        color *= 1.0 - 0.15 * r2;
        
        // Gamma correction for vibrant candy pop
        color = pow(color, vec3(1.0 / 1.2));
        
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
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}