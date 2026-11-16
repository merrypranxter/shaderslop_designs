if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: true
    });
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      
      in vec2 vUv;
      out vec4 fragColor;

      #define MAX_FOLDS 18
      const float PI = 3.14159265359;
      const float PI_7 = PI / 7.0;
      
      // {7,3} Hyperbolic Tiling Constants (Poincare Disk)
      const vec2 inv_center = vec2(1.152382435, 0.0);
      const float inv_radius2 = 0.32798535;

      // Subtle CRT Barrel Distortion
      vec2 warpCRT(vec2 uv) {
          vec2 delta = uv - 0.5;
          float r2 = dot(delta, delta);
          return uv + delta * r2 * 0.12; 
      }

      void main() {
          vec2 crtUV = warpCRT(vUv);
          
          // Map to Poincare disk space
          vec2 p = (crtUV - 0.5) * 2.2;
          p.x *= u_resolution.x / u_resolution.y;
          
          float r_orig = length(p);
          float r2 = dot(crtUV - 0.5, crtUV - 0.5);
          
          // Deep blue base for the monitor background
          vec3 color = vec3(0.01, 0.02, 0.08); 
          
          float edgeLine = 0.0;
          float bloom = 0.0;
          
          if (r_orig < 1.0) {
              // Slow mathematical rotation
              float t = u_time * 0.08;
              float c = cos(t), s = sin(t);
              p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
              
              // Iterative Möbius folding for {7,3} Coxeter group
              for(int i = 0; i < MAX_FOLDS; i++) {
                  // Fold across symmetry lines of the heptagon
                  float a = atan(p.y, p.x);
                  a = mod(a + PI_7, 2.0 * PI_7) - PI_7;
                  a = abs(a);
                  p = length(p) * vec2(cos(a), sin(a));
                  
                  // Invert through the orthogonal circle
                  vec2 d = p - inv_center;
                  float dist2 = dot(d, d);
                  if (dist2 < inv_radius2) {
                      p = inv_center + d * (inv_radius2 / dist2);
                  }
              }
              
              // Calculate distances to the fundamental domain edges
              float scale = 1.0 - r_orig * r_orig; // Conformal metric scale
              
              float d1 = abs(p.y) / scale;
              float d2 = abs(length(p - inv_center) - sqrt(inv_radius2)) / scale;
              vec2 n = vec2(-sin(PI_7), cos(PI_7));
              float d3 = abs(dot(p, n)) / scale;
              
              float dMin = min(min(d1, d2), d3);
              
              // Faint bright lines
              edgeLine = smoothstep(0.012, 0.002, dMin);
              
              // Subpixel bloom where edges cross (vertices)
              float cross1 = smoothstep(0.02, 0.0, d1) * smoothstep(0.02, 0.0, d2);
              float cross2 = smoothstep(0.02, 0.0, d2) * smoothstep(0.02, 0.0, d3);
              float cross3 = smoothstep(0.02, 0.0, d1) * smoothstep(0.02, 0.0, d3);
              bloom = clamp(cross1 + cross2 + cross3, 0.0, 1.0);
              
              // Fade out near the disk boundary to hide folding iteration limits
              float edgeFade = smoothstep(0.99, 0.85, r_orig);
              edgeLine *= edgeFade;
              bloom *= edgeFade;
          }
          
          // Occasional cyan flicker linked to position and time (Data corruption/transmission anomaly)
          float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
          float flicker = step(0.99, noise) * smoothstep(0.2, 0.8, sin(u_time * 3.0));
          
          // Compose the tiling color
          vec3 tileColor = vec3(0.8, 0.9, 1.0) * edgeLine; // White/blue hyperbolic lines
          tileColor += vec3(0.0, 1.0, 1.0) * edgeLine * flicker * 3.0; // Cyan glitch
          
          color += tileColor;
          
          // LED Subpixel Grid logic
          float subpixel = mod(gl_FragCoord.x, 3.0);
          vec3 rgbMask = vec3(
              1.0 - step(1.0, subpixel),
              step(1.0, subpixel) - step(2.0, subpixel),
              step(2.0, subpixel)
          );
          
          // Soften the mask to simulate ambient light and prevent absolute black
          rgbMask = mix(vec3(0.1, 0.15, 0.4), rgbMask, 0.85); // Blue-dominant leakage
          
          // Scanlines
          float scanline = sin(gl_FragCoord.y * PI * 0.5) * 0.3 + 0.7;
          
          // Apply hardware texture
          vec3 finalColor = color * rgbMask * scanline;
          
          // Phosphor Bloom (bleeds across the subpixel mask constraints)
          finalColor += vec3(0.3, 0.8, 1.0) * bloom * 2.0; // Vertex intersections bloom bright
          finalColor += vec3(0.0, 0.1, 0.3) * edgeLine * 0.6; // General line glow
          
          // CRT Vignette
          float vignette = 1.0 - smoothstep(0.15, 0.28, r2);
          finalColor *= vignette;
          
          // Oklab-ish perceptual pop (simplified gamma)
          fragColor = vec4(pow(finalColor, vec3(1.0 / 2.0)), 1.0);
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
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);