try {
  // 1. Defend and Initialize State
  if (!canvas.__keysAttached) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 's' || e.key === 'S') {
        const link = document.createElement('a');
        link.download = 'feral_mandelbrot_candy.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
      if (e.key === 'r' || e.key === 'R') {
        canvas.__seed = Math.random() * 100.0;
      }
      if (e.key === ' ') {
        canvas.__paused = !canvas.__paused;
      }
    });
    canvas.__keysAttached = true;
    canvas.__seed = Math.random() * 100.0;
    canvas.__paused = false;
    canvas.__timeOffset = 0;
    canvas.__lastTime = time;
  }

  // Time management for pause functionality
  let dt = time - canvas.__lastTime;
  canvas.__lastTime = time;
  if (!canvas.__paused) {
    canvas.__timeOffset += dt;
  }
  const activeTime = canvas.__timeOffset;

  // 2. THREE.js Setup (The "Double Wrong" Architecture)
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL context not available");
    
    // preserveDrawingBuffer required for canvas.toDataURL() screenshot functionality
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_seed: { value: canvas.__seed },
        u_distort: { value: 0.0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform float u_seed;
        uniform float u_distort;
        
        #define MAX_ITER 300
        #define BAILOUT 1024.0
        
        // Complex Math
        vec2 cmul(vec2 a, vec2 b) {
            return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
        }
        
        // Neon Acid / Y2K Gloss Palette (Autophagic Memory Splicing)
        vec3 palette(float t, float seed) {
            vec3 a = vec3(0.5, 0.5, 0.5);
            vec3 b = vec3(0.5, 0.5, 0.33); // Acidic yellow/green bias
            vec3 c = vec3(2.0, 1.0, 1.0) + sin(seed) * 0.5;
            vec3 d = vec3(0.5, 0.2, 0.25) + cos(seed) * 0.5;
            return a + b * cos(6.2831853 * (c * t + d));
        }

        // The Ocean Math - Fluid Distortion
        vec2 warp(vec2 p, float t, float amp) {
            float n = sin(p.x * 20.0 + t) * cos(p.y * 20.0 - t);
            return p + vec2(n, -n) * amp;
        }

        void main() {
            vec2 st = (vUv - 0.5) * 2.0;
            st.x *= u_resolution.x / u_resolution.y;

            // Target: Deep Misiurewicz point / Spiral Valley
            vec2 target = vec2(-0.74364388, 0.13182590);
            
            // Breathing Zoom (Avoids 32-bit float breakdown while feeling infinite)
            float z_time = u_time * 0.15;
            float zoom = pow(0.5, 2.5 + sin(z_time) * 2.0);
            
            // Mouse Interaction: Pan and Distort
            vec2 mouseOffset = (u_mouse - 0.5) * 2.0;
            target += mouseOffset * zoom * 1.5;
            
            vec2 c = st * zoom + target;
            
            // Feral Mechanism: Domain warping the complex plane before iteration
            float distortion_amp = 0.002 * zoom * (1.0 + u_distort * 20.0);
            c = warp(c, u_time * 2.0, distortion_amp);
            
            vec2 z = vec2(0.0);
            vec2 dz = vec2(1.0, 0.0);
            
            float trap_cross = 1e10; // The Tetragrammaton
            float trap_spiral = 1e10; // Orbital Friction
            
            float iter = 0.0;
            
            // Mandelbrot Iteration Engine
            for(int i = 0; i < MAX_ITER; i++) {
                // Distance Estimator derivative: dz = 2 * z * dz + 1
                dz = 2.0 * cmul(z, dz) + vec2(1.0, 0.0);
                
                // z = z^2 + c
                z = cmul(z, z) + c;
                
                // Track geometric traps
                trap_cross = min(trap_cross, min(abs(z.x), abs(z.y)));
                trap_spiral = min(trap_spiral, abs(length(z) - 1.0));
                
                if(dot(z, z) > BAILOUT) {
                    iter = float(i);
                    break;
                }
            }
            
            vec3 col = vec3(0.0);
            
            if(iter < float(MAX_ITER) - 1.0) {
                // --- ESCAPE ZONE (The Candy Prism) ---
                
                // Smooth iteration count
                float log_zn = log(dot(z, z)) * 0.5;
                float nu = log(log_zn / 0.693147) / 0.693147;
                float smooth_n = iter - nu;
                
                // Distance Estimation (DE)
                float de = sqrt(dot(z, z) / dot(dz, dz)) * log_zn;
                
                // Op-Art Moiré Contours
                float contour_freq = 150.0 + sin(u_time) * 50.0;
                float contour = sin((de / zoom) * contour_freq - u_time * 15.0);
                contour = smoothstep(0.0, 0.15, abs(contour)); // Crisp bands
                
                // Chromatic Cannibalism (Phase-shifted RGB sampling)
                float phase = smooth_n * 0.03 - u_time * 0.6;
                float glitch = sin(vUv.y * 80.0 + u_time * 10.0) * 0.06 * (1.0 - contour);
                
                col.r = palette(phase + glitch, u_seed).r;
                col.g = palette(phase + 0.01, u_seed).g;
                col.b = palette(phase - glitch + 0.03, u_seed).b;
                
                // Iridescent Edge Halos
                vec3 contour_col = palette(phase * 1.5, u_seed + 1.0);
                col = mix(col, contour_col * 1.8, 1.0 - contour);
                
                // Trap Glows
                float glow = exp(-trap_cross * 8.0) + exp(-trap_spiral * 3.0);
                col += vec3(0.1, 0.9, 0.8) * glow * 0.6;
                
            } else {
                // --- INTERIOR ZONE (The Void / The Ship) ---
                
                // Deep pulse based on orbital friction
                float pulse = sin(trap_spiral * 30.0 - u_time * 5.0);
                col = vec3(0.04, 0.0, 0.12) * (0.5 + 0.5 * pulse);
                
                // Tetragrammaton core manifestation
                float core = exp(-trap_cross * 20.0);
                col += vec3(1.0, 0.8, 0.2) * core * (0.6 + 0.4 * sin(u_time * 8.0));
            }
            
            // Post-Processing: CRT Shimmer & Glitch
            float scanline = sin(vUv.y * u_resolution.y * 1.5);
            col *= 0.92 + 0.08 * scanline;
            
            // Horizontal tearing (Machine Hesitation)
            if(fract(u_time * 1.7) > 0.96 && abs(vUv.y - fract(u_time * 11.0)) < 0.015) {
                col = vec3(1.0) - col; // Flash invert
                col.g += 0.5; // Toxic green push
            }
            
            // Optical Vignette
            float vignette = length(vUv - 0.5) * 1.2;
            col *= smoothstep(1.0, 0.3, vignette);
            
            // Tonemapping (Soft highlight compression)
            col = col / (1.0 + col * 0.2);
            
            fragColor = vec4(col, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;

  // 3. Update Uniforms Safely
  if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = activeTime;
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
    if (material.uniforms.u_mouse) {
      // Normalize mouse to 0-1
      material.uniforms.u_mouse.value.set(
        mouse.x / grid.width,
        1.0 - (mouse.y / grid.height) // Flip Y for WebGL
      );
    }
    if (material.uniforms.u_seed) {
      material.uniforms.u_seed.value = canvas.__seed;
    }
    if (material.uniforms.u_distort) {
      // Smoothly transition distortion based on mouse press
      const targetDistort = mouse.isPressed ? 1.0 : 0.0;
      material.uniforms.u_distort.value += (targetDistort - material.uniforms.u_distort.value) * 0.1;
    }
  }

  // 4. Render Frame
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (err) {
  console.error("Feral Mandelbrot Initialization Error:", err);
}