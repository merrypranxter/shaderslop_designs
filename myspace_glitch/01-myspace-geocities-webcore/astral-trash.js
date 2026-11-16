if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 1024;
    const tctx = textCanvas.getContext('2d');
    
    tctx.fillStyle = '#000000';
    tctx.fillRect(0, 0, 1024, 1024);
    
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.font = '900 170px "Impact", "Arial Black", sans-serif';
    
    for (let i = 15; i >= 0; i--) {
      tctx.fillStyle = (i % 2 === 0) ? '#FFFFFF' : '#000000';
      const yOffset = i * 5;
      tctx.fillText("ASTRAL", 512, 380 + yOffset);
      tctx.fillText("TRASH", 512, 640 + yOffset);
    }

    const textTex = new THREE.CanvasTexture(textCanvas);
    textTex.minFilter = THREE.LinearFilter;
    textTex.magFilter = THREE.LinearFilter;
    textTex.wrapS = THREE.ClampToEdgeWrapping;
    textTex.wrapT = THREE.ClampToEdgeWrapping;

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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
      uniform sampler2D u_textTex;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
              mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
              mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y), 
          f.z
        );
      }

      float fbm(vec3 p) {
        float f = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 6; i++) {
          f += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vec2 uv = vUv;
        vec2 aspectUV = uv;
        aspectUV.x *= u_resolution.x / u_resolution.y;

        float t_slow = u_time * 0.05;
        float t_med = u_time * 0.2;
        float t_fast = u_time * 2.0;

        vec3 p = vec3(aspectUV * 4.0, t_slow);

        vec3 q = vec3(
          fbm(p + vec3(0.0, 0.0, t_med)),
          fbm(p + vec3(5.2, 1.3, -t_med)),
          0.0
        );

        vec3 r = vec3(
          fbm(p + 4.0 * q + vec3(1.7, 9.2, t_fast * 0.1)),
          fbm(p + 4.0 * q + vec3(8.3, 2.8, -t_fast * 0.1)),
          0.0
        );

        vec2 textUV = uv + (q.xy - 0.5) * 0.12;
        float textMask = texture(u_textTex, textUV).r;
        float textCrisp = texture(u_textTex, uv + (q.xy - 0.5) * 0.02).r;

        p *= (1.0 + textMask * 1.5);

        float s1 = fbm(p + r * 2.0);
        float s2 = fbm(p * 2.0 + r * 4.0);
        float s3 = fbm(p * 4.0 + r * 8.0);

        float t1 = abs(s1 - s2);
        float t2 = abs(s2 - s3);

        t1 = mix(t1, 1.0 - t1, textMask);
        t2 = mix(t2, abs(s1 - s3), textCrisp);

        float shimmer = sin(t_fast + fbm(p * 10.0) * 10.0) * 0.5 + 0.5;

        float cyan = smoothstep(0.12, 0.04, t1);
        float magenta = smoothstep(0.18, 0.08, t2);
        float yellow = smoothstep(0.05, 0.01, abs(t1 - t2)) * (0.5 + 0.5 * shimmer);

        float voidMask = smoothstep(0.35, 0.55, s1 + textMask * 0.4);

        vec3 col = vec3(0.0);
        col += vec3(0.0, 1.0, 1.0) * cyan;
        col += vec3(1.0, 0.0, 1.0) * magenta;
        col += vec3(1.0, 1.0, 0.0) * yellow;

        col *= voidMask;

        float textEdge = smoothstep(0.0, 0.1, textCrisp) - smoothstep(0.1, 0.3, textCrisp);
        col += vec3(0.0, 1.0, 1.0) * textEdge * (0.5 + 0.5 * sin(t_fast * 2.0));

        float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * (43758.5453 + u_time));
        col += vec3(1.0, 0.0, 1.0) * grain * 0.15 * voidMask;

        fragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_textTex: { value: textTex }
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
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);