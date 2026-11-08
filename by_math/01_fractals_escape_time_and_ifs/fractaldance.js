if (!canvas.__three) {
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!gl) throw new Error("WebGL 2 not supported or context occupied");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
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
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      
      // Simplex noise implementation
      vec3 permute(vec3 x) { return mod(((x*34.0)+10.0)*x, 289.0); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      // Fractal Brownian Motion
      float fbm(vec2 p) {
        float f = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 4; i++) {
          f += amp * snoise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return f;
      }
      
      // Mandala fold
      vec2 kaleidoscope(vec2 uv, float folds) {
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        float sector = 6.2831853 / folds;
        angle = mod(angle, sector);
        if (angle > sector * 0.5) angle = sector - angle;
        return vec2(cos(angle), sin(angle)) * radius;
      }
      
      // Complex math
      vec2 cmul(vec2 a, vec2 b) {
        return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
      }
      
      // Lisa Frank x Cyberdelic Neon Palette
      vec3 palette(float t) {
        t = fract(t);
        vec3 c1 = vec3(1.0, 0.0, 0.6); // Hot Pink
        vec3 c2 = vec3(0.0, 0.8, 1.0); // Electric Cyan
        vec3 c3 = vec3(0.7, 0.0, 1.0); // Deep Violet
        vec3 c4 = vec3(1.0, 0.9, 0.0); // Electric Yellow
        vec3 c5 = vec3(0.0, 1.0, 0.3); // Acid Lime Green
        
        float f = fract(t * 5.0);
        f = f * f * (3.0 - 2.0 * f); // Smoothstep for buttery gradients
        
        if(t < 0.2) return mix(c1, c2, f);
        if(t < 0.4) return mix(c2, c3, f);
        if(t < 0.6) return mix(c3, c4, f);
        if(t < 0.8) return mix(c4, c5, f);
        return mix(c5, c1, f);
      }
      
      // Core fractal rendering engine
      vec3 render(vec2 uv, float timeOffset) {
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;
        
        float t = u_time * 0.4 + timeOffset;
        
        // Psychedelic domain warp (organic melting)
        vec2 warp = vec2(fbm(p * 2.5 + t * 0.5), fbm(p * 2.5 - t * 0.4));
        p += warp * 0.3;
        
        // Sacred geometry / Occult mandala structural fold
        p = kaleidoscope(p, 8.0);
        
        float rot = t * 0.3;
        p = vec2(p.x * cos(rot) - p.y * sin(rot), p.x * sin(rot) + p.y * cos(rot));
        
        // The dancing Julia parameter
        vec2 c = vec2(
          -0.4 + 0.5 * sin(t * 0.7) + warp.x * 0.1,
           0.3 + 0.5 * cos(t * 0.5) + warp.y * 0.1
        );
        
        vec2 z = p * 1.5;
        float trap = 1e10;
        float n = 0.0;
        const int MAX_ITER = 40;
        
        for (int i = 0; i < MAX_ITER; i++) {
          z = cmul(z, z) + c;
          trap = min(trap, abs(z.x * z.y));
          if (dot(z, z) > 256.0) {
            n = float(i) - log2(log2(dot(z, z))) + 4.0;
            break;
          }
        }
        
        vec3 col = vec3(0.0);
        if (n > 0.0) {
          float smooth_t = n / float(MAX_ITER);
          col = palette(smooth_t * 2.0 - t * 0.5 + trap);
          
          // Halftone screenprint artifact
          vec2 screenPos = uv * u_resolution;
          float halftone = smoothstep(0.2, 0.8, sin(screenPos.x * 0.2 + rot) * sin(screenPos.y * 0.2 - rot));
          col *= mix(0.5, 1.0, halftone);
        } else {
          // Interior glow
          col = palette(trap * 8.0 - t) * exp(-trap * 4.0);
        }
        return col;
      }
      
      // Photocopier electrostatic grain
      float grain(vec2 uv, float seed) {
        return fract(sin(dot(uv * 1000.0 + seed, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      void main() {
        // Radial chromatic aberration (Lens fringe / CMYK misregistration)
        vec2 dir = vUv - 0.5;
        float intensity = 0.025 * length(dir); 
        
        // Sample the fractal field 3 times for RGB splitting
        float r = render(vUv + dir * intensity, 0.0).r;
        float g = render(vUv, 0.0).g;
        float b = render(vUv - dir * intensity, 0.0).b;
        
        vec3 col = vec3(r, g, b);
        
        // Zine/Xerox print artifacts
        float gNoise = grain(vUv, u_time);
        col = mix(col, vec3(gNoise), 0.12); // Soft light grain integration
        
        // CRT scanline dropout
        float scanline = sin(vUv.y * u_resolution.y * 1.5) * 0.06;
        col -= scanline;
        
        // Deep vignette
        float vig = length(dir);
        col *= smoothstep(0.9, 0.2, vig);
        
        fragColor = vec4(col, 1.0);
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
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
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
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);