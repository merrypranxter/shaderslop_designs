if (!canvas.__three) {
  try {
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
      uniform float u_time;
      uniform vec2 u_resolution;
      in vec2 vUv;
      out vec4 fragColor;
      
      // Sinusoidal grating for soft interference (Moire Repo: Technique 04)
      float sineGrating(vec2 p, float freq, float angle, float phase) {
          vec2 dir = vec2(cos(angle), sin(angle));
          float x = dot(p, dir);
          return 0.5 + 0.5 * sin(x * freq + phase);
      }
      
      void main() {
          vec2 p = vUv;
          
          // V-Sync Slip (Damage Repo: Tearing / Sync Instability)
          float syncJitter = step(0.98, fract(sin(floor(u_time * 2.0) * 12.3) * 45.6));
          p.y = fract(p.y + syncJitter * sin(u_time * 15.0) * 0.08);
          
          // Tracking Glitch & Head Switching (Damage Repo: VHS Damage)
          float timeStutter = floor(u_time * 15.0);
          float n1 = fract(sin(dot(vec2(floor(p.y * 150.0), timeStutter), vec2(12.9898, 78.233))) * 43758.5453);
          float n2 = fract(sin(dot(vec2(floor(p.y * 300.0), timeStutter), vec2(39.346, 11.135))) * 43758.5453);
          
          // Sharp horizontal signal drops
          float cut = step(0.96, n1) + step(0.98, n2);
          
          // Slow rolling mechanical tracking band
          float trackPos = fract(-u_time * 0.15);
          float trackBand = step(abs(p.y - trackPos), 0.03);
          trackBand *= step(0.3, fract(sin(p.y * 200.0 + u_time * 20.0) * 123.456));
          
          float blackOut = clamp(cut + trackBand, 0.0, 1.0);
          
          // Horizontal shear adjacent to tracking failure
          float shearCut = clamp(step(0.85, n1) + step(0.90, n2) + step(abs(p.y - trackPos), 0.06), 0.0, 1.0);
          float shear = (fract(sin(p.y * 80.0 + timeStutter) * 999.9) - 0.5) * 0.15;
          p.x += shear * shearCut;
          
          // CRT Raster / Subpixel Grid Setup
          float gridCells = clamp(u_resolution.y / 8.0, 60.0, 150.0);
          vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
          vec2 gridUV = p * aspect * gridCells;
          vec2 cell = floor(gridUV);
          vec2 local = fract(gridUV);
          vec2 cellCenter = (cell + 0.5) / (aspect * gridCells);
          
          // Moire Interference Engine
          float freq1 = 16.0;
          float freq2 = 18.5;
          float freq3 = 14.0;
          
          // Continuous signal (Runtime moire for Phosphor Bloom)
          float g1 = sineGrating(p * aspect, freq1, 0.0, u_time * 2.5);
          float g2 = sineGrating(p * aspect, freq2, 0.785, -u_time * 1.8);
          float g3 = sineGrating(p * aspect, freq3, -0.785, u_time * 1.2);
          float moire = g1 * g2 * g3;
          float signal = smoothstep(0.05, 0.35, moire);
          
          // Discrete signal (Sampled for LED Matrix)
          float cg1 = sineGrating(cellCenter, freq1, 0.0, u_time * 2.5);
          float cg2 = sineGrating(cellCenter, freq2, 0.785, -u_time * 1.8);
          float cg3 = sineGrating(cellCenter, freq3, -0.785, u_time * 1.2);
          float cMoire = cg1 * cg2 * cg3;
          float cSignal = smoothstep(0.05, 0.35, cMoire);
          
          // Subpixel Architecture
          vec2 centered = local - 0.5;
          float purplePill = smoothstep(0.15, 0.05, abs(centered.x + 0.2)) * smoothstep(0.4, 0.2, abs(centered.y));
          float yellowPill = smoothstep(0.15, 0.05, abs(centered.x - 0.2)) * smoothstep(0.4, 0.2, abs(centered.y));
          
          // Palette constraints: Deep purple base, Acid yellow peaks
          vec3 baseColor = vec3(0.4, 0.0, 0.9); 
          vec3 peakColor = vec3(0.85, 1.0, 0.0); 
          
          // The yellow subpixel only ignites on structural peaks
          float isPeak = smoothstep(0.5, 0.8, cSignal);
          
          vec3 ledColor = baseColor * purplePill * (0.2 + cSignal * 0.8);
          ledColor += peakColor * yellowPill * isPeak;
          
          // Phosphor Bloom (Damage Repo: Luminous softening & spread)
          float wideBloom = smoothstep(0.3, 0.9, signal);
          float coreBloom = smoothstep(0.6, 0.95, signal);
          vec3 bloom = peakColor * (wideBloom * 0.4 + coreBloom * 1.2);
          
          vec3 finalColor = ledColor + bloom;
          
          // Apply Tracking Glitch Blackout
          finalColor *= (1.0 - blackOut);
          
          // CRT Scanline Modulator
          float scanline = sin(vUv.y * u_resolution.y * 0.5) * 0.5 + 0.5;
          finalColor *= mix(0.7, 1.0, scanline);
          
          // Optical Vignette
          float vig = length(vUv - 0.5);
          finalColor *= smoothstep(0.8, 0.2, vig);
          
          // Electronic Sensor Noise
          float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
          finalColor += noise * 0.08 * baseColor;
          
          // High contrast blacklight punch
          finalColor = pow(finalColor, vec3(1.1));
          
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