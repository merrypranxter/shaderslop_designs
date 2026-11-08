try {
  if (!ctx) throw new Error("WebGL 2 context not available");

  if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
      precision highp float;
      precision highp int;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      #define PI 3.14159265359

      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

          float global_rot = u_time * 0.05;
          float s = sin(global_rot), c = cos(global_rot);
          uv = mat2(c, -s, s, c) * uv;

          float cycle = (sin(u_time * PI * 2.0 / 15.0) + 1.0) * 0.5;
          float state = smoothstep(0.35, 0.65, cycle);

          vec2 uv_o = uv + 0.04 * vec2(cos(uv.y * 12.0 + u_time), sin(uv.x * 12.0 - u_time));

          vec2 uv_g = uv;
          float slice = step(0.92, fract(uv.y * 15.0 + u_time * 3.0));
          uv_g.x += slice * 0.1 * sin(u_time * 40.0);
          float quant = 60.0;
          uv_g = floor(uv_g * quant) / quant;

          vec2 p = mix(uv_o, uv_g, state) * 20.0;

          uint ix = uint(int(uv_g.x * quant) + 10000);
          uint iy = uint(int(uv_g.y * quant) + 10000);
          uint it = uint(int(u_time * 15.0));
          uint iz = ix ^ iy ^ it;

          float grid_sum = 0.0;
          vec3 color_acc = vec3(0.0);

          for(int i = 0; i < 7; i++) {
              float theta = float(i) * PI / 7.0;
              vec2 v = vec2(cos(theta), sin(theta));

              float proj1 = dot(p, v) + u_time * 0.4;
              proj1 += mix(0.0, float(iz % 5u) * 0.15, state);

              float l1_o = smoothstep(0.15, 0.0, abs(fract(proj1) - 0.5));
              float l1_g = step(0.6, fract(proj1));
              float l1 = mix(l1_o, l1_g, state);

              float proj2 = dot(p * 1.618033, v) - u_time * 0.25;
              proj2 += mix(0.0, float((iz >> 1) % 5u) * 0.15, state);

              float l2_o = smoothstep(0.1, 0.0, abs(fract(proj2) - 0.5));
              float l2_g = step(0.7, fract(proj2));
              float l2 = mix(l2_o, l2_g, state);

              grid_sum += l1 + l2 * 0.6;

              vec3 c_o = 0.5 + 0.5 * cos(vec3(0, 2, 4) + theta * 3.0 + u_time * 0.5);
              vec3 c_g = vec3(1.0);

              color_acc += mix(c_o * l1_o, c_g * l1_g, state);
              color_acc += mix(c_o * l2_o * 0.5, c_g * l2_g * 0.5, state);
          }

          vec3 comp_o = color_acc * 0.6;
          comp_o += vec3(1.0, 0.7, 0.3) * smoothstep(3.5, 6.0, grid_sum) * 2.0;
          comp_o *= smoothstep(0.0, 0.5, grid_sum);

          vec3 comp_g = vec3(0.0);
          if (grid_sum > 5.5) comp_g = vec3(1.0, 0.9, 0.0);
          else if (grid_sum > 3.0) comp_g = vec3(0.0, 1.0, 0.8);
          else if (grid_sum > 1.2) comp_g = vec3(1.0, 0.0, 0.4);
          else if (grid_sum > 0.5) comp_g = vec3(0.1, 0.05, 0.1);

          if (state > 0.5) {
              float n = hash(uv_g + u_time);
              if (n > 0.98) comp_g = vec3(1.0);
              if (slice > 0.5 && n > 0.8) comp_g.r += 0.5;
          }

          vec3 final_color = mix(comp_o, comp_g, state);
          final_color *= 1.0 - 0.4 * length(uv);

          fragColor = vec4(final_color, 1.0);
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) {
      material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL 2 Quasicrystal Initialization Failed:", e);
}