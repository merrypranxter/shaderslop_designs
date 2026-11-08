if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      #define T_SLOW (u_time * 0.05)
      #define T_MED  (u_time * 0.3)
      #define T_FAST (u_time * 5.0)

      float hash(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      float map(vec3 p) {
        p.xy *= rot(T_SLOW);
        p.yz *= rot(T_SLOW * 0.7);

        float d = 0.0;
        float scale = 1.0;
        float amp = 1.0;
        
        for(int i = 0; i < 4; i++) {
          float g = abs(dot(sin(p * scale), cos(p.zxy * scale)));
          d += (g - 0.5) * amp;
          p.xyz += sin(p.zxy * scale + T_MED) * 0.5;
          scale *= 2.1;
          amp *= 0.5;
        }
        return d;
      }

      vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.01, 0.0);
        return normalize(vec3(
          map(p + e.xyy) - map(p - e.xyy),
          map(p + e.yxy) - map(p - e.yxy),
          map(p + e.yyx) - map(p - e.yyx)
        ));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        
        float h = hash(gl_FragCoord.xy + T_FAST);
        
        vec3 ro = vec3(0.0, 0.0, T_MED);
        float r = length(uv);
        vec3 rd = normalize(vec3(uv * (1.0 + r * 0.3), 1.0));
        
        ro += rd * h * 0.15;

        float t = 0.0;
        float d = 0.0;
        vec3 p;
        
        vec3 col = vec3(0.0);
        float density = 0.0;

        for(int i = 0; i < 45; i++) {
          p = ro + rd * t;
          d = map(p);
          
          if(d < 0.05) {
            vec3 n = calcNormal(p);
            
            float phase = t * 3.0 + dot(n, vec3(1.0));
            
            float cyan = smoothstep(0.1, 0.9, sin(phase * 2.0 + p.x * 6.0) * 0.5 + 0.5);
            float mag  = smoothstep(0.1, 0.9, sin(phase * 2.5 + p.y * 6.0) * 0.5 + 0.5);
            float yel  = smoothstep(0.1, 0.9, sin(phase * 3.0 + p.z * 6.0) * 0.5 + 0.5);
            
            vec3 layerCol = vec3(0.0);
            layerCol += vec3(0.0, 1.0, 1.0) * cyan;
            layerCol += vec3(1.0, 0.0, 1.0) * mag;
            layerCol += vec3(1.0, 1.0, 0.0) * yel;
            
            vec3 viewDir = -rd;
            vec3 halfVector = normalize(viewDir + vec3(0.5, 0.8, 0.0));
            float aniso = exp(-pow(dot(n, halfVector), 2.0) * 25.0);
            float sparkle = step(0.96, hash(p.xy * 80.0 + T_FAST)) * aniso * 6.0;
            layerCol += sparkle * vec3(1.0);
            
            float moire = sin(p.x * 50.0) * cos(p.y * 50.0 + p.z * 50.0);
            layerCol *= smoothstep(-0.3, 0.5, moire + d * 15.0);
            
            col += layerCol * 0.06 * exp(-t * 0.6);
            density += 0.06;
            
            d = 0.05; 
          }
          
          t += max(abs(d) * 0.75, 0.02);
          if(t > 5.0 || density > 0.95) break;
        }

        col = pow(col, vec3(1.3));
        col = smoothstep(vec3(0.02), vec3(0.9), col);
        
        col -= (h - 0.5) * 0.12;
        col *= smoothstep(0.0, 0.25, density);

        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
  if (material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material.uniforms.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);