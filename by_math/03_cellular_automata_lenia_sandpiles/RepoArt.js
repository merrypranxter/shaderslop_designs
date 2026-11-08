if (!canvas.__three) {
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) throw new Error("WebGL 2 not supported or context occupied");

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
    renderer.autoClear = false;

    const sceneUpdate = new THREE.Scene();
    const sceneDisplay = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const fboOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false
    };

    const fbos = [
      new THREE.WebGLRenderTarget(grid.width, grid.height, fboOptions),
      new THREE.WebGLRenderTarget(grid.width, grid.height, fboOptions)
    ];

    const vertexShader = `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const updateFragmentShader = `
      precision highp float;
      
      uniform sampler2D u_state;
      uniform vec2 u_res;
      uniform float u_time;
      uniform int u_frame;
      uniform vec2 u_mouse;
      uniform float u_mousePress;

      out vec4 fragColor;

      vec3 hash33(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yxz + 19.19);
        return fract((p.xxy + p.yxx) * p.zyx);
      }
      
      vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yzx  + 33.33);
        return fract((p3.xx+p3.yz)*p3.zy) * 2.0 - 1.0;
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(dot(hash22(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)), 
                       dot(hash22(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
                   mix(dot(hash22(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)), 
                       dot(hash22(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
      }

      vec2 curl(vec2 p, float t) {
        float e = 0.05;
        float n1 = noise(p + vec2(0.0, e) + t);
        float n2 = noise(p + vec2(0.0, -e) + t);
        float n3 = noise(p + vec2(e, 0.0) + t);
        float n4 = noise(p + vec2(-e, 0.0) + t);
        return normalize(vec2(-(n1 - n2), n3 - n4) + 0.0001);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        
        if (u_frame < 5) {
          fragColor = vec4(hash33(vec3(uv * u_res, 0.0)), 1.0);
          return;
        }

        // Curl advection domain warp
        vec2 c = curl(uv * 4.0, u_time * 0.15);
        vec2 wuv = fract(uv - c * 0.002);

        // 3x3 Neighborhood sampling for diffusion
        vec3 avg = vec3(0.0);
        vec2 texel = 1.0 / u_res;
        for(int y = -1; y <= 1; y++) {
          for(int x = -1; x <= 1; x++) {
            avg += texture(u_state, wuv + vec2(float(x), float(y)) * texel).rgb;
          }
        }
        avg /= 9.0;

        vec3 p = texture(u_state, wuv).rgb;
        
        // Continuous Cyclic Cellular Automaton (May-Leonard model variant)
        // r eats g, g eats b, b eats r.
        float sumP = p.r + p.g + p.b;
        vec3 next = p + 0.6 * p * (1.0 - sumP + 1.3 * p.gbr - 1.0 * p.brg);
        
        // Laplacian diffusion
        next += 0.25 * (avg - p);
        
        // Fungal Spore mutation injection
        vec3 h = hash33(vec3(uv * u_res, u_time));
        if (h.x < 0.0002) {
          next += h * 0.5;
        }

        // Feral Interaction
        float d = length(uv - u_mouse);
        if (u_mousePress > 0.5 && d < 0.04) {
          next += vec3(0.1, 1.0, 0.5); 
        }

        fragColor = vec4(clamp(next, 0.0, 1.0), 1.0);
      }
    `;

    const displayFragmentShader = `
      precision highp float;
      
      uniform sampler2D u_texture;
      uniform vec2 u_res;
      uniform float u_time;

      out vec4 fragColor;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;

        // CMYK Misregistration Artifact (Psychedelic Collage)
        float pulse = sin(u_time * 0.5) * 0.5 + 0.5;
        vec2 offR = vec2(0.004, -0.002) * (1.0 + pulse);
        vec2 offG = vec2(-0.002, 0.003) * (1.0 + pulse);
        vec2 offB = vec2(0.003, 0.001) * (1.0 + pulse);

        vec3 stateR = texture(u_texture, fract(uv + offR)).rgb;
        vec3 stateG = texture(u_texture, fract(uv + offG)).rgb;
        vec3 stateB = texture(u_texture, fract(uv + offB)).rgb;

        vec3 mixedState = vec3(stateR.r, stateG.g, stateB.b);

        // Acid Vibration Palette
        vec3 colorOrange = vec3(1.0, 0.42, 0.0);
        vec3 colorBlue = vec3(0.0, 0.28, 1.0);
        vec3 colorMagenta = vec3(1.0, 0.0, 0.78);
        vec3 colorLime = vec3(0.66, 1.0, 0.0);

        vec3 baseColor = mixedState.r * colorOrange + 
                         mixedState.g * colorBlue + 
                         mixedState.b * colorMagenta;
                         
        float intersection = mixedState.r * mixedState.g * mixedState.b;
        baseColor = mix(baseColor, colorLime, intersection * 4.0);
        baseColor = clamp(baseColor, 0.0, 1.0);

        // Halftone Screen Artifact
        float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
        float freq = clamp(u_res.y * 0.3, 100.0, 300.0);
        float angle = 0.785398;
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 hUv = rot * (uv * u_res);
        vec2 cell = fract(hUv * freq / u_res.y) - 0.5;
        float dist = length(cell);
        float radius = sqrt(1.0 - luma) * 0.5;
        float halftone = smoothstep(radius + 0.08, radius - 0.08, dist);

        // Multiply halftone to simulate ink
        baseColor = mix(baseColor * 0.15, baseColor, halftone);

        // Paper grain / Xerox artifact
        float grain = fract(sin(dot(uv * 1000.0 + u_time, vec2(127.1, 311.7))) * 43758.5453);
        baseColor -= grain * 0.15;
        
        // Vignette
        float vig = length(uv - 0.5) * 2.0;
        baseColor *= 1.0 - pow(vig, 2.5) * 0.4;

        fragColor = vec4(clamp(baseColor, 0.0, 1.0), 1.0);
      }
    `;

    const updateMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader: updateFragmentShader,
      uniforms: {
        u_state: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 },
        u_frame: { value: 0 },
        u_mouse: { value: new THREE.Vector2() },
        u_mousePress: { value: 0 }
      }
    });

    const displayMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader: displayFragmentShader,
      uniforms: {
        u_texture: { value: null },
        u_res: { value: new THREE.Vector2(grid.width, grid.height) },
        u_time: { value: 0 }
      }
    });

    const quad = new THREE.PlaneGeometry(2, 2);
    sceneUpdate.add(new THREE.Mesh(quad, updateMaterial));
    sceneDisplay.add(new THREE.Mesh(quad, displayMaterial));

    canvas.__three = {
      renderer,
      sceneUpdate,
      sceneDisplay,
      camera,
      fbos,
      updateMaterial,
      displayMaterial,
      ping: 0,
      frame: 0
    };
  } catch (e) {
    console.error("Feral mechanism initialization failed:", e);
    return;
  }
}

const sys = canvas.__three;
const { renderer, sceneUpdate, sceneDisplay, camera, fbos, updateMaterial, displayMaterial } = sys;

if (fbos[0].width !== grid.width || fbos[0].height !== grid.height) {
  fbos[0].setSize(grid.width, grid.height);
  fbos[1].setSize(grid.width, grid.height);
  updateMaterial.uniforms.u_res.value.set(grid.width, grid.height);
  displayMaterial.uniforms.u_res.value.set(grid.width, grid.height);
  sys.frame = 0; 
}

renderer.setSize(grid.width, grid.height, false);

const nextPing = 1 - sys.ping;

// Update Uniforms
if (updateMaterial.uniforms) {
  updateMaterial.uniforms.u_time.value = time;
  updateMaterial.uniforms.u_frame.value = sys.frame;
  updateMaterial.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - mouse.y / grid.height);
  updateMaterial.uniforms.u_mousePress.value = mouse.isPressed ? 1.0 : 0.0;
  updateMaterial.uniforms.u_state.value = fbos[sys.ping].texture;
}

// CA Step (Ping-Pong)
renderer.setRenderTarget(fbos[nextPing]);
renderer.render(sceneUpdate, camera);

// Display Step
if (displayMaterial.uniforms) {
  displayMaterial.uniforms.u_time.value = time;
  displayMaterial.uniforms.u_texture.value = fbos[nextPing].texture;
}

renderer.setRenderTarget(null);
renderer.render(sceneDisplay, camera);

sys.ping = nextPing;
sys.frame++;