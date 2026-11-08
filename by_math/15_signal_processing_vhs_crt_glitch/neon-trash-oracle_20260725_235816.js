if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
        u_click: { value: 0 }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;

        in vec2 vUv;
        out vec4 fragColor;

        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform float u_click;

        // [damage_aesthetics / voronoi_systems] Hash & Noise functions
        vec2 hash22(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.xx + p3.yz) * p3.zy);
        }

        float snoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(dot(hash22(i+vec2(0,0)), f-vec2(0,0)),
                           dot(hash22(i+vec2(1,0)), f-vec2(1,0)), u.x),
                       mix(dot(hash22(i+vec2(0,1)), f-vec2(0,1)),
                           dot(hash22(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
        }

        // [color_systems] OKLab perceptual color interpolation
        vec3 oklab_to_srgb(vec3 c) {
            float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
            float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
            float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
            float l = l_*l_*l_;
            float m = m_*m_*m_;
            float s = s_*s_*s_;
            vec3 rgb = vec3(
                 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
            );
            return mix(12.92*rgb, 1.055*pow(max(rgb, vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(0.0031308, rgb));
        }

        // Hyper-saturated candy-acid palette generator
        vec3 neon_palette(float t) {
            float h = t * 6.28318;
            float L = 0.75 + 0.1 * sin(t * 11.0); 
            float C = 0.35; // Hyperbolic high chroma push
            vec3 lab = vec3(L, C * cos(h), C * sin(h));
            return oklab_to_srgb(lab);
        }

        // --- SCENE GENERATOR ---
        vec3 scene(vec2 p, float t) {
            // [mesh_gradients] Domain Warping via FBM
            vec2 wp = p + vec2(snoise(p * 2.5 + t*0.8), snoise(p * 2.5 - t*0.7)) * 0.3;
            
            // [moire] Spatial interference beats
            float m1 = sin(wp.x * 25.0 + t*2.0) * sin(wp.y * 25.0 + t*2.0);
            float m2 = sin(wp.x * 26.0 - t*2.2) * sin(wp.y * 26.0 - t*2.2);
            float moire = smoothstep(-0.5, 0.5, m1 * m2);
            vec3 bg = neon_palette(moire * 0.5 + t * 0.15);
            
            // [abelian_sandpile] Fractional mandala symmetries
            vec2 sp = abs(wp);
            float sand = fract(max(sp.x, sp.y) * 12.0 - t);
            bg = mix(bg, neon_palette(sand + 0.4), 0.25);
            
            // [plateau_foam / voronoi_systems / lenia] Cellular Slime Weather
            float f1 = 8.0, f2 = 8.0;
            vec2 i = floor(wp * 6.0);
            vec2 f = fract(wp * 6.0);
            for(int y=-1; y<=1; y++) {
                for(int x=-1; x<=1; x++) {
                    vec2 g = vec2(float(x), float(y));
                    vec2 h = hash22(i + g);
                    // Brownian seed dynamics
                    vec2 o = h + 0.45 * vec2(sin(t*2.5 + h.x*6.28), cos(t*2.5 + h.y*6.28));
                    vec2 dvec = abs(g - f + o);
                    // Minkowski distance p=2.5
                    float d = pow(pow(dvec.x, 2.5) + pow(dvec.y, 2.5), 1.0/2.5);
                    if(d < f1) { f2 = f1; f1 = d; } 
                    else if(d < f2) { f2 = d; }
                }
            }
            float border = f2 - f1;
            // Lenia continuous growth function
            float growth = 2.0 * exp(-(border - 0.2)*(border - 0.2) / 0.008) - 1.0;
            float edge = smoothstep(0.0, 0.15, border + growth * 0.08);
            
            vec3 cell_color = neon_palette(f1 * 2.5 + t * 0.4);
            // Stygian blue / dark borders (impossible_colors)
            vec3 mid = mix(vec3(0.05, 0.0, 0.15), cell_color, edge); 
            
            vec3 col = mix(bg, mid, smoothstep(0.1, 0.9, snoise(wp * 1.5 + t)));
            
            // [Alchemical Scripture] Oracle Core: Hyperbolic Tunnel & Quasicrystal
            float r2 = dot(p, p);
            vec2 h_p = p / (1.0 + r2); 
            
            float qc = 0.0;
            for(int j=0; j<5; j++) {
                float a = float(j) * 3.14159 / 5.0;
                vec2 dir = vec2(cos(a), sin(a));
                qc += cos(dot(h_p, dir) * 18.0 - t * 4.0);
            }
            qc = qc / 5.0;
            
            float core_dist = length(p);
            float core_mask = smoothstep(0.85, 0.2, core_dist);
            
            // Self-luminous pulsing rings
            float rings = abs(sin(core_dist * 35.0 - t * 10.0));
            rings = smoothstep(0.2, 0.0, rings);
            
            vec3 core_col = neon_palette(qc * 0.5 + 0.5 + t * 0.6);
            // [impossible_colors] Hyperbolic Orange / Self-Luminous Red push
            core_col += vec3(1.0, 0.4, 0.0) * rings * 2.5; 
            
            col = mix(col, core_col, core_mask * smoothstep(-0.2, 0.3, qc));
            col += rings * vec3(0.0, 1.0, 0.8) * core_mask * 1.5;
            
            // [codeartstudio / scraped data] Glitch Ticker Bands
            float ticker = step(0.97, sin(p.y * 80.0 + t * 25.0));
            float data = step(0.5, hash22(floor(p * vec2(100.0, 80.0)) + t).x);
            col = mix(col, vec3(1.0, 0.95, 0.4), ticker * data * 0.9);
            
            return col;
        }

        void main() {
            vec2 uv = vUv;
            vec2 p = uv * 2.0 - 1.0;
            float aspect = u_resolution.x / u_resolution.y;
            p.x *= aspect;
            
            float t = u_time * 0.3;
            
            // Mouse Interaction (Gravity Well / Divination Lens)
            vec2 m = u_mouse * 2.0 - 1.0;
            m.x *= aspect;
            float distToMouse = length(p - m);
            vec2 dirToMouse = normalize(p - m + 1e-5);
            p -= dirToMouse * 0.2 * exp(-distToMouse * 3.0) * u_click;
            
            // [chromatic_aberration / prism_dispersion] Lateral CA separation
            float ca_shift = 0.02 * length(p);
            vec3 col;
            col.r = scene(p * (1.0 - ca_shift), t).r;
            col.g = scene(p, t).g;
            col.b = scene(p * (1.0 + ca_shift), t).b;
            
            // [crt_phosphor_fx] Aperture grille Trinitron emulation
            float px = uv.x * u_resolution.x;
            float triad = mod(px, 3.0);
            vec3 mask = vec3(
                smoothstep(1.0, 0.0, abs(triad - 0.5)),
                smoothstep(1.0, 0.0, abs(triad - 1.5)),
                smoothstep(1.0, 0.0, abs(triad - 2.5))
            );
            col *= mix(vec3(1.0), mask, 0.35);
            
            // [cross_processing] Push contrast and saturation
            col = mix(col, smoothstep(0.0, 1.0, col), 0.4);
            
            // Scanlines & Rolling Bar
            float py = uv.y * u_resolution.y;
            float scanline = 0.5 + 0.5 * sin(py * 1.5);
            col *= 1.0 - 0.15 * (1.0 - scanline);
            float barPos = fract(t * 2.0);
            float bar = exp(-pow(uv.y - barPos, 2.0) / 0.005);
            col += col * bar * 0.15;
            
            // Vignette
            col *= 1.0 - 0.35 * dot(uv - 0.5, uv - 0.5);
            
            // Bloom
            col += col * col * 0.35;
            
            // [temporal_desync / saccadic_masking_exploits] Parity flip / mutation clock
            float saccade = smoothstep(0.98, 1.0, sin(t * 15.0));
            col = mix(col, vec3(1.0) - col, saccade * 0.85);
            
            fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Initialization Failed:", e);
    throw e;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  if (material.uniforms.u_mouse) {
    material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - (mouse.y / grid.height));
  }
  if (material.uniforms.u_click) {
    material.uniforms.u_click.value = mouse.isPressed ? 1.0 : 0.0;
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);