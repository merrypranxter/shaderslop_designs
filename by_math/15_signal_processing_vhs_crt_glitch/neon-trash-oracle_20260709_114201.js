if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");
    
    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
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

        // --- MATH & NOISE (Lenia / Cuttlefish) ---
        mat2 rot(float a) { 
            float s = sin(a), c = cos(a); 
            return mat2(c, -s, s, c); 
        }

        float hash21(vec2 p) {
            p = fract(p * vec2(127.1, 311.7));
            p += dot(p, p.yx + 19.19);
            return fract(p.x * p.y);
        }

        float snoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        vec2 fbm2(vec2 p) {
            float f1 = 0.0, f2 = 0.0, amp = 0.5;
            for(int i = 0; i < 4; i++) {
                f1 += amp * snoise(p);
                f2 += amp * snoise(p + vec2(12.3, 45.6));
                p = rot(1.23) * p * 2.0;
                amp *= 0.5;
            }
            return vec2(f1, f2);
        }

        // --- COLOR SYSTEMS (OKLab Hyperpop) ---
        vec3 oklab_to_srgb(vec3 c) {
            float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
            float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
            float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
            float l = l_ * l_ * l_;
            float m = m_ * m_ * m_;
            float s = s_ * s_ * s_;
            vec3 rgb = vec3(
                 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
            );
            return mix(12.92 * rgb, 1.055 * pow(max(rgb, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, rgb));
        }

        vec3 hyperpop_palette(float t) {
            float h = t * 6.28318;
            vec3 lch = vec3(0.75, 0.28 + 0.05 * sin(t * 10.0), h);
            return oklab_to_srgb(vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z)));
        }

        // --- PATTERNS & MOIRÉ ---
        float spiral_moire(vec2 p, float t) {
            float r = length(p);
            float a = atan(p.y, p.x);
            float s1 = sin(a * 7.0 + log(r + 0.01) * 25.0 - t);
            float s2 = sin(a * 7.0 + log(r + 0.01) * 26.0 + t * 1.2);
            return smoothstep(0.2, 0.8, s1 * s2);
        }

        float hexagram_rings(vec2 p, float t) {
            float r = length(p);
            float rings = sin(r * 40.0 - t * 3.0);
            float mask = step(0.0, rings);
            float segments = sin(atan(p.y, p.x) * 12.0 + t);
            return mask * smoothstep(0.0, 0.2, segments);
        }

        float voronoi_bubbles(vec2 x) {
            vec2 p = floor(x);
            vec2 f = fract(x);
            float res = 8.0;
            for(int j = -1; j <= 1; j++)
            for(int i = -1; i <= 1; i++) {
                vec2 b = vec2(float(i), float(j));
                vec2 r = b - f + vec2(hash21(p + b), hash21(p + b + 1.0));
                float d = dot(r, r);
                res = min(res, d);
            }
            return res;
        }

        float data_ticker(vec2 uv, float t) {
            float band = smoothstep(0.95, 0.96, sin(uv.y * 15.0 + t));
            float bits = step(0.5, hash21(floor(uv * vec2(40.0, 15.0)) + floor(t * 12.0)));
            return band * bits;
        }

        // --- DAMAGE & GLITCH (Glitchcore / Prism Dispersion) ---
        vec2 macroblock(vec2 p, float t) {
            vec2 grid = floor(p * 12.0) / 12.0;
            float glitch = step(0.92, hash21(grid + floor(t * 6.0)));
            return mix(p, grid, glitch * 0.4);
        }

        vec3 cauchy_split(vec2 p, float amount) {
            vec2 r_off = p * (0.004 / 0.1444) * amount; // 380nm
            vec2 g_off = p * (0.004 / 0.3025) * amount; // 550nm
            vec2 b_off = p * (0.004 / 0.4900) * amount; // 700nm
            return vec3(r_off.x, g_off.x, b_off.x);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
            vec2 raw_uv = vUv;
            vec2 mouse = (u_mouse * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
            float t = u_time * 0.4;

            // 1. Compression Damage (Macroblocking)
            vec2 p = macroblock(uv, t);

            // 2. Hyperbolic Lens Warping (Mouse interaction)
            vec2 diff = p - mouse;
            float dist = length(diff);
            p -= normalize(diff) * exp(-dist * 4.0) * 0.4;

            // 3. Excitable Slime Field (Lenia / Reaction-diffusion)
            vec2 q = p - fbm2(p * 1.5 + t * 0.5);
            vec2 r = p - fbm2(q * 2.5 - t * 0.3);
            float slime = snoise(r * 3.0);

            // 4. Bubble Territories (Cuttlefish chromatophores / Voronoi)
            float bubbles = voronoi_bubbles(p * 4.0 + slime * 2.0 - t);

            // 5. Oracle Core (Spiral Moiré)
            float core_dist = length(p);
            float moire = spiral_moire(p * (1.0 + slime * 0.3), t);
            
            vec3 col = vec3(0.0);

            // Background: Hyperpop Moiré
            vec3 bg_color = hyperpop_palette(slime * 1.5 - t * 0.1 + bubbles * 0.5);
            col += bg_color * (0.2 + 0.4 * moire);

            // Midground: Doppler Flow & Cell Network
            float flow_vel = snoise(p * 8.0 + t) * 2.0 - 1.0;
            vec3 doppler = flow_vel > 0.0 ? 
                mix(vec3(0.8, 0.1, 0.5), vec3(1.0, 1.0, 0.0), flow_vel) : 
                mix(vec3(0.0, 0.2, 0.8), vec3(0.0, 1.0, 1.0), -flow_vel);
            
            col = mix(col, doppler, smoothstep(0.4, 0.6, slime) * 0.6);
            col += hyperpop_palette(bubbles) * smoothstep(0.8, 1.0, 1.0 - bubbles) * 0.5;

            // Center Core: Hexagram Rings with Cauchy Dispersion
            vec3 offsets = cauchy_split(p, 0.6 * exp(-core_dist * 2.5));
            float r_ring = hexagram_rings(p + vec2(offsets.r, 0.0), t);
            float g_ring = hexagram_rings(p + vec2(offsets.g, 0.0), t);
            float b_ring = hexagram_rings(p + vec2(offsets.b, 0.0), t);
            
            vec3 core_col = vec3(r_ring, g_ring, b_ring);
            float core_mask = exp(-core_dist * 3.5);
            col += core_col * core_mask * 2.5;

            // Foreground: Scraped-Data Ticker Bands
            float tick = data_ticker(raw_uv, t);
            col += tick * hyperpop_palette(raw_uv.y + t);

            // Sparkles / Hot Pixels (Sensor Noise)
            float sparks = step(0.99, hash21(p * 100.0 + t));
            col += sparks * hyperpop_palette(hash21(p)) * 2.0;

            // Post-Processing: CRT Dot Triad + Phosphor Bloom
            vec2 px = gl_FragCoord.xy;
            float cx = mod(px.x, 3.0);
            vec3 mask = vec3(
                smoothstep(1.0, 0.0, abs(cx - 0.5)),
                smoothstep(1.0, 0.0, abs(cx - 1.5)),
                smoothstep(1.0, 0.0, abs(cx - 2.5))
            );
            float cy = fract(px.y / 3.0);
            mask *= smoothstep(0.0, 1.0, sin(cy * 3.14159));
            
            // CRT Rolling Scanline
            float scanline = 1.0 + 0.15 * sin(raw_uv.y * 15.0 - t * 8.0);
            
            col *= mix(vec3(1.0), mask * 2.2, 0.25); 
            col *= scanline;

            // Complementary Burn (Troxler Afterimage)
            vec3 complement = vec3(1.0) - col;
            float burn = smoothstep(0.5, 0.7, slime) * 0.25;
            col += complement * burn;

            // Vignette
            col *= 1.0 - 0.4 * dot(uv, uv);

            fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Init Failed:", e);
    throw e;
  }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  if (material.uniforms.u_mouse) material.uniforms.u_mouse.value.set(mouse.x / grid.width, 1.0 - (mouse.y / grid.height));
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);