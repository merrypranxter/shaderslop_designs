try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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

      // Complex math for Möbius transformations
      vec2 cmul(vec2 a, vec2 b) {
          return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
      }
      vec2 cdiv(vec2 a, vec2 b) {
          return cmul(a, vec2(b.x, -b.y)) / dot(b,b);
      }

      // CRT Geometry Distortion
      vec2 crtWarp(vec2 uv) {
          uv = uv * 2.0 - 1.0;
          vec2 offset = uv.yx / 3.5;
          uv = uv + uv * offset * offset;
          return uv * 0.5 + 0.5;
      }

      // Schottky Group Inversion Fractal for Hyperbolic Tessellation
      float getEdge(vec2 z) {
          float edge = 1.0;
          float cx = 1.0;
          float r = 0.866025; // sqrt(3)/2 for interlocking geometry
          
          for(int i = 0; i < 12; i++) {
              z = abs(z); // Fold into fundamental domain quadrant
              
              // Distance to axes
              edge = min(edge, z.x);
              edge = min(edge, z.y);
              
              // Distance to inversion circles
              float d1 = length(z - vec2(cx, 0.0));
              float d2 = length(z - vec2(0.0, cx));
              
              edge = min(edge, abs(d1 - r));
              edge = min(edge, abs(d2 - r));
              
              // Invert if inside circles
              if (d1 < r) {
                  z = vec2(cx, 0.0) + (z - vec2(cx, 0.0)) * (r*r / (d1*d1));
              } else if (d2 < r) {
                  z = vec2(0.0, cx) + (z - vec2(0.0, cx)) * (r*r / (d2*d2));
              }
          }
          return edge;
      }

      void main() {
          vec2 uv = vUv;
          vec2 warpedUV = crtWarp(uv);
          
          // CRT Vignette & Bounds
          float vignette = smoothstep(1.0, 0.95, abs(warpedUV.x * 2.0 - 1.0)) * 
                           smoothstep(1.0, 0.95, abs(warpedUV.y * 2.0 - 1.0));
          
          if (vignette == 0.0) {
              fragColor = vec4(0.0, 0.0, 0.0, 1.0);
              return;
          }

          vec2 z = warpedUV * 2.0 - 1.0;
          z.x *= u_resolution.x / u_resolution.y;
          
          // Slow rotation
          float t = u_time * 0.08;
          z *= mat2(cos(t), -sin(t), sin(t), cos(t));
          
          // Möbius Pan (breathing translation in Poincaré disk)
          vec2 a = vec2(sin(u_time * 0.15) * 0.35, cos(u_time * 0.22) * 0.35);
          vec2 num = z - a;
          vec2 den = vec2(1.0, 0.0) - cmul(vec2(a.x, -a.y), z);
          z = cdiv(num, den);
          
          // Poincaré Disk Mask
          float r0 = length(z);
          float diskMask = smoothstep(1.0, 0.98, r0);
          
          // Chromatic Aberration via spatial offset
          float eR = getEdge(z * 1.008);
          float eG = getEdge(z * 1.000);
          float eB = getEdge(z * 0.992);
          
          vec3 edges = vec3(eR, eG, eB);
          
          // Dynamic edge thickness based on hyperbolic position
          vec3 tileEdge = smoothstep(0.025, 0.002, edges);
          vec3 bloom = smoothstep(0.12, 0.0, edges);
          
          // Palette: Deep Blue Base
          vec3 sceneColor = vec3(0.02, 0.05, 0.15);
          
          // Machine Hesitation / Cyan Flicker
          float flicker = step(0.97, fract(sin(u_time * 114.0 + z.x) * 43758.5));
          vec3 edgeBase = vec3(0.6, 0.8, 1.0) + flicker * vec3(0.0, 1.0, 1.0);
          
          sceneColor += tileEdge * edgeBase * 1.5;
          sceneColor += bloom * edgeBase * 0.8;
          sceneColor *= diskMask;
          
          // Physical LED Subpixel Grid
          vec2 screenPos = vUv * u_resolution;
          float subX = mod(screenPos.x, 3.0);
          vec3 led = vec3(0.0);
          
          if (subX < 0.8) led.r = 1.0;
          else if (subX >= 1.0 && subX < 1.8) led.g = 1.0;
          else if (subX >= 2.0 && subX < 2.8) led.b = 1.0;
          
          // Enforce blue-dominance in the off-state subpixels
          led = max(led, vec3(0.0, 0.1, 0.3));
          
          // Scanlines and Row Gaps
          float scanline = sin(screenPos.y * 3.14159) * 0.4 + 0.6;
          float subY = mod(screenPos.y, 3.0);
          if (subY > 2.0) led *= 0.4;
          
          // Composite: Subpixels bloom where sceneColor is bright
          vec3 finalColor = sceneColor * led * scanline * 2.5;
          
          // Phosphor Persistence (light escaping the subpixel mask)
          finalColor += sceneColor * 0.25;
          
          // Film Grain / Sensor Noise
          float noise = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor += noise * 0.06 * vec3(0.2, 0.5, 1.0);
          
          finalColor *= vignette;
          
          fragColor = vec4(finalColor, 1.0);
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

} catch (err) {
  console.error("WebGL Initialization or Render Failed:", err);
}