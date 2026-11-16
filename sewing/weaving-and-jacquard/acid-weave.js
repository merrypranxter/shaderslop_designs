try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, alpha: true, antialias: true });
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

      #define PI 3.14159265359

      // Complex math for Kleinian/Mobius folds
      vec2 cmul(vec2 a, vec2 b) {
          return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
      }
      vec2 cdiv(vec2 a, vec2 b) {
          float d = dot(b, b);
          return vec2(dot(a, b), a.y * b.x - a.x * b.y) / d;
      }
      vec2 cinv(vec2 z) {
          return vec2(z.x, -z.y) / dot(z, z);
      }

      // Hash and Noise for Batik Crackle and Ikat Bleed
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
          float f = 0.0;
          float w = 0.5;
          for(int i = 0; i < 5; i++) {
              f += w * noise(p);
              p *= 2.0;
              w *= 0.5;
          }
          return f;
      }

      // Neon Acid Palette (from color_fields/cosine_palette)
      vec3 neonAcid(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.33);
          vec3 c = vec3(2.0, 1.0, 1.0);
          vec3 d = vec3(0.5, 0.2, 0.25);
          return a + b * cos(6.28318 * (c * t + d));
      }

      // Kirlian Discharge Color
      vec3 kirlianGlow(float intensity) {
          vec3 col = vec3(0.0);
          col += vec3(0.8, 0.1, 1.0) * smoothstep(0.0, 0.5, intensity);
          col += vec3(0.2, 0.8, 1.0) * smoothstep(0.4, 0.8, intensity);
          col += vec3(1.0, 1.0, 1.0) * smoothstep(0.8, 1.0, intensity);
          return col;
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          uv.x *= u_resolution.x / u_resolution.y;
          
          vec2 z = uv;
          float t = u_time * 0.15;

          // 1. Kleinian Group / Mobius Warping (Accordion Fold / Shibori base)
          vec2 a = vec2(cos(t), sin(t));
          vec2 b = vec2(sin(t * 0.7), cos(t * 0.5));
          vec2 c = vec2(-sin(t * 0.5), cos(t * 0.8));
          vec2 d = vec2(cos(t * 1.1), -sin(t));

          float foldSymmetry = 0.0;
          for(int i = 0; i < 4; i++) {
              z = cdiv(cmul(a, z) + b, cmul(c, z) + d);
              z = abs(z) - vec2(0.3); // Shibori Itajime fold
              z *= 1.25;
              foldSymmetry += length(z);
          }

          // 2. Ikat Weave (Thread-level resist dye with blurred edges)
          // Add noise to coordinates to simulate thread shifting (Ikat blur)
          vec2 threadNoise = vec2(fbm(z * 15.0 + t), fbm(z * 15.0 - t + 100.0));
          vec2 ikatZ = z + threadNoise * 0.08;

          float threadScale = 120.0;
          vec2 grid = ikatZ * threadScale;
          
          float warp = sin(grid.x);
          float weft = sin(grid.y);
          
          // Fabric over/under structure
          float weaveMask = smoothstep(-0.2, 0.2, sin(grid.x * 0.5) * cos(grid.y * 0.5));
          float fabricTexture = mix(abs(warp), abs(weft), weaveMask);
          
          // 3. Batik Crackle & Kirlian Discharge Networks
          // Voronoi-like ridges using FBM
          float crackleNoise = fbm(z * 8.0 + t * 2.0);
          float crackle = smoothstep(0.04, 0.0, abs(crackleNoise - 0.5));
          
          // Branching dielectric breakdown (Kirlian streamers)
          float streamer = fbm(z * 20.0 - t * 4.0);
          streamer = smoothstep(0.85, 1.0, streamer) * crackle;

          // 4. Color Assembly (Reaction-Diffusion dye pooling)
          float dyePool = fbm(z * 3.0 + foldSymmetry * 0.2);
          float colorIdx = dyePool + fabricTexture * 0.15 - crackle * 0.2;
          
          vec3 baseColor = neonAcid(colorIdx + t);
          
          // Apply fabric shading (Ambient Occlusion in the weave)
          float ao = smoothstep(0.0, 1.0, fabricTexture + 0.2);
          baseColor *= ao;

          // Discharge Dyeing (Bleach/Negative space effect)
          float discharge = smoothstep(0.6, 0.9, fbm(uv * 5.0 + t));
          baseColor = mix(baseColor, vec3(0.05, 0.0, 0.1), discharge);

          // Add Kirlian glow and crackle veins
          baseColor += kirlianGlow(crackle * 0.6 + streamer * 2.0);
          
          // Vignette
          float vig = 1.0 - dot(uv, uv) * 0.2;
          baseColor *= smoothstep(0.0, 1.0, vig);

          fragColor = vec4(baseColor, 1.0);
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
    if (material.uniforms.u_time) {
      material.uniforms.u_time.value = time;
    }
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Psychedelic Mathematical Fabric Initialization Error:", e);
}