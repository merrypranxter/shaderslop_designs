if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
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
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        uniform float u_time;
        uniform vec2 u_resolution;

        void main() {
          vec2 uv = vUv;
          
          // Grid density - determines the scale of the subpixel triads
          float density = 120.0;
          float cols = density * (u_resolution.x / u_resolution.y);
          float rows = density;
          
          vec2 st = vec2(uv.x * cols, uv.y * rows);
          vec2 local = fract(st);
          
          // Horizontal offsets for R, G, B subpixels within the cell
          float dx_r = (local.x - 1.0/6.0) * 3.0;
          float dx_g = (local.x - 3.0/6.0) * 3.0;
          float dx_b = (local.x - 5.0/6.0) * 3.0;
          
          // Vertical centering with slight elongation
          float dy = (local.y - 0.5) * 1.15;
          
          // Distance fields for each subpixel
          float dr = length(vec2(dx_r, dy));
          float dg = length(vec2(dx_g, dy));
          float db = length(vec2(dx_b, dy));
          
          // Soft gaussian bloom
          float sharpness = 5.5;
          
          // Deep blue-purple hierarchy: Blue dominant, Red secondary, Green dim
          float r = exp(-dr * dr * sharpness * sharpness) * 0.55;
          float g = exp(-dg * dg * sharpness * sharpness) * 0.10;
          float b = exp(-db * db * sharpness * sharpness) * 1.60;
          
          vec3 color = vec3(r, g, b);
          
          // Rolling shutter / scan banding drifting upward
          float scan = sin(uv.y * 35.0 - u_time * 7.0) * 0.5 + 0.5;
          float slow_scan = sin(uv.y * 10.0 - u_time * 2.0) * 0.5 + 0.5;
          
          // Modulate subpixels by scanlines
          color *= 0.85 + 0.15 * scan;
          color *= 0.70 + 0.30 * slow_scan;
          
          // Ambient deep purple backing to ensure overall color tone
          vec3 ambient = vec3(0.05, 0.00, 0.15);
          color += ambient * (0.4 + 0.6 * scan);
          
          // Soft edge vignette to frame the screen texture
          float dist_v = length(uv - 0.5);
          color *= smoothstep(0.95, 0.25, dist_v);
          
          fragColor = vec4(color, 1.0);
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

if (material?.uniforms?.u_time) {
  material.uniforms.u_time.value = time;
}
if (material?.uniforms?.u_resolution) {
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);