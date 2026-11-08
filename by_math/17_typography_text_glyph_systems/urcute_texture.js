if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Create the "U R CUTE" text texture
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 1024;
    const tCtx = textCanvas.getContext('2d');
    
    tCtx.fillStyle = '#000000';
    tCtx.fillRect(0, 0, 1024, 1024);

    tCtx.shadowColor = '#FFFFFF';
    tCtx.shadowBlur = 25;
    tCtx.fillStyle = '#FFFFFF';
    tCtx.font = '900 200px "Comic Sans MS", "Arial Rounded MT Bold", "Helvetica Rounded", sans-serif';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    
    // Draw text
    tCtx.fillText('U R', 512, 380);
    tCtx.fillText('CUTE', 512, 620);

    // Draw cute ornaments
    tCtx.shadowBlur = 15;
    tCtx.font = '900 100px sans-serif';
    tCtx.fillText('✧', 200, 380);
    tCtx.fillText('♡', 824, 380);
    tCtx.fillText('♡', 200, 620);
    tCtx.fillText('✧', 824, 620);

    const textTex = new THREE.CanvasTexture(textCanvas);
    textTex.minFilter = THREE.LinearFilter;
    textTex.magFilter = THREE.LinearFilter;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_text: { value: textTex }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform sampler2D u_text;

        // Hash and Noise functions for organic/physical texture
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        vec2 hash2(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                    dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
                mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                    dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
                u.y
            );
        }

        float fbm(vec2 p) {
            float f = 0.0;
            float amp = 0.5;
            for(int i = 0; i < 5; i++) {
                f += amp * noise(p);
                p *= 2.0;
                amp *= 0.5;
            }
            return f;
        }

        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Origami Crease Pattern Generator
        float origami(vec2 p, float t) {
            float d = 0.0;
            p *= 1.5;
            float amp = 1.0;
            for(int i = 0; i < 5; i++) {
                p = abs(p) - 0.5;
                p *= rot(t * 0.15 + float(i) * 0.7853);
                d += abs(p.x + p.y) * amp;
                p *= 1.6;
                amp *= 0.6;
            }
            return d;
        }

        void main() {
            vec2 uv = vUv;
            vec2 st = (uv - 0.5) * 2.0;
            st.x *= u_resolution.x / u_resolution.y;
            
            // Three simultaneous time scales
            float t_slow = u_time * 0.1;
            float t_med  = u_time * 0.5;
            float t_fast = u_time * 2.0;
            
            // Domain warp: biological fluid cymatics twisting the origami paper
            vec2 warp = vec2(fbm(st * 3.0 + t_slow), fbm(st * 3.0 - t_slow + 10.0));
            vec2 warpedSt = st + warp * 0.4;
            
            // Generate structural creases
            float crease = origami(warpedSt, t_med);
            
            // Thin-film interference comb (Optical Path Difference)
            float interference = fbm(warpedSt * 5.0) + crease * 2.0;
            
            // Phase shifts for CMY Iridescence
            float phaseC = interference * 4.0 + t_med;
            float phaseM = interference * 4.5 + t_med * 1.2 + 2.0;
            float phaseY = interference * 5.0 + t_med * 1.4 + 4.0;
            
            // Interference peaks
            float cyanAmt = smoothstep(0.1, 0.9, sin(phaseC));
            float magAmt  = smoothstep(0.1, 0.9, sin(phaseM));
            float yelAmt  = smoothstep(0.1, 0.9, sin(phaseY));
            
            // Material Base (Void Black + Neon Iridescence)
            vec3 col = vec3(0.0);
            col += vec3(0.0, 1.0, 1.0) * cyanAmt; // Cyan
            col += vec3(1.0, 0.0, 1.0) * magAmt;  // Magenta
            col += vec3(1.0, 1.0, 0.0) * yelAmt;  // Yellow
            
            // Masking and depth carving
            float mask = smoothstep(0.1, 0.8, fbm(warpedSt * 2.0 - t_slow));
            col *= mask;
            
            // Physical Crease Shadows
            float edge = fract(crease * 4.0);
            float shadow = smoothstep(0.0, 0.2, edge) * smoothstep(1.0, 0.8, edge);
            col *= shadow;
            
            // Fast detail shimmer (Dielectric flash)
            float shimmer = pow(abs(sin(crease * 30.0 - t_fast * 2.0)), 8.0);
            col += vec3(0.8, 1.0, 1.0) * shimmer * 0.4 * mask;
            
            // Kinetic Type Storm: Text Integration
            vec2 textUv = uv - 0.5;
            textUv.x *= u_resolution.x / u_resolution.y;
            textUv *= 1.1; // Scale text
            textUv += 0.5;
            
            // Bouncy Joy distortion + Fluid Melt
            float bounce = sin(t_fast * 2.0) * 0.015;
            textUv.y += bounce * sin(textUv.x * 10.0);
            textUv.x += fbm(textUv * 10.0 + t_fast) * 0.01;
            
            // Chromatic aberration sampling
            float txtR = texture(u_text, textUv + vec2(0.008, 0.0)).r;
            float txtG = texture(u_text, textUv).r;
            float txtB = texture(u_text, textUv - vec2(0.008, 0.0)).r;
            
            float textMask = max(txtR, max(txtG, txtB));
            
            // Cute Neon Glow mapping
            vec3 neonText = vec3(0.0);
            neonText += vec3(1.0, 0.2, 0.8) * txtR; // Hot pink
            neonText += vec3(0.0, 1.0, 0.9) * txtG; // Cyan
            neonText += vec3(1.0, 0.9, 0.1) * txtB; // Yellow
            
            // Overlay text transparently so structural math shows through the letters
            col = mix(col, neonText + col * 0.4, textMask * 0.9);
            
            // Physical grain (noise evaluated at high frequency)
            float grain = hash(uv + t_fast) * 0.12;
            col += grain;
            
            fragColor = vec4(col, 1.0);
        }
      `
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

if (material && material.uniforms && material.uniforms.u_time) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);