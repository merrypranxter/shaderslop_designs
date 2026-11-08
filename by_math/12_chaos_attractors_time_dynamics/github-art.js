if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    renderer.autoClear = false;
    
    const SIM_RES = 512;
    const N = SIM_RES * SIM_RES;
    
    const rtOpts = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    
    const posFBOs = [
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts),
      new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOpts)
    ];
    
    const drawFBOOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    
    const drawFBOs = [
      new THREE.WebGLRenderTarget(grid.width, grid.height, drawFBOOpts),
      new THREE.WebGLRenderTarget(grid.width, grid.height, drawFBOOpts)
    ];
    
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const partCam = new THREE.PerspectiveCamera(60, grid.width / grid.height, 0.1, 100);
    partCam.position.z = 3.5;
    
    // Seed initial positions
    const posData = new Float32Array(N * 4);
    for(let i = 0; i < N; i++) {
      posData[i*4+0] = (Math.random() - 0.5) * 4.0;
      posData[i*4+1] = (Math.random() - 0.5) * 4.0;
      posData[i*4+2] = 0;
      posData[i*4+3] = 0;
    }
    const initPosTex = new THREE.DataTexture(posData, SIM_RES, SIM_RES, THREE.RGBAFormat, THREE.FloatType);
    initPosTex.needsUpdate = true;
    
    const initMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_tex: { value: initPosTex } },
      vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; in vec2 vUv; uniform sampler2D u_tex; out vec4 fragColor; void main() { fragColor = texture(u_tex, vUv); }`
    });
    const initScene = new THREE.Scene();
    initScene.add(new THREE.Mesh(quadGeo, initMat));
    
    renderer.setRenderTarget(posFBOs[0]);
    renderer.render(initScene, quadCam);
    renderer.setRenderTarget(posFBOs[1]);
    renderer.render(initScene, quadCam);
    
    initPosTex.dispose();
    initMat.dispose();
    
    // ── Update Pass (Strange Attractor + Fluid Dynamics + Tessellation) ──
    const updateMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_pos: { value: null },
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_mouse_pressed: { value: 0 }
      },
      vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        uniform sampler2D u_pos;
        uniform float u_time;
        uniform vec2 u_mouse;
        uniform float u_mouse_pressed;
        out vec4 fragColor;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+10.0)*x); }

        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m;
            m = m*m;
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

        vec2 curlNoise(vec2 p) {
            const float e = 0.01;
            float n1 = snoise(p + vec2(e, 0.0));
            float n2 = snoise(p - vec2(e, 0.0));
            float n3 = snoise(p + vec2(0.0, e));
            float n4 = snoise(p - vec2(0.0, e));
            return vec2(n3 - n4, n2 - n1) / (2.0 * e);
        }

        vec2 foldP6m(vec2 p) {
            const float sqrt3 = 1.732050807568877;
            p = abs(p);
            if (p.y > p.x * sqrt3) p = vec2(p.x * sqrt3 + p.y, p.x - p.y * sqrt3) / 2.0;
            p = abs(p);
            if (p.y > p.x * sqrt3) p = vec2(p.x * sqrt3 + p.y, p.x - p.y * sqrt3) / 2.0;
            return abs(p);
        }

        void main() {
            vec4 data = texture(u_pos, vUv);
            vec2 pos = data.xy;
            vec2 vel = data.zw;
            
            // Domain Warping via p6m Tessellation Fold
            float foldMix = smoothstep(-1.0, 1.0, sin(u_time * 0.3));
            vec2 symPos = mix(pos, foldP6m(pos * 1.2) * 0.833, foldMix);
            
            // Peter de Jong Attractor Force
            float a = 1.4 + sin(u_time * 0.11) * 0.3;
            float b = -2.3 + cos(u_time * 0.13) * 0.3;
            float c = 2.4 + sin(u_time * 0.17) * 0.2;
            float d = -2.1 + cos(u_time * 0.19) * 0.2;
            
            vec2 pdj = vec2(
                sin(a * symPos.y) - cos(b * symPos.x),
                sin(c * symPos.x) - cos(d * symPos.y)
            );
            
            // Fluid Dynamics: Curl Noise Turbulence
            vec2 curl = curlNoise(pos * 1.5 + u_time * 0.15);
            
            vec2 force = pdj * 0.8 + curl * 0.6;
            
            // Interaction
            if (u_mouse_pressed > 0.5) {
                float dMouse = length(pos - u_mouse);
                if (dMouse < 1.5) {
                    force += normalize(pos - u_mouse + 0.0001) * 4.0 * (1.5 - dMouse);
                }
            }
            
            vel = vel * 0.93 + force * 0.012;
            pos += vel;
            
            // Containment
            if (length(pos) > 5.0) pos *= 0.9;
            
            fragColor = vec4(pos, vel);
        }
      `
    });
    const updateScene = new THREE.Scene();
    updateScene.add(new THREE.Mesh(quadGeo, updateMat));
    
    // ── Render Pass (Particles) ──
    const partGeo = new THREE.BufferGeometry();
    const partUvs = new Float32Array(N * 3);
    for(let i = 0; i < N; i++) {
      partUvs[i*3+0] = ((i % SIM_RES) + 0.5) / SIM_RES;
      partUvs[i*3+1] = (Math.floor(i / SIM_RES) + 0.5) / SIM_RES;
      partUvs[i*3+2] = 0;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partUvs, 3));
    
    const renderMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_pos: { value: null },
        u_time: { value: 0 }
      },
      vertexShader: `
        precision highp float;
        uniform sampler2D u_pos;
        uniform float u_time;
        out vec2 vVel;
        out vec2 vPos;

        void main() {
            vec4 data = texture(u_pos, position.xy);
            vVel = data.zw;
            vec2 pos = data.xy;
            vPos = pos;
            
            float z = length(vVel) * 3.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, z, 1.0);
            gl_PointSize = 2.0;
        }
      `,
      fragmentShader: `
        precision highp float;
        in vec2 vVel;
        in vec2 vPos;
        out vec4 fragColor;

        // Lisa Frank / Electric Acid Palette
        vec3 cosinePalette(float t) {
            vec3 a = vec3(0.5, 0.5, 0.5);
            vec3 b = vec3(0.5, 0.5, 0.5);
            vec3 c = vec3(1.0, 1.0, 0.5);
            vec3 d = vec3(0.80, 0.90, 0.30);
            return a + b * cos(6.2831853 * (c * t + d));
        }

        void main() {
            float speed = length(vVel) * 15.0;
            float spatial = length(vPos) * 0.2;
            vec3 col = cosinePalette(speed * 0.7 + spatial - 0.2);
            
            vec2 pc = gl_PointCoord - 0.5;
            float dist = length(pc);
            float alpha = smoothstep(0.5, 0.1, dist) * 0.12;
            
            fragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    const renderScene = new THREE.Scene();
    renderScene.add(new THREE.Points(partGeo, renderMat));
    
    // ── Decay Pass (Shoegaze Smear & Chromatic Aberration) ──
    const decayMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_tex: { value: null },
        u_time: { value: 0 }
      },
      vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        uniform sampler2D u_tex;
        uniform float u_time;
        out vec4 fragColor;

        void main() {
            vec2 dir = vUv - 0.5;
            float dist = length(dir);
            
            float angle = 0.015 * smoothstep(0.5, 0.0, dist) * sin(u_time * 0.5);
            mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
            vec2 uvRot = dir * rot + 0.5;
            
            vec2 offset = dir * 0.004;
            
            float r = texture(u_tex, uvRot + offset).r;
            float g = texture(u_tex, uvRot).g;
            float b = texture(u_tex, uvRot - offset).b;
            
            vec3 col = vec3(r, g, b);
            col *= 0.95;
            col = max(col - 0.002, 0.0);
            
            fragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false
    });
    const decayScene = new THREE.Scene();
    decayScene.add(new THREE.Mesh(quadGeo, decayMat));
    
    // ── Output Pass (Tonemapping & Vignette) ──
    const outputMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { u_tex: { value: null } },
      vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp float;
        in vec2 vUv;
        uniform sampler2D u_tex;
        out vec4 fragColor;
        
        void main() {
            vec4 col = texture(u_tex, vUv);
            col.rgb = col.rgb / (1.0 + col.rgb * 0.5); // Soft Reinhard
            float d = length(vUv - 0.5) * 2.0;
            col.rgb *= 1.0 - smoothstep(0.8, 1.5, d);
            fragColor = vec4(col.rgb, 1.0);
        }
      `
    });
    const outputScene = new THREE.Scene();
    outputScene.add(new THREE.Mesh(quadGeo, outputMat));

    canvas.__three = { 
      renderer, posFBOs, drawFBOs, 
      updateScene, updateMat, 
      renderScene, renderMat, 
      decayScene, decayMat,
      outputScene, outputMat,
      partCam, quadCam,
      pingPong: 0,
      width: grid.width,
      height: grid.height
    };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    return;
  }
}

const sys = canvas.__three;
if (!sys) return;

if (sys.width !== grid.width || sys.height !== grid.height) {
  sys.width = grid.width;
  sys.height = grid.height;
  sys.renderer.setSize(grid.width, grid.height, false);
  sys.partCam.aspect = grid.width / grid.height;
  sys.partCam.updateProjectionMatrix();
  sys.drawFBOs[0].setSize(grid.width, grid.height);
  sys.drawFBOs[1].setSize(grid.width, grid.height);
}

// Map mouse to world coordinates
const aspect = grid.width / grid.height;
const vFov = 60 * Math.PI / 180;
const hHeight = Math.tan(vFov / 2) * 3.5;
const hWidth = hHeight * aspect;

const mx = ((mouse.x / grid.width) * 2 - 1) * hWidth;
const my = (-(mouse.y / grid.height) * 2 + 1) * hHeight;

sys.updateMat.uniforms.u_time.value = time;
sys.updateMat.uniforms.u_mouse.value.set(mx, my);
sys.updateMat.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;

sys.renderMat.uniforms.u_time.value = time;
sys.decayMat.uniforms.u_time.value = time;

let pp = sys.pingPong;
let nextPP = 1 - pp;

// 1. Update Positions
sys.updateMat.uniforms.u_pos.value = sys.posFBOs[pp].texture;
sys.renderer.setRenderTarget(sys.posFBOs[nextPP]);
sys.renderer.render(sys.updateScene, sys.quadCam);

// 2. Decay previous draw
sys.decayMat.uniforms.u_tex.value = sys.drawFBOs[pp].texture;
sys.renderer.setRenderTarget(sys.drawFBOs[nextPP]);
sys.renderer.render(sys.decayScene, sys.quadCam);

// 3. Render Particles
sys.renderMat.uniforms.u_pos.value = sys.posFBOs[nextPP].texture;
sys.renderer.setRenderTarget(sys.drawFBOs[nextPP]);
sys.renderer.render(sys.renderScene, sys.partCam);

// 4. Output to screen
sys.outputMat.uniforms.u_tex.value = sys.drawFBOs[nextPP].texture;
sys.renderer.setRenderTarget(null);
sys.renderer.clear();
sys.renderer.render(sys.outputScene, sys.quadCam);

sys.pingPong = nextPP;