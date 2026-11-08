try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.autoClear = false;
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const rtOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false
    };
    const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
    const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const feedFragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform sampler2D u_feedback;

      mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float f = 0.0;
        float w = 0.5;
        for (int i = 0; i < 5; i++) {
          f += w * noise(p);
          p *= 2.0;
          p *= rot(0.4);
          w *= 0.5;
        }
        return f;
      }

      float sineGrating(vec2 p, float freq, float angle, float phase) {
        vec2 dir = vec2(cos(angle), sin(angle));
        float x = dot(p, dir);
        return 0.5 + 0.5 * sin(x * freq + phase);
      }

      void main() {
        vec2 uv = vUv;
        
        // Impossible Space / Reaction Diffusion Simulation via Domain Warp
        vec2 q = vec2(fbm(uv * 3.0 + u_time * 0.15), fbm(uv * 3.0 - u_time * 0.12));
        vec2 r = vec2(fbm(uv * 5.0 + q * 2.0 + u_time * 0.2), fbm(uv * 5.0 + q * 2.0 + vec2(1.7, 9.2)));
        float n = fbm(uv * 6.0 + r * 3.0);
        
        // Moiré Mid-Layer (Sinusoidal Liquid Interference)
        // Two slightly offset grids to create spatial beat frequencies
        float m1 = sineGrating(uv + r * 0.05, 120.0, 0.0, u_time * 1.5);
        float m2 = sineGrating(uv + q * 0.05, 122.0, 0.05, -u_time * 1.2);
        float moire = m1 * m2 * 2.5; 
        
        // Liquid contrast push (from the repo)
        moire = pow(abs(moire), 0.8);
        
        // The signal
        float signal = n * moire;
        
        // Phosphor Persistence (Temporal Feedback)
        // Zoom in slightly, drift upwards, and pinch towards center
        vec2 feedUv = uv - 0.5;
        feedUv *= 0.985; 
        feedUv += 0.5;
        feedUv.y += 0.003; 
        
        // Swirl distortion on feedback memory
        feedUv += vec2(sin(u_time * 0.5 + uv.y * 10.0), cos(u_time * 0.3 + uv.x * 10.0)) * 0.002;
        
        vec3 feed = texture(u_feedback, feedUv).rgb;
        
        // Mix: new signal + decayed memory
        float decay = 0.94; // long memory
        vec3 col = vec3(signal) * 0.25 + feed * decay;
        
        // Introduce artificial "burn-out" where signal gets too dense
        if (col.r > 1.5) col *= 0.8;
        
        fragColor = vec4(col, 1.0);
      }
    `;

    const outFragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform sampler2D u_buffer;

      float hash(float n) { return fract(sin(n) * 43758.5453); }

      void main() {
        vec2 uv = vUv;
        
        // VHS Tracking Tear (Mechanical Playback Instability)
        float tearFreq = u_time * 0.5;
        // Slow drifting tear band
        float tearBand = smoothstep(0.92, 1.0, sin(uv.y * 12.0 - u_time * 3.0 + hash(floor(u_time * 5.0)) * 2.0));
        // Occasional violent full-screen sync loss
        float syncLoss = step(0.98, fract(u_time * 0.3 + hash(u_time) * 0.1));
        tearBand = max(tearBand, syncLoss);
        
        // Jitter displacement
        float jitter = hash(uv.y * 150.0 + u_time) * 0.08 * tearBand;
        uv.x += jitter;
        
        // Head-switching noise at bottom
        if (uv.y < 0.06) {
          uv.x += (hash(uv.y * 500.0 + u_time) - 0.5) * 0.05;
        }

        // Chroma Luma Failure (RGB Bleed)
        // Analog video bandwidth limitation simulation
        float bleedAmt = 0.006 + 0.01 * tearBand;
        float r = texture(u_buffer, vec2(uv.x + bleedAmt, uv.y)).r;
        float g = texture(u_buffer, uv).g;
        float b = texture(u_buffer, vec2(uv.x - bleedAmt, uv.y)).b;
        
        vec3 rawCol = vec3(r, g, b);
        
        // Sickly Haunted Palette mapping
        float luma = dot(rawCol, vec3(0.299, 0.587, 0.114));
        
        vec3 deepCyan = vec3(0.01, 0.15, 0.25);
        vec3 sickGreen = vec3(0.2, 0.9, 0.5);
        vec3 whiteHot = vec3(0.95, 1.0, 0.9);
        vec3 darkVoid = vec3(0.02, 0.02, 0.03);
        
        vec3 col = mix(darkVoid, deepCyan, smoothstep(0.0, 0.2, luma));
        col = mix(col, sickGreen, smoothstep(0.2, 0.6, luma));
        col = mix(col, whiteHot, smoothstep(0.6, 1.0, luma));
        
        // Add raw chroma offset back in for analog ugliness
        col.r += (r - luma) * 0.5;
        col.b += (b - luma) * 0.5;

        // CRT Scanlines & Raster Structure
        float scanline = 0.5 + 0.5 * sin(uv.y * u_resolution.y * 1.5);
        // Soft-luminous edge structure
        col *= mix(0.6, 1.0, scanline);
        
        // Phosphor Bloom (bright areas swell and wash out)
        float bloom = smoothstep(0.7, 1.0, luma);
        col += sickGreen * bloom * 0.4;
        
        // Tape Snow / Analog Static
        float snow = hash(uv.x * 213.0 + uv.y * 311.0 + u_time * 10.0);
        col += vec3(snow) * 0.04;

        // Vignette
        float vig = length(vUv - 0.5);
        col *= smoothstep(0.8, 0.25, vig);

        fragColor = vec4(col, 1.0);
      }
    `;

    const matFeed = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_feedback: { value: null }
      },
      vertexShader,
      fragmentShader: feedFragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const matOut = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_buffer: { value: null }
      },
      vertexShader,
      fragmentShader: outFragmentShader,
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, matFeed);
    scene.add(mesh);

    canvas.__three = {
      renderer,
      scene,
      camera,
      mesh,
      matFeed,
      matOut,
      rtA,
      rtB,
      read: rtA,
      write: rtB,
      width: grid.width,
      height: grid.height
    };
  }

  const t = canvas.__three;

  // Handle resize gracefully
  if (t.width !== grid.width || t.height !== grid.height) {
    t.width = grid.width;
    t.height = grid.height;
    t.renderer.setSize(grid.width, grid.height, false);
    t.rtA.setSize(grid.width, grid.height);
    t.rtB.setSize(grid.width, grid.height);
    t.matFeed.uniforms.u_resolution.value.set(grid.width, grid.height);
    t.matOut.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  t.matFeed.uniforms.u_time.value = time;
  t.matOut.uniforms.u_time.value = time;

  // 1. Render Feedback Pass
  t.mesh.material = t.matFeed;
  t.matFeed.uniforms.u_feedback.value = t.read.texture;
  t.renderer.setRenderTarget(t.write);
  t.renderer.render(t.scene, t.camera);

  // 2. Render Output Pass (VHS + CRT Damage)
  t.mesh.material = t.matOut;
  t.matOut.uniforms.u_buffer.value = t.write.texture;
  t.renderer.setRenderTarget(null);
  t.renderer.render(t.scene, t.camera);

  // 3. Swap Ping-Pong Buffers
  const temp = t.read;
  t.read = t.write;
  t.write = temp;

} catch (e) {
  console.error("The Haunted Monitor crashed:", e);
}