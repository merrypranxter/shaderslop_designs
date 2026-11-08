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
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      in vec2 vUv;
      out vec4 fragColor;
      uniform float u_time;
      uniform vec2 u_resolution;

      float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      vec2 hash22(vec2 p) {
          p = fract(p * vec2(443.897, 441.423));
          p += dot(p, p.yx + 19.19);
          return fract(vec2(p.x * p.y, p.x + p.y));
      }

      void main() {
          vec2 uv = (vUv - 0.5) * (u_resolution / min(u_resolution.x, u_resolution.y));
          
          float cycle = sin(u_time * 0.418879); 
          float dissolve = smoothstep(-0.2, 0.6, cycle);
          
          float rot = u_time * 0.05;
          mat2 mRot = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
          vec2 p = mRot * uv;
          
          float yBlock = floor(vUv.y * 30.0);
          float tearMask = step(0.85, hash12(vec2(yBlock, floor(u_time * 5.0))));
          float tearOffset = (hash12(vec2(yBlock, u_time)) - 0.5) * 0.4;
          p.x += tearOffset * dissolve * tearMask;
          
          vec2 blockUv = floor(p * 16.0) / 16.0;
          float blockMask = step(0.75, hash12(blockUv + floor(u_time * 8.0)));
          p = mix(p, blockUv + hash22(blockUv) * 0.02, dissolve * blockMask);
          
          vec3 q = vec3(0.0, 0.0, 0.0);
          float N = 7.0;
          
          for(int i = 0; i < 7; i++) {
              float theta = float(i) * 3.14159265 * 2.0 / N;
              vec2 k = vec2(cos(theta), sin(theta));
              
              vec2 pWarp = p + k * dissolve * 0.08 * sin(dot(p, k.yx) * 12.0 + u_time * 3.0);
              
              float split = dissolve * 0.04;
              float vR = dot(pWarp - k * split, k) * 25.0 + u_time * 1.5;
              float vG = dot(pWarp, k) * 25.0 + u_time * 1.5;
              float vB = dot(pWarp + k * split, k) * 25.0 + u_time * 1.5;
              
              q.x += cos(vR);
              q.y += cos(vG);
              q.z += cos(vB);
          }
          q /= N; 
          
          vec3 order = 0.5 + 0.5 * cos(q * 18.0 + vec3(0.0, 2.094, 4.188));
          order = pow(order, vec3(1.8, 1.8, 1.8)); 
          float edge = smoothstep(0.05, 0.8, length(q));
          order *= edge * 2.5;
          
          vec3 qQuant = floor(q * 5.0) / 5.0;
          float luma = dot(qQuant, vec3(0.333, 0.333, 0.333));
          
          vec3 diss = vec3(0.03, 0.01, 0.05); 
          diss = mix(diss, vec3(1.0, 0.0, 0.4), step(0.15, luma)); 
          diss = mix(diss, vec3(0.0, 1.0, 0.8), step(0.45, luma)); 
          diss = mix(diss, vec3(1.0, 0.9, 0.0), step(0.75, luma)); 
          
          diss += hash12(uv * 40.0 + u_time) * 0.2 * dissolve;
          
          vec3 finalColor = mix(order, diss, dissolve);
          
          float headSwitch = step(vUv.y, 0.04 + 0.05 * hash12(vec2(u_time, 0.0)) * dissolve);
          vec3 headNoise = vec3(hash12(uv * 120.0 - u_time), hash12(uv * 120.0 - u_time + 1.0), hash12(uv * 120.0 - u_time + 2.0));
          finalColor = mix(finalColor, headNoise, headSwitch * dissolve);
          
          float vig = 1.0 - smoothstep(0.3, 1.4, length(vUv - vec2(0.5, 0.5)));
          finalColor *= vig;
          
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
} catch (e) {
  console.error("WebGL Initialization or Render Failed:", e);
}