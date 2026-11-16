try {
  if (!ctx) throw new Error("WebGL 2 context not available");
  
  if (!canvas.__three) {
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
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        out vec4 fragColor;

        float rand(vec2 n) { 
            return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float lineGrid(vec2 uv, float angle, float scale, vec2 offset) {
            float c = cos(angle);
            float s = sin(angle);
            vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
            vec2 st = rotUV * scale + offset;
            vec2 g = abs(fract(st) - 0.5);
            // Crossing lines for a woven textile / screen door effect
            float lines = smoothstep(0.25, 0.05, g.x) + smoothstep(0.25, 0.05, g.y);
            return clamp(lines, 0.0, 1.0);
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            vec2 aspectUV = vec2(uv.x * u_resolution.x / u_resolution.y, uv.y);
            
            // Tracking Glitch (Tearing & Bands) from the Damage Taxonomy
            float glitchBand = step(0.94, fract(uv.y * 3.0 - u_time * 0.5 + sin(u_time * 1.5))) * step(0.5, fract(uv.y * 20.0 + u_time * 5.0));
            float tear = glitchBand * 0.1 * sin(uv.y * 100.0 + u_time * 15.0);
            
            // Head-switching noise at bottom of the frame
            float hsArea = step(uv.y, 0.08);
            float headSwitch = hsArea * (rand(vec2(uv.y * 10.0, u_time)) - 0.5) * 0.2;
            
            vec2 glitchUV = aspectUV + vec2(tear + headSwitch, 0.0);
            
            // Chromatic Aberration / Signal Bleed (Heavy Red Shift)
            float colorCrawl = sin(uv.y * 60.0 + u_time * 12.0) * 0.005;
            vec2 uvR = glitchUV + vec2(0.02 + glitchBand * 0.06 + colorCrawl, 0.0);
            vec2 uvG = glitchUV;
            vec2 uvB = glitchUV - vec2(0.01, 0.0);
            
            // Moiré Angles & Scales (~3 degrees offset for a tight woven interference)
            float angle1 = 0.785398; // 45 deg
            float angle2 = 0.837758; // 48 deg
            float scale1 = 45.0;
            float scale2 = 46.0;
            
            vec2 offset1 = vec2(u_time * 0.2, u_time * 0.1);
            vec2 offset2 = vec2(u_time * -0.1, u_time * 0.15);
            
            // Chromatic Moiré Separation
            float mR = lineGrid(uvR, angle1, scale1, offset1) * lineGrid(uvR, angle2, scale2, offset2);
            float mG = lineGrid(uvG, angle1, scale1, offset1) * lineGrid(uvG, angle2, scale2, offset2);
            float mB = lineGrid(uvB, angle1, scale1, offset1) * lineGrid(uvB, angle2, scale2, offset2);
            
            vec3 moireColor = vec3(mR, mG, mB);
            
            // Base Color Palette
            vec3 darkPurple = vec3(0.05, 0.0, 0.12);
            vec3 deepViolet = vec3(0.3, 0.0, 0.5);
            vec3 hotPink = vec3(1.0, 0.05, 0.6);
            vec3 magentaGrain = vec3(0.9, 0.1, 0.8);
            
            vec3 finalColor = darkPurple;
            
            // Add Moiré Interference (Woven structure)
            finalColor += moireColor * vec3(0.9, 0.2, 0.7);
            
            // Heavy Red Bleed Enhancement
            finalColor.r += mR * 0.6 + glitchBand * 0.2;
            
            // Scanlines (Deep Violet)
            float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
            finalColor = mix(finalColor, deepViolet, scanline * 0.3);
            
            // Glitch Bands (Hot Pink)
            float glitchNoise = rand(vec2(uv.y * 15.0, u_time));
            finalColor = mix(finalColor, hotPink * glitchNoise, glitchBand * 0.8);
            
            // Head-switching band rendering (Bottom)
            float hsNoise = rand(uv * vec2(1.0, 80.0) + u_time);
            finalColor = mix(finalColor, vec3(0.9, 0.2, 0.8) * hsNoise, hsArea);
            
            // Magenta-Shifted Noise Grain
            float grain = rand(uv + fract(u_time));
            finalColor += magentaGrain * (grain - 0.5) * 0.35;
            
            // Luma softening / Phosphor Bloom
            float luma = dot(finalColor, vec3(0.299, 0.587, 0.114));
            finalColor += finalColor * luma * 0.5;
            
            // Optical Vignette
            float vig = length(uv - 0.5);
            finalColor *= smoothstep(0.9, 0.2, vig);
            
            fragColor = vec4(finalColor, 1.0);
        }
      `
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
  console.error("WebGL Initialization Failed:", e);
}