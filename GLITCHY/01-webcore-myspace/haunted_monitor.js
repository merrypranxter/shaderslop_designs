try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    
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
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        
        #define PI 3.14159265359
        #define TWO_PI 6.28318530718
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        float n1D(float x, float period) {
            float i = floor(x);
            float f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(fract(sin(mod(i, period))*43758.5453), 
                       fract(sin(mod(i + 1.0, period))*43758.5453), f);
        }
        
        float getMoire(vec2 uv, float loopPhase, float channelOffset) {
            float theta = loopPhase * TWO_PI;
            float freq1 = 160.0;
            float freq2 = 163.0;
            
            vec2 dir1 = normalize(vec2(0.012, 1.0));
            vec2 dir2 = normalize(vec2(-0.012, 1.0));
            
            float warp = sin(uv.x * 4.0 + theta * 2.0) * 0.015 + cos(uv.y * 2.0 - theta) * 0.01;
            
            float l1 = 0.5 + 0.5 * sin(dot(uv, dir1) * freq1 + warp + theta * 3.0 + channelOffset);
            float l2 = 0.5 + 0.5 * sin(dot(uv, dir2) * freq2 - warp - theta * 2.0 + channelOffset);
            float l3 = 0.5 + 0.5 * sin(uv.y * 155.0 + theta * 4.0 - channelOffset);
            
            return pow(l1 * l2 * l3, 0.6) * 2.5;
        }
        
        float getPhosphor(vec2 uv, vec2 res) {
            vec2 p = uv * res * 0.35; 
            p.x += step(0.5, fract(p.y * 0.5)) * 0.5;
            vec2 grid = abs(fract(p) - 0.5);
            float dot = 1.0 - smoothstep(0.05, 0.35, length(grid));
            return dot;
        }
        
        void main() {
            vec2 uv = vUv;
            float loopPhase = fract(u_time / 10.0);
            float theta = loopPhase * TWO_PI;
            
            float tearTrigger = smoothstep(0.4, 0.8, n1D(loopPhase * 10.0, 10.0));
            float tearPos = fract(loopPhase * 2.0);
            float tearDist = abs(uv.y - tearPos);
            tearDist = min(tearDist, 1.0 - tearDist);
            float tearBand = smoothstep(0.12, 0.0, tearDist) * tearTrigger;
            
            float tearPos2 = fract(loopPhase * 3.0 + 0.5);
            float tearDist2 = abs(uv.y - tearPos2);
            tearDist2 = min(tearDist2, 1.0 - tearDist2);
            float tearBand2 = smoothstep(0.06, 0.0, tearDist2) * smoothstep(0.6, 0.9, n1D(loopPhase * 15.0, 15.0));
            
            tearBand = max(tearBand, tearBand2);
            
            float headSwitch = smoothstep(0.05, 0.0, uv.y) * smoothstep(0.2, 0.8, hash(vec2(loopPhase * 50.0, 0.0)));
            tearBand = max(tearBand, headSwitch);
            
            vec2 offsetR = vec2(0.0);
            vec2 offsetG = vec2(0.0);
            vec2 offsetB = vec2(0.0);
            
            offsetR.y = (n1D(loopPhase * 20.0, 20.0) - 0.5) * 0.012;
            offsetG.y = (n1D(loopPhase * 20.0 + 5.0, 20.0) - 0.5) * 0.012;
            offsetB.y = (n1D(loopPhase * 20.0 + 10.0, 20.0) - 0.5) * 0.012;
            
            float tearDispX = tearBand * (n1D(uv.y * 50.0 + loopPhase * 20.0, 20.0) - 0.5) * 0.6;
            tearDispX += tearBand * (hash(vec2(uv.y * 10.0 + loopPhase * 100.0, loopPhase * 50.0)) - 0.5) * 0.05;
            
            offsetR.x = tearDispX + 0.005;
            offsetG.x = tearDispX;
            offsetB.x = tearDispX - 0.005;
            
            vec2 uvR = uv + offsetR;
            vec2 uvG = uv + offsetG;
            vec2 uvB = uv + offsetB;
            
            float mR = getMoire(uvR, loopPhase, 0.0);
            float mG = getMoire(uvG, loopPhase, 0.1);
            float mB = getMoire(uvB, loopPhase, -0.1);
            
            float pr = getPhosphor(uvR, u_resolution);
            float pg = getPhosphor(uvG, u_resolution);
            float pb = getPhosphor(uvB, u_resolution);
            
            float r = mR * pr;
            float g = mG * pg;
            float b = mB * pb;
            
            vec3 sickly = r * vec3(0.1, 0.8, 0.6) + 
                          g * vec3(0.5, 1.0, 0.2) + 
                          b * vec3(0.8, 0.9, 1.0);
                          
            float staticNoise = hash(vec2(uv.x * 13.0 + loopPhase * 113.0, uv.y * 17.0 - loopPhase * 107.0));
            staticNoise = smoothstep(0.5, 1.0, staticNoise);
            sickly += tearBand * staticNoise * vec3(0.8, 1.0, 0.9) * 1.5;
            
            float pulse = 0.8 + 0.2 * sin(theta * 3.0);
            vec3 bloom = smoothstep(0.1, 0.8, sickly) * 0.7 * pulse;
            sickly += bloom;
            
            float dropout = n1D(uv.x * 15.0 + uv.y * 60.0 + loopPhase * 10.0, 10.0);
            sickly -= smoothstep(0.85, 1.0, dropout) * 0.4;
            
            float vig = 1.0 - length(uv - 0.5) * 1.2;
            sickly *= smoothstep(-0.2, 0.4, vig);
            
            fragColor = vec4(sickly, 1.0);
        }
      `
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    canvas.__three = { renderer, scene, camera, material };
  }
  
  const { renderer, scene, camera, material } = canvas.__three;
  
  if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
  }
  if (material && material.uniforms && material.uniforms.u_resolution) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
  
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
} catch (e) {
  console.error("Feral WebGL exception:", e);
}