if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;

        // Ashima 3D Simplex Noise
        vec4 permute(vec4 x){return mod(((x*34.0)+10.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );

          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;

          i = mod(i, 289.0 );
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

          float n_ = 1.0/7.0;
          vec3  ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            uv = uv * 2.0 - 1.0;
            uv.x *= u_resolution.x / u_resolution.y;

            // Three simultaneous time scales
            float t_slow = u_time * 0.05;  // Global geologic drift
            float t_med  = u_time * 0.3;   // Structural fluid motion
            float t_fast = u_time * 8.0;   // Fast detail shimmer / quantum jitter

            // Base coordinates
            vec3 p = vec3(uv * 2.5, t_slow);

            // Domain Warp (The structural tension)
            vec3 warp = vec3(
                snoise(p + vec3(12.3, 45.6, t_med)),
                snoise(p + vec3(78.9, 12.3, t_med)),
                0.0
            );
            p += warp * 1.5;

            // Ridged Multifractal (The physical substrate depth)
            float r = 0.0;
            float amp = 1.0;
            float freq = 1.0;
            for(int i = 0; i < 5; i++) {
                float n = snoise(p * freq + t_med * 0.4);
                n = 1.0 - abs(n); // Sharp ridges
                n *= n;
                r += n * amp;
                freq *= 2.1;
                amp *= 0.5;
            }

            // Print Misregistration / Chromatic Aberration
            // Corrupts the structural depth per color channel
            float shift = 0.1 * snoise(p * 3.0 + t_med);
            float val_c = r + shift;
            float val_m = r;
            float val_y = r - shift;

            // Lisa Frank Acidic Neon CMY Bands
            // Sharp, localized bands mimicking sticker ink or thin-film Bragg reflection
            float band_c = smoothstep(0.3, 0.35, fract(val_c * 3.0)) - smoothstep(0.65, 0.7, fract(val_c * 3.0));
            float band_m = smoothstep(0.3, 0.35, fract(val_m * 3.0 + 0.33)) - smoothstep(0.65, 0.7, fract(val_m * 3.0 + 0.33));
            float band_y = smoothstep(0.3, 0.35, fract(val_y * 3.0 + 0.66)) - smoothstep(0.65, 0.7, fract(val_y * 3.0 + 0.66));

            vec3 col = vec3(0.0);
            col += vec3(0.0, 1.0, 1.0) * band_c; // Neon Cyan
            col += vec3(1.0, 0.0, 1.0) * band_m; // Neon Magenta
            col += vec3(1.0, 1.0, 0.0) * band_y; // Neon Yellow

            // Additive overlap mixing
            col = clamp(col, 0.0, 1.0);

            // Void Black Isolation
            // Deepen valleys into pure nothingness
            float void_mask = smoothstep(0.45, 1.1, r);
            col *= void_mask;

            // Internal Structure: Textile Weave Tension
            // High-frequency interference pattern grounded in the warped geometry
            float weave_x = sin((uv.x + shift * 0.2) * 400.0);
            float weave_y = sin((uv.y - shift * 0.2) * 400.0);
            float textile = smoothstep(0.0, 1.0, abs(weave_x * weave_y));
            col *= (0.4 + 0.6 * textile);

            // Fast Detail Shimmer: Dead Pixels Behaving Like Pollen
            float grain = fract(sin(dot(gl_FragCoord.xy + t_fast, vec2(12.9898, 78.233))) * 43758.5453);
            float pollen = step(0.985, grain);
            
            // Shimmer iridescence
            vec3 shimmer_col = vec3(
                sin(t_fast + r * 15.0) * 0.5 + 0.5,
                cos(t_fast + r * 16.0) * 0.5 + 0.5,
                sin(t_fast + r * 17.0) * 0.5 + 0.5
            );
            
            col += shimmer_col * pollen * void_mask * 1.5;

            // Ambient Rim Glow (Fungal / Chemical bleed)
            float rim = smoothstep(0.2, 0.45, r) - smoothstep(0.45, 0.7, r);
            col += vec3(1.0, 0.0, 1.0) * rim * 0.3 * textile;

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