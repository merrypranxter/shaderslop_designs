try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 1;
    
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { 
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2() }
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
        
        const vec3 AMBER = vec3(1.0, 0.65, 0.1);
        
        float getScreenContent(vec2 p, float t, float aspect) {
            float lt = fract(t / 10.0);
            
            // Vertical roll artifact every 10s
            float rollTime = fract(t * 0.1);
            float rollEffect = smoothstep(0.8, 0.9, rollTime) * smoothstep(1.0, 0.9, rollTime);
            float rollY = smoothstep(0.8, 1.0, rollTime) * 2.0; 
            float rollJitter = rollEffect * (fract(sin(t * 123.456) * 43758.5) - 0.5) * 0.04;
            
            vec2 sp = p;
            sp.y = fract(sp.y + rollY + rollJitter);
            
            // Wavy scanline distortion
            float wave = sin(sp.y * 3.14159 * 2.0 * 3.0) * 0.015;
            
            // Two offset scanline grids producing horizontal moiré drift
            float phase1 = sp.y * 3.14159 * 2.0 * 250.0 + (sp.x * aspect + wave) * 3.14159 * 2.0 * 8.0 + lt * 3.14159 * 2.0 * 12.0;
            float phase2 = sp.y * 3.14159 * 2.0 * 250.0 + (sp.x * aspect + wave) * 3.14159 * 2.0 * 5.0 - lt * 3.14159 * 2.0 * 8.0;
            
            float g1 = 0.5 + 0.5 * sin(phase1);
            float g2 = 0.5 + 0.5 * sin(phase2);
            
            // Multiplicative interference for wave moiré
            float moire = g1 * g2;
            moire = smoothstep(0.1, 0.8, moire);
            
            // Blinking DOS cursor
            float cursorBlink = step(0.5, fract(t * 1.5));
            vec2 cursorUV = sp - vec2(0.06, 0.85); 
            cursorUV.x *= aspect;
            vec2 cb = vec2(0.01, 0.02);
            float cursorCore = step(0.0, cursorUV.x) * step(cursorUV.x, cb.x * 2.0) * step(0.0, cursorUV.y) * step(cursorUV.y, cb.y * 2.0);
            float cursorGlow = smoothstep(0.05, 0.0, length(max(abs(cursorUV - cb) - cb, 0.0)));
            float cursor = max(cursorCore, cursorGlow * 0.5) * cursorBlink;
            
            // Faint directory text block
            vec2 textUV = sp - vec2(0.06, 0.92);
            textUV.x *= aspect;
            vec2 tb = vec2(0.125, 0.0075);
            float textCore = step(0.0, textUV.x) * step(textUV.x, tb.x * 2.0) * step(0.0, textUV.y) * step(textUV.y, tb.y * 2.0);
            float textGlow = smoothstep(0.04, 0.0, length(max(abs(textUV - tb) - tb, 0.0)));
            float text = max(textCore, textGlow * 0.5);
            
            return max(moire * 0.5, max(cursor, text * 0.6));
        }
        
        void main() {
            vec2 uv = vUv;
            float aspect = u_resolution.x / u_resolution.y;
            
            // CRT Barrel Distortion
            vec2 crtUV = uv * 2.0 - 1.0;
            crtUV *= 1.0 + pow(length(crtUV), 2.0) * 0.06;
            crtUV = crtUV * 0.5 + 0.5;
            
            // Screen boundaries
            float mask = step(0.0, crtUV.x) * step(crtUV.x, 1.0) * step(0.0, crtUV.y) * step(crtUV.y, 1.0);
            
            // Tube vignette
            float vignette = crtUV.x * crtUV.y * (1.0 - crtUV.x) * (1.0 - crtUV.y);
            vignette = clamp(pow(16.0 * vignette, 0.25), 0.0, 1.0);
            mask *= vignette;
            
            // Phosphor persistence via temporal multi-sampling (exponential decay)
            float m0 = getScreenContent(crtUV, u_time, aspect);
            float m1 = getScreenContent(crtUV, u_time - 0.03, aspect);
            float m2 = getScreenContent(crtUV, u_time - 0.06, aspect);
            float m3 = getScreenContent(crtUV, u_time - 0.09, aspect);
            float m4 = getScreenContent(crtUV, u_time - 0.12, aspect);
            
            float signal = m0 * 0.45 + m1 * 0.25 + m2 * 0.15 + m3 * 0.10 + m4 * 0.05;
            
            // Luminance jitter / noise
            float jitter = (fract(sin(dot(crtUV + u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.15;
            
            vec3 color = AMBER * (signal + jitter);
            
            // Static aperture grille (does not roll with the signal)
            color *= 0.85 + 0.15 * sin(crtUV.y * 3.14159 * 2.0 * 300.0);
            
            // Base phosphor glow
            color += AMBER * 0.04;
            color *= mask;
            
            fragColor = vec4(color, 1.0);
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
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
  
  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);
} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}