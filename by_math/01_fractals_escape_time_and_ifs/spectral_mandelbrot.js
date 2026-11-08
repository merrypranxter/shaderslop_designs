try {
  if (!ctx) throw new Error("WebGL2 context not available");

  // State management for smooth panning and zooming
  if (!canvas.__mandelbrotState) {
    canvas.__mandelbrotState = {
      pan: new THREE.Vector2(-0.6, 0.0),
      zoom: 2.6,
      targetPan: new THREE.Vector2(-0.6, 0.0),
      targetZoom: 2.6,
      clock: new THREE.Clock()
    };
  }

  const state = canvas.__mandelbrotState;

  if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
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
      precision highp float;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_pan;
      uniform float u_zoom;

      in vec2 vUv;
      out vec4 fragColor;

      #define MAX_ITER 500
      #define BAILOUT 256.0

      // Complex multiplication
      vec2 cmul(vec2 a, vec2 b) {
          return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
      }

      // Acid Neon Palette (Psychedelic Collage / Resist Dye)
      vec3 getAcidColor(float t) {
          t = fract(t);
          vec3 c1 = vec3(1.0, 0.0, 0.78); // Hot Pink
          vec3 c2 = vec3(0.36, 0.0, 1.0); // Violet
          vec3 c3 = vec3(0.0, 1.0, 0.93); // Electric Cyan
          vec3 c4 = vec3(0.66, 1.0, 0.0); // Acid Green
          vec3 c5 = vec3(1.0, 0.9, 0.0);  // Neon Yellow
          
          float p = t * 5.0;
          int i = int(floor(p));
          float f = smoothstep(0.0, 1.0, fract(p)); 
          
          if (i == 0) return mix(c1, c2, f);
          if (i == 1) return mix(c2, c3, f);
          if (i == 2) return mix(c3, c4, f);
          if (i == 3) return mix(c4, c5, f);
          return mix(c5, c1, f);
      }

      void main() {
          // Normalize coordinates
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
          vec2 c = uv * u_zoom + u_pan;
          
          // Cardioid and Period-2 bulb optimization
          float c2 = c.x*c.x + c.y*c.y;
          float q = (c.x - 0.25)*(c.x - 0.25) + c.y*c.y;
          bool isInterior = false;
          if (q * (q + (c.x - 0.25)) < 0.25 * c.y*c.y || (c.x + 1.0)*(c.x + 1.0) + c.y*c.y < 0.0625) {
              isInterior = true;
          }
          
          float iter = 0.0;
          float smooth_n = 0.0;
          float de = 0.0;
          float wander = 0.0;
          float trap = 1e20;
          
          if (!isInterior) {
              vec2 z = vec2(0.0);
              vec2 dz = vec2(1.0, 0.0);
              float r2 = 0.0;
              
              for(int i = 0; i < MAX_ITER; i++) {
                  // Distance estimator derivative: dz = 2 * z * dz + 1
                  dz = 2.0 * cmul(z, dz) + vec2(1.0, 0.0);
                  
                  // Main Mandelbrot iteration: z = z^2 + c
                  vec2 z_new = cmul(z, z) + c;
                  
                  // Biological wander metric (Pickover Biomorphs)
                  wander += length(z_new - z);
                  z = z_new;
                  r2 = dot(z, z);
                  
                  // Orbit trap (distance to axes)
                  trap = min(trap, min(abs(z.x), abs(z.y)));
                  
                  if(r2 > BAILOUT) {
                      iter = float(i);
                      break;
                  }
              }
              
              if (iter < float(MAX_ITER) - 0.5) {
                  // Smooth escape time
                  float log_zn = log(r2) * 0.5;
                  float nu = log(log_zn / 0.6931471806) / 0.6931471806;
                  smooth_n = iter + 1.0 - nu;
                  
                  // Distance estimator (DE)
                  de = 0.5 * log(r2) * sqrt(r2) / length(dz);
              } else {
                  isInterior = true;
              }
          }
          
          vec3 finalColor = vec3(0.0);
          
          if (isInterior) {
              // Deep darkfield microscopy background with subtle biological wander glow
              finalColor = vec3(0.02, 0.0, 0.05) * wander * 0.003;
          } else {
              // Scale color bands to stay visible regardless of zoom level
              float scale = 0.05 * pow(u_zoom, 0.1); 
              float t = smooth_n * scale - u_time * 0.15;
              
              // Normalize DE relative to zoom to keep optical effects consistent
              float normDE = de / u_zoom;
              
              // --- GLITCH / CMYK MISREGISTRATION ---
              // RGB channel shear applied exclusively to high-iteration boundary filaments
              float shear = exp(-normDE * 400.0) * 1.5; 
              
              vec3 acidR = getAcidColor(t + shear);
              vec3 acidG = getAcidColor(t);
              vec3 acidB = getAcidColor(t - shear);
              vec3 col = vec3(acidR.r, acidG.g, acidB.b);
              
              // --- THIN-FILM IRIDESCENCE ---
              // Newton rings amplitude modulation
              float fringes = 0.6 + 0.4 * cos(smooth_n * 1.5 + wander * 0.2);
              col *= fringes;
              
              // --- TEXTILE WEAVE TENSION ---
              // Mathematical cloth construction on the iteration bands
              float weave = 0.5 + 0.5 * sin(smooth_n * 40.0) * sin(wander * 15.0);
              col *= mix(0.85, 1.15, weave);
              
              // --- MICROSCOPY PHASE CONTRAST ---
              // Intense white/cyan halo right at the event horizon boundary
              float halo = exp(-normDE * 700.0);
              col += vec3(0.8, 1.0, 1.0) * halo * 1.8;
              
              // --- ORBIT TRAP FILAMENTS ---
              // Glowing neon threads crossing the exterior void
              float filament = exp(-trap * 8.0) * smoothstep(0.0, 30.0, smooth_n);
              col += vec3(1.0, 0.0, 0.78) * filament * 0.6;
              
              finalColor = col;
          }
          
          // --- DIGITAL DECAY / GLITCH TEXTILES ---
          // Occasional blocky compression scars floating in the exterior field
          vec2 grid = floor((gl_FragCoord.xy / u_resolution.y) * vec2(8.0, 40.0));
          float glitchHash = fract(sin(dot(grid, vec2(12.9898, 78.233)) + floor(u_time * 5.0)) * 43758.5453);
          if (!isInterior && glitchHash > 0.985) {
              finalColor = vec3(1.0) - finalColor; // Color inversion XOR ghosting
          }
          
          // --- PRINT ARTIFACTS ---
          // Film grain over the entire composition
          float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
          finalColor *= mix(0.85, 1.0, grain);
          
          // Vignette framing
          vec2 normUv = gl_FragCoord.xy / u_resolution.xy - 0.5;
          float vig = length(normUv);
          finalColor *= 1.0 - smoothstep(0.4, 0.8, vig);
          
          fragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_pan: { value: state.pan },
        u_zoom: { value: state.zoom }
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
  const dt = state.clock.getDelta();

  // Interaction logic: Zoom towards Seahorse Valley when pressed, return to poster mode when released.
  if (mouse.isPressed) {
    state.targetPan.set(-0.74364388, 0.1318259);
    state.targetZoom = 0.008;
  } else {
    // Classic Poster Mode Silhouette, slowly breathing
    state.targetPan.set(-0.6, 0.0);
    state.targetZoom = 2.6 + Math.sin(time * 0.5) * 0.1;
  }

  // Smooth exponential dampening for pan and zoom
  state.pan.lerp(state.targetPan, 4.0 * dt);
  state.zoom += (state.targetZoom - state.zoom) * (3.5 * dt);

  // Update uniforms safely
  if (material?.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (material.uniforms.u_pan) material.uniforms.u_pan.value.copy(state.pan);
    if (material.uniforms.u_zoom) material.uniforms.u_zoom.value = state.zoom;
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("Mandelbrot WebGL Initialization Failed:", e);
}