if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    
    // Orthographic camera for full-screen shader pass
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_pressed: { value: 0 }
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
        uniform vec2 u_mouse;
        uniform float u_pressed;

        #define PI 3.14159265359
        // 5-fold symmetry for Penrose/Aperiodic Quasicrystal
        #define N_WAVES 5.0 

        // Lisa Frank / Maximalist Chromatics (Repo 3)
        vec3 hsb2rgb(in vec3 c) {
            vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            return c.z * mix(vec3(1.0), rgb, c.y);
        }

        // Feral Noise
        float hash21(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // Domain Warping via Clifford Attractor (Repo 4)
        vec2 strangeWarp(vec2 p, float t) {
            // Parameters drifting over time to mutate the attractor
            float a = 1.5 + sin(t * 0.3) * 0.3;
            float b = -1.2 + cos(t * 0.4) * 0.3;
            float c = 1.0 + sin(t * 0.5) * 0.3;
            float d = 0.8 + cos(t * 0.2) * 0.3;

            return vec2(
                sin(a * p.y) + c * cos(a * p.x),
                sin(b * p.x) + d * cos(b * p.y)
            );
        }

        // Continuous Aperiodic Field
        float quasicrystal(vec2 p) {
            float v = 0.0;
            for(float i = 0.0; i < N_WAVES; i++) {
                float angle = i * PI / N_WAVES;
                vec2 dir = vec2(cos(angle), sin(angle));
                v += cos(dot(p, dir));
            }
            return v;
        }

        void main() {
            // Normalized pixel coordinates (from -1 to 1, aspect corrected)
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
            vec2 m = u_mouse;
            
            float t = u_time * 0.25;

            // DIVINE DATA CORRUPTION / Glitch Layer (Repo 2)
            if (u_pressed > 0.5) {
                // Blocky datamosh tearing
                float glitchLine = step(0.92, hash21(vec2(floor(uv.y * 20.0), floor(u_time * 15.0))));
                uv.x += glitchLine * 0.15 * sin(u_time * 50.0);
                uv.y -= glitchLine * 0.05 * cos(u_time * 40.0);
                // Micro-stutter
                uv *= 1.0 + 0.02 * sin(u_time * 100.0); 
            }

            // --- STRANGE MECHANISM: Attractor-Warped Quasicrystal ---
            
            vec2 warp = uv * 6.0; // Initial zoom
            warp -= m * 3.0;      // Interactive parallax

            // Iterative space folding (Clifford logic)
            warp = strangeWarp(warp, t);
            warp = strangeWarp(warp * 1.2, t * 1.1);
            
            // Scale up for the tessellation pattern
            warp *= 12.0;

            // Evaluate Aperiodic Field
            float q = quasicrystal(warp);

            // Discretize into topological bands (Tessellation)
            float bands = 5.0;
            float q_discrete = floor(q * bands);
            float q_fract = fract(q * bands);

            // Kiyo Style (Repo 1): Stark, comic-like black vector outlines
            // Modulating thickness slightly for an organic 'ink' feel
            float edgeThick = 0.1 + 0.05 * sin(warp.x * 2.0 + warp.y * 3.0);
            float edge = smoothstep(0.0, edgeThick, q_fract) * smoothstep(1.0, 1.0 - edgeThick, q_fract);

            // --- PSYCHEDELIC COLLAGE TEXTURING ---
            
            vec3 finalColor = vec3(0.0);
            
            // Unique ID for each topological "cell"
            float cell_id = q_discrete + floor(warp.x * 0.2) + floor(warp.y * 0.2);
            float randChoice = hash21(vec2(cell_id, 1.0));

            // Base Lisa Frank Neon Hue
            float hue = fract(q_discrete * 0.18 + t + length(uv) * 0.3);
            
            // Collage Router: 4 distinct visual regimes
            if (randChoice < 0.3) {
                // Texture 1: Hyper-Neon Flat (Lisa Frank pure)
                finalColor = hsb2rgb(vec3(hue, 1.0, 1.0));
            } 
            else if (randChoice < 0.6) {
                // Texture 2: Psychedelic Leopard Print
                vec2 luv = warp * 2.0;
                float spot = smoothstep(0.5, 0.65, hash21(floor(luv)));
                float spotRing = smoothstep(0.35, 0.5, hash21(floor(luv))) - spot;
                
                vec3 baseCol = hsb2rgb(vec3(fract(hue + 0.4), 0.8, 1.0));
                vec3 spotCol = vec3(1.0, 0.0, 0.8); // Hot Magenta
                
                finalColor = mix(baseCol, spotCol, spot);
                finalColor *= (1.0 - spotRing * 1.2); // Heavy black rings
            } 
            else if (randChoice < 0.85) {
                // Texture 3: Kiyo Halftone / Op-Art Stripes
                float stripe = step(0.5, sin(warp.x * 15.0 - warp.y * 15.0));
                finalColor = mix(vec3(0.05), hsb2rgb(vec3(hue, 1.0, 1.0)), stripe);
            }
            else {
                // Texture 4: Orbit Trap Shimmer / Escape-Time Glow (THE-LISTS)
                float shimmer = pow(sin(q * 25.0 - u_time * 8.0) * 0.5 + 0.5, 3.0);
                finalColor = vec3(shimmer) * hsb2rgb(vec3(fract(hue - 0.2), 0.6, 1.0));
            }

            // Apply the Kiyo ink outlines
            finalColor *= edge;

            // --- INTERACTIVE CHROMATIC ABERRATION ---
            if (u_pressed > 0.5) {
                float shift = 0.08 * hash21(vec2(u_time));
                
                // Offset the edge detection to create RGB phase bleed
                float edgeR = smoothstep(0.0, edgeThick, fract((q + shift) * bands));
                float edgeB = smoothstep(0.0, edgeThick, fract((q - shift) * bands));
                
                finalColor.r = max(finalColor.r, hsb2rgb(vec3(hue, 1.0, 1.0)).r * edgeR);
                finalColor.b = max(finalColor.b, hsb2rgb(vec3(hue, 1.0, 1.0)).b * edgeB);
                
                // 404 Reliquary / Invert random collage blocks
                if (hash21(vec2(floor(uv.x * 8.0), floor(uv.y * 8.0))) > 0.85) {
                    finalColor = vec3(1.0) - finalColor;
                }
            }

            // Atmospheric Vignette
            finalColor *= 1.1 - 0.4 * dot(uv, uv);

            fragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, material);
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
  
  // Normalize mouse to -1.0 to 1.0 for the shader
  const mx = (mouse.x / grid.width) * 2.0 - 1.0;
  const my = -(mouse.y / grid.height) * 2.0 + 1.0;
  material.uniforms.u_mouse.value.set(mx, my);
  
  material.uniforms.u_pressed.value = mouse.isPressed ? 1.0 : 0.0;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);