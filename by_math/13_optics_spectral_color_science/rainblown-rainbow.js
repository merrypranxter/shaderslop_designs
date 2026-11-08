if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: false, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    // The Feral Design-Brain Shader:
    // Blending Structural Color (Thin-Film), Kirlian Discharge (L-Infinity Sparks),
    // and Domain Warped Fluid Dynamics (Rainblown).
    const fragmentShader = `
      precision highp float;
      
      in vec2 vUv;
      out vec4 fragColor;
      
      uniform float u_time;
      uniform vec2 u_resolution;

      // --------------------------------------------------------
      // MATH & NOISE MODULES
      // --------------------------------------------------------
      
      // Golden Angle rotation matrix
      const mat2 m2 = mat2(0.7373688, -0.6754903, 0.6754903, 0.7373688);
      
      float hash(vec2 p) {
        vec3 p3  = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      
      float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }
      
      float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        for (int i = 0; i < 6; ++i) {
          v += a * noise(x);
          x = m2 * x * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      // Kirlian / L-Infinity Metric Breakdown
      float lInfSpark(vec2 p) {
        vec2 grid = fract(p) - 0.5;
        float dist = max(abs(grid.x), abs(grid.y));
        return smoothstep(0.45, 0.5, dist);
      }

      // --------------------------------------------------------
      // COLOR SCIENCE MODULES (Structural Color & Tonemapping)
      // --------------------------------------------------------
      
      // Wavelength to RGB (approximate spectral mapping)
      vec3 wavelengthToRGB(float W) {
        vec3 c = vec3(0.0);
        if (W >= 380.0 && W < 440.0) c = vec3(-(W-440.0)/60.0, 0.0, 1.0);
        else if (W >= 440.0 && W < 490.0) c = vec3(0.0, (W-440.0)/50.0, 1.0);
        else if (W >= 490.0 && W < 510.0) c = vec3(0.0, 1.0, -(W-510.0)/20.0);
        else if (W >= 510.0 && W < 580.0) c = vec3((W-510.0)/70.0, 1.0, 0.0);
        else if (W >= 580.0 && W < 645.0) c = vec3(1.0, -(W-645.0)/65.0, 0.0);
        else if (W >= 645.0 && W <= 780.0) c = vec3(1.0, 0.0, 0.0);
        
        float factor = 1.0;
        if(W < 420.0) factor = 0.3 + 0.7*(W-380.0)/40.0;
        else if(W > 700.0) factor = 0.3 + 0.7*(780.0-W)/80.0;
        return c * factor;
      }

      // Thin-Film Spectral Integration (Structural Color)
      vec3 calcStructuralColor(float opd) {
        vec3 col = vec3(0.0);
        float sum = 0.0;
        // Integrate across visible spectrum (400nm - 700nm)
        for(float i = 0.0; i < 12.0; i += 1.0) {
          float lambda = mix(400.0, 700.0, i / 11.0);
          float phase = (opd / lambda) * 6.2831853;
          // Destructive interference base (pi phase shift at boundary)
          float intensity = 0.5 - 0.5 * cos(phase);
          col += wavelengthToRGB(lambda) * intensity;
          sum += 1.0;
        }
        return col / sum;
      }

      // ACES Filmic Tonemapping
      vec3 tonemapACES(vec3 x) {
        float a = 2.51;
        float b = 0.03;
        float c = 2.43;
        float d = 0.59;
        float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      // Cosine Palette (Neon Acid)
      vec3 palette(float t) {
        return 0.5 + 0.5 * cos(6.2831853 * (vec3(2.0, 1.0, 1.0) * t + vec3(0.5, 0.2, 0.25)));
      }

      // --------------------------------------------------------
      // MAIN RENDER
      // --------------------------------------------------------
      
      void main() {
        // Normalize and center UVs
        vec2 uv = (vUv - 0.5) * 2.0;
        uv.x *= u_resolution.x / u_resolution.y;
        
        float t = u_time * 0.2;

        // 1. Rainblown Domain Warping
        // We create a deep fractional brownian warp field to simulate liquid/wind shear
        vec2 q = vec2(fbm(uv + vec2(0.0, t)), fbm(uv + vec2(5.2, 1.3) - t * 0.8));
        vec2 r = vec2(fbm(uv + 3.0 * q + vec2(1.7, 9.2) + t * 1.5), fbm(uv + 3.0 * q + vec2(8.3, 2.8) - t * 1.2));
        
        // "Rainblown" directional smear
        vec2 warpedUV = uv + r * 1.5 + vec2(t * 0.5, -t * 0.8);
        
        // 2. Kirlian Discharge (Parasitic Metric)
        // Electric breakdown tearing through the fluid membrane
        float electricNoise = fbm(warpedUV * 15.0 - t * 3.0);
        float spark = lInfSpark(warpedUV * 8.0 + r * 5.0) * smoothstep(0.4, 0.8, electricNoise);
        // Add a secondary micro-spark layer
        spark += lInfSpark(warpedUV * 24.0) * smoothstep(0.6, 0.9, fbm(warpedUV * 30.0 + t * 5.0)) * 0.5;

        // 3. Film Thickness Calculation
        // Base thickness + fluid displacement - electrical ablation
        float baseThickness = 450.0; // nm
        float fluidDisplacement = fbm(uv * 2.0 + r * 2.5) * 800.0;
        float ablation = spark * 600.0;
        
        float thickness = baseThickness + fluidDisplacement - ablation;
        // Clamp to prevent negative optical paths, but allow it to thin out to 0
        thickness = max(10.0, thickness);

        // 4. Structural Color Generation
        // Refractive index of the fluid (approx 1.4 for oil/dielectric)
        float n = 1.4; 
        // Fake view angle based on screen position and warp
        float cosTheta = 0.8 + 0.2 * sin(length(uv) * 3.0 + r.x); 
        float opticalPathDiff = 2.0 * n * thickness * cosTheta;
        
        vec3 color = calcStructuralColor(opticalPathDiff);
        
        // 5. Inject Kirlian Plasma Color
        // The sparks emit their own light (Neon Acid palette)
        vec3 plasmaGlow = palette(spark * 3.0 - t + r.y);
        color += plasmaGlow * spark * 2.5;
        
        // Add a slight ambient dispersion scatter
        color += vec3(0.05, 0.1, 0.2) * pow(fbm(uv * 5.0), 3.0);

        // 6. Post-Processing
        // Boost exposure before tonemapping to make structural colors pop
        color *= 2.5; 
        color = tonemapACES(color);
        
        // Subtle vignette
        float vignette = 1.0 - smoothstep(0.5, 1.5, length(uv * 0.5));
        color *= vignette;

        fragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
      },
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
  material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution.value.x !== grid.width || 
      material.uniforms.u_resolution.value.y !== grid.height) {
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);