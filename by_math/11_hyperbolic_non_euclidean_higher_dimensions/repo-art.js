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
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;

      #define PI 3.14159265359

      vec2 hash22(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return fract(sin(p) * 43758.5453);
      }

      float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
              mix(fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453),
                  fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453), u.x),
              mix(fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453),
                  fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), u.x),
              u.y
          );
      }

      float fbm(vec2 p) {
          float f = 0.0, a = 0.5;
          for(int i = 0; i < 5; i++) { 
              f += a * noise(p); 
              p *= 2.0; 
              a *= 0.5; 
          }
          return f;
      }

      vec2 warp(vec2 p, float t) {
          float n1 = fbm(p + t * 0.2);
          float n2 = fbm(p + vec2(5.2, 1.3) - t * 0.15);
          return p + vec2(n1, n2) * 1.2;
      }

      vec2 foldP6m(vec2 p) {
          const float sqrt3 = 1.73205080757;
          p = abs(p);
          if (p.y > p.x * sqrt3) p = vec2(p.x * sqrt3 + p.y, p.x - p.y * sqrt3) / 2.0;
          p = abs(p);
          if (p.y > p.x * sqrt3) p = vec2(p.x * sqrt3 + p.y, p.x - p.y * sqrt3) / 2.0;
          return abs(p);
      }

      vec2 poincare(vec2 z, vec2 a, float theta) {
          z *= 0.99; 
          vec2 num = z - a;
          vec2 conjA_z = vec2(a.x * z.x + a.y * z.y, a.x * z.y - a.y * z.x);
          vec2 den = vec2(1.0, 0.0) - conjA_z;
          float denom = dot(den, den);
          vec2 res = vec2(dot(num, den), num.y * den.x - num.x * den.y) / (denom + 1e-6);
          float c = cos(theta), s = sin(theta);
          return vec2(c * res.x - s * res.y, s * res.x + c * res.y);
      }

      float worleyF2F1(vec2 p) {
          vec2 n = floor(p);
          vec2 f = fract(p);
          float d1 = 8.0, d2 = 8.0;
          for(int j = -1; j <= 1; j++) {
              for(int i = -1; i <= 1; i++) {
                  vec2 g = vec2(float(i), float(j));
                  vec2 o = hash22(n + g);
                  o = 0.5 + 0.5 * sin(u_time * 0.8 + 6.2831 * o); 
                  vec2 r = g + o - f;
                  float d = dot(r, r);
                  if(d < d1) { d2 = d1; d1 = d; }
                  else if(d < d2) { d2 = d; }
              }
          }
          return sqrt(d2) - sqrt(d1);
      }

      vec3 cosinePalette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.33);
          vec3 c = vec3(2.0, 1.0, 1.0);
          vec3 d = vec3(0.5, 0.2, 0.25);
          return a + b * cos(6.2831853 * (c * t + d));
      }

      float halftone(vec2 fragCoord, float freq, float angle, float luma) {
          float rad = radians(angle);
          mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
          vec2 uv = rot * fragCoord * freq / 1024.0;
          vec2 cell = fract(uv) - 0.5;
          float dist = length(cell);
          float dotRadius = sqrt(clamp(1.0 - luma, 0.0, 1.0)) * 0.5;
          return smoothstep(dotRadius + 0.08, dotRadius - 0.08, dist);
      }

      float getPattern(vec2 uv) {
          vec2 a = 0.6 * vec2(cos(u_time * 0.3), sin(u_time * 0.17));
          vec2 z = poincare(uv, a, u_time * 0.1);
          z = foldP6m(z * 1.8);
          vec2 w = warp(z, u_time);
          float wVal = worleyF2F1(w * 4.0);
          return pow(1.0 - wVal, 2.2); 
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
          uv *= 2.0; 

          vec2 dir = normalize(uv) * 0.015 * length(uv);
          
          float pR = getPattern(uv + dir);
          float pG = getPattern(uv);
          float pB = getPattern(uv - dir);

          vec3 colR = cosinePalette(pR - u_time * 0.2);
          vec3 colG = cosinePalette(pG - u_time * 0.2 + 0.1);
          vec3 colB = cosinePalette(pB - u_time * 0.2 + 0.2);

          vec3 col = vec3(colR.r, colG.g, colB.b);

          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          float ht = halftone(gl_FragCoord.xy, 110.0, 45.0, luma);
          
          float xerox = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
          
          col = mix(col * ht, vec3(1.0), xerox * 0.08);

          float disk = smoothstep(1.02, 0.98, length(uv / 2.0));
          vec3 voidColor = vec3(0.04, 0.00, 0.08); 
          
          float vignette = 1.0 - smoothstep(0.5, 1.5, length(uv / 2.0));
          col *= vignette;

          fragColor = vec4(mix(voidColor, col, disk), 1.0);
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