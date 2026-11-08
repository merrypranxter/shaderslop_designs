try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance"
    });
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1;

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

      // Generates a continuous sinusoidal wave grating
      float sineGrating(vec2 p, float freq, float angle, float phase) {
          vec2 dir = vec2(cos(angle), sin(angle));
          float x = dot(p, dir);
          return 0.5 + 0.5 * sin(x * freq + phase);
      }

      void main() {
          vec2 uv = vUv;
          vec2 st = uv * 2.0 - 1.0;
          st.x *= u_resolution.x / u_resolution.y;

          // Heartbeat mechanism: double pump (lub-dub)
          float t = u_time * 1.1; 
          float beat = exp(-fract(t) * 8.0) + exp(-fract(t - 0.2) * 8.0);
          
          // Spatial warping based on heartbeat to make the moiré "breathe" and roll
          float r = length(st);
          float theta = atan(st.y, st.x);
          vec2 warpedSt = st + vec2(cos(theta + u_time), sin(theta - u_time)) * r * (0.1 + beat * 0.05);

          // Chromatic Wave Moiré (Rainbow Interference Engine)
          // We use multiplicative blending of sine waves to create the classic liquid moiré
          float baseFreq = 30.0 - beat * 2.0; 
          
          float mR = sineGrating(warpedSt, baseFreq, u_time * 0.1, u_time * 2.0) * 
                     sineGrating(warpedSt, baseFreq * 1.05, -u_time * 0.15, -u_time * 1.5);
                     
          float mG = sineGrating(warpedSt, baseFreq * 1.02, u_time * 0.12, u_time * 2.2) * 
                     sineGrating(warpedSt, baseFreq * 1.07, -u_time * 0.13, -u_time * 1.7);
                     
          float mB = sineGrating(warpedSt, baseFreq * 1.04, u_time * 0.14, u_time * 2.4) * 
                     sineGrating(warpedSt, baseFreq * 1.09, -u_time * 0.11, -u_time * 1.9);

          // Push contrast aggressively to extract the difference frequency (the moiré)
          vec3 signal = vec3(
              smoothstep(0.15, 0.4, mR),
              smoothstep(0.15, 0.4, mG),
              smoothstep(0.15, 0.4, mB)
          );

          // LED Subpixel Grid Structure
          // Triad width in pixels (approximate based on resolution)
          float triadWidth = 6.0; 
          float density = u_resolution.x / triadWidth;
          float spx = fract(uv.x * density);
          
          vec3 subpixelMask = vec3(
              step(0.0, spx) * step(spx, 0.333),
              step(0.333, spx) * step(spx, 0.666),
              step(0.666, spx) * step(spx, 1.0)
          );

          // Horizontal row gaps for authentic matrix look
          float spy = fract(uv.y * (u_resolution.y / triadWidth));
          subpixelMask *= step(0.2, spy); 

          // Palette Mapping: Fully saturated custom RGB triads
          vec3 hotPink = vec3(1.0, 0.0, 0.6);
          vec3 acidLime = vec3(0.5, 1.0, 0.0);
          vec3 electricCobalt = vec3(0.0, 0.2, 1.0);

          vec3 image = vec3(0.0);
          image += hotPink * signal.r * subpixelMask.r;
          image += acidLime * signal.g * subpixelMask.g;
          image += electricCobalt * signal.b * subpixelMask.b;

          // Phosphor Bloom & Overdrive
          // Simulating light escaping the subpixel mask boundaries
          vec3 bloomBase = vec3(mR, mG, mB);
          bloomBase = pow(bloomBase, vec3(2.0)); // Isolate the hottest spots
          vec3 bloom = hotPink * bloomBase.r + acidLime * bloomBase.g + electricCobalt * bloomBase.b;
          
          // Bloom intensifies violently on the heartbeat
          image += bloom * (0.8 + beat * 1.5);

          // Deep Violet Scan Banding
          // A slow, thick, rolling disruption of the signal
          vec3 deepViolet = vec3(0.4, 0.0, 0.8);
          float bandPhase = uv.y * 12.0 - u_time * 1.5;
          float band = sin(bandPhase) * 0.5 + 0.5;
          band = smoothstep(0.7, 1.0, band); // Sharpen into a distinct bar
          
          // The band overwrites the image with saturated violet energy
          image = mix(image, deepViolet * (1.0 + bloomBase.r * 2.0), band * 0.85);

          // Sub-surface interference (CRT raster noise)
          float raster = fract(sin(dot(uv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
          image += image * raster * 0.15;

          // Edge vignette to ground the screen
          float vig = length(st);
          image *= 1.0 - smoothstep(0.8, 1.5, vig);

          // Final output, clamped to prevent blowout inversion
          fragColor = vec4(min(image, vec3(1.5)), 1.0);
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
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Feral WebGL Error:", e);
}