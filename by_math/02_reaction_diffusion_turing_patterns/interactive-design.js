if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.autoClear = false;

    const res = new THREE.Vector2(grid.width, grid.height);

    // HalfFloatType is safer for WebGL2 render targets across different hardware
    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false
    };

    const fboA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);
    const fboB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOpts);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);

    // --- SIMULATION SHADER: Advected Reaction-Diffusion (G2 Phi Field + CA) ---
    const simMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_prev: { value: null },
        u_res: { value: res },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_mouse_down: { value: 0.0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_prev;
        uniform vec2 u_res;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_mouse_down;

        in vec2 vUv;
        out vec4 fragColor;

        // Feral Noise
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // G2 Latent Phi Field (Repo 3)
        vec2 getPhi(vec2 p, float t) {
            float a = sin(p.x * 2.1 + t * 0.55);
            float b = cos(p.y * 2.7 - t * 0.31);
            float c = sin((p.x + p.y) * 3.2 + t * 0.22);
            return vec2(a + 0.3 * c, b - 0.25 * c);
        }

        void main() {
            vec2 texel = 1.0 / u_res;

            // Advection via Phi Field
            vec2 phi = getPhi(vUv * 3.0, u_time * 0.2);
            vec2 jitter = (vec2(hash(vUv + u_time), hash(vUv - u_time)) - 0.5) * 0.002;
            vec2 uv = vUv - phi * texel * 0.6 + jitter;

            // 9-tap Reaction-Diffusion Sampling
            vec2 c = texture(u_prev, uv).rg;
            vec2 n = texture(u_prev, uv + vec2(0.0, texel.y)).rg;
            vec2 s = texture(u_prev, uv - vec2(0.0, texel.y)).rg;
            vec2 e = texture(u_prev, uv + vec2(texel.x, 0.0)).rg;
            vec2 w = texture(u_prev, uv - vec2(texel.x, 0.0)).rg;
            vec2 ne = texture(u_prev, uv + vec2(texel.x, texel.y)).rg;
            vec2 nw = texture(u_prev, uv + vec2(-texel.x, texel.y)).rg;
            vec2 se = texture(u_prev, uv + vec2(texel.x, -texel.y)).rg;
            vec2 sw = texture(u_prev, uv + vec2(-texel.x, -texel.y)).rg;

            vec2 lap = n + s + e + w + 0.5 * (ne + nw + se + sw) - 6.0 * c;

            // Ecological Map: Spatially variant feed/kill rates
            float chamber = sin(length(vUv - 0.5) * 8.0 + phi.x * 2.0);
            float feed = 0.025 + 0.04 * vUv.x + 0.01 * chamber;
            float kill = 0.045 + 0.02 * vUv.y + 0.005 * phi.y;

            // Gray-Scott CA
            float a = c.r;
            float b = c.g;
            float abb = a * b * b;

            float da = 1.0;
            float db = 0.4;

            float nextA = a + (da * lap.r - abb + feed * (1.0 - a));
            float nextB = b + (db * lap.g + abb - (feed + kill) * b);

            // Singularity Injection (Mouse Trauma)
            float dist = length(vUv - u_mouse);
            if (u_mouse_down > 0.5 && dist < 0.05) {
                nextA *= 0.1;
                nextB = min(nextB + 0.9 * exp(-dist * 200.0), 1.0);
            }

            // Primordial Seeding
            if (u_time < 0.2 || (hash(vUv + u_time * 0.1) < 0.0001)) {
                nextB = max(nextB, 0.8);
                nextA = 0.1;
            }

            fragColor = vec4(clamp(nextA, 0.0, 1.0), clamp(nextB, 0.0, 1.0), 0.0, 1.0);
        }
      `
    });

    // --- DISPLAY SHADER: Structural Color Projection & Acid Palette (Repos 2 & 5) ---
    const dispMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_state: { value: null },
        u_res: { value: res },
        u_time: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_state;
        uniform vec2 u_res;
        uniform float u_time;

        in vec2 vUv;
        out vec4 fragColor;

        // Wavelength to RGB (Repo 5)
        vec3 wave2rgb(float W) {
            vec3 c = vec3(0.0);
            if (W >= 380.0 && W < 440.0) c = vec3(-(W-440.0)/(440.0-380.0), 0.0, 1.0);
            else if (W >= 440.0 && W < 490.0) c = vec3(0.0, (W-440.0)/(490.0-440.0), 1.0);
            else if (W >= 490.0 && W < 510.0) c = vec3(0.0, 1.0, -(W-510.0)/(510.0-490.0));
            else if (W >= 510.0 && W < 580.0) c = vec3((W-510.0)/(580.0-510.0), 1.0, 0.0);
            else if (W >= 580.0 && W < 645.0) c = vec3(1.0, -(W-645.0)/(645.0-580.0), 0.0);
            else if (W >= 645.0 && W <= 780.0) c = vec3(1.0, 0.0, 0.0);
            
            float factor = 1.0;
            if(W >= 380.0 && W < 420.0) factor = 0.3 + 0.7*(W-380.0)/(420.0-380.0);
            else if(W >= 700.0 && W <= 780.0) factor = 0.3 + 0.7*(780.0-W)/(780.0-700.0);
            
            return c * factor;
        }

        // Thin-Film Interference (Repo 5)
        vec3 thinFilm(float thickness, float viewAngle, float n_film) {
            vec3 color = vec3(0.0);
            for(int i = 0; i < 12; i++) {
                float fi = float(i);
                float lambda = mix(380.0, 750.0, fi / 11.0);
                float pathDiff = 2.0 * n_film * thickness * cos(viewAngle);
                float phase = (pathDiff / lambda) * 6.28318;
                float intensity = 0.5 + 0.5 * cos(phase);
                color += wave2rgb(lambda) * intensity * 1.5;
            }
            return color / 12.0;
        }

        void main() {
            vec2 texel = 1.0 / u_res;
            vec2 state = texture(u_state, vUv).rg;
            float b = state.g;

            // Torsion & Surface Normal
            float dx = texture(u_state, vUv + vec2(texel.x, 0)).g - texture(u_state, vUv - vec2(texel.x, 0)).g;
            float dy = texture(u_state, vUv + vec2(0, texel.y)).g - texture(u_state, vUv - vec2(0, texel.y)).g;
            vec2 grad = vec2(dx, dy);
            float torsion = length(grad);

            vec3 N = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
            vec3 V = vec3(0.0, 0.0, 1.0);
            float viewAngle = acos(max(0.0, dot(N, V)));

            // Structural Color mapped to Infection State
            float thickness = 200.0 + b * 1800.0 + torsion * 1000.0;
            
            // Glitch Scan Bend (Repo 2) - Chromatic Aberration via thickness shifts
            vec2 shift = vec2(torsion * 15.0 * texel.x, 0.0);
            float tR = 200.0 + texture(u_state, vUv + shift).g * 1800.0;
            float tB = 200.0 + texture(u_state, vUv - shift).g * 1800.0;
            
            vec3 colR = thinFilm(tR, viewAngle, 1.45);
            vec3 colG = thinFilm(thickness, viewAngle, 1.45);
            vec3 colB = thinFilm(tB, viewAngle, 1.45);
            
            vec3 filmColor = vec3(colR.r, colG.g, colB.b);

            // Void Background (Cyberdelic Neon)
            vec3 voidColor = vec3(0.04, 0.02, 0.08);
            vec3 finalColor = mix(voidColor, filmColor, smoothstep(0.05, 0.8, b));

            // G2 Resolution / Scar Glow (Repo 3)
            float scarMask = smoothstep(0.03, 0.15, torsion);
            vec3 scarColor = vec3(1.0, 0.0, 0.8) * scarMask; // Hot Magenta
            if (torsion > 0.1) scarColor += vec3(1.0, 0.7, 0.1) * (torsion * 5.0); // Alchemical Gold
            
            finalColor += scarColor * (0.8 + 0.4 * sin(u_time * 8.0));

            // Print Artifact: Newsprint Grain Overlay
            float grain = fract(sin(dot(vUv * u_res, vec2(12.9898, 78.233))) * 43758.5453);
            finalColor += (grain - 0.5) * 0.12;
            
            // Vignette
            float dist = length(vUv - 0.5);
            finalColor *= smoothstep(0.8, 0.3, dist);

            fragColor = vec4(finalColor, 1.0);
        }
      `
    });

    const simScene = new THREE.Scene();
    simScene.add(new THREE.Mesh(geo, simMat));

    const dispScene = new THREE.Scene();
    dispScene.add(new THREE.Mesh(geo, dispMat));

    canvas.__three = {
      renderer, camera, fboA, fboB, simScene, simMat, dispScene, dispMat, ping: 0
    };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const t = canvas.__three;
if (!t) return;

// Handle dynamic resizing
const currentSize = t.renderer.getSize(new THREE.Vector2());
if (currentSize.x !== grid.width || currentSize.y !== grid.height) {
  t.renderer.setSize(grid.width, grid.height, false);
  t.fboA.setSize(grid.width, grid.height);
  t.fboB.setSize(grid.width, grid.height);
  t.simMat.uniforms.u_res.value.set(grid.width, grid.height);
  t.dispMat.uniforms.u_res.value.set(grid.width, grid.height);
}

// Map mouse correctly to shader space
let mx = mouse.x / grid.width;
let my = 1.0 - (mouse.y / grid.height);
t.simMat.uniforms.u_mouse.value.set(mx, my);
t.simMat.uniforms.u_mouse_down.value = mouse.isPressed ? 1.0 : 0.0;
t.simMat.uniforms.u_time.value = time;

// Multi-step CA simulation for feral, accelerated growth
const SIM_STEPS = 4;
let currSource = t.ping === 0 ? t.fboA : t.fboB;
let currDest = t.ping === 0 ? t.fboB : t.fboA;

for (let i = 0; i < SIM_STEPS; i++) {
  t.simMat.uniforms.u_prev.value = currSource.texture;
  t.renderer.setRenderTarget(currDest);
  t.renderer.render(t.simScene, t.camera);
  
  // Swap buffers
  let temp = currSource;
  currSource = currDest;
  currDest = temp;
  t.ping = 1 - t.ping;
}

// Final Projection/Display Pass
t.dispMat.uniforms.u_state.value = currSource.texture;
t.dispMat.uniforms.u_time.value = time;

t.renderer.setRenderTarget(null); // Backbuffer
t.renderer.render(t.dispScene, t.camera);