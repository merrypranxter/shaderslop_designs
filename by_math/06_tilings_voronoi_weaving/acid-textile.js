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
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
      },
      vertexShader: `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;

        #define PI 3.14159265359

        // --- Kleinian / Hyperbolic Math ---
        vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
        vec2 cdiv(vec2 a, vec2 b) { 
            float d = dot(b,b); 
            if(d < 0.00001) d = 0.00001; 
            return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; 
        }
        vec2 mobius(vec2 z, vec2 a, vec2 b, vec2 c, vec2 d) {
            return cdiv(cmul(a, z) + b, cmul(c, z) + d);
        }

        // --- Procedural Noise ---
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
            float f = 0.0; float amp = 0.5;
            for(int i = 0; i < 5; i++) {
                f += amp * noise(p); p *= 2.0; amp *= 0.5;
            }
            return f;
        }
        vec2 random2(vec2 p) {
            return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
        }
        float voronoi(vec2 x) {
            vec2 n = floor(x);
            vec2 f = fract(x);
            float m = 8.0;
            for(int j=-1; j<=1; j++)
            for(int i=-1; i<=1; i++) {
                vec2 g = vec2(float(i),float(j));
                vec2 o = random2(n + g);
                o = 0.5 + 0.5*sin(u_time*0.5 + 6.2831*o);
                vec2 r = g + o - f;
                float d = dot(r,r);
                m = min(m,d);
            }
            return sqrt(m);
        }

        // --- Lisa Frank / Neon Acid Palette ---
        vec3 palette(float t) {
            vec3 a = vec3(0.5, 0.5, 0.5);
            vec3 b = vec3(0.5, 0.5, 0.33);
            vec3 c = vec3(2.0, 1.0, 1.0);
            vec3 d = vec3(0.5, 0.2, 0.25);
            return a + b * cos(6.28318 * (c * t + d));
        }

        void main() {
            vec2 uv = vUv * 2.0 - 1.0;
            uv.x *= u_resolution.x / u_resolution.y;

            // 1. Möbius Transformation (Breathing hyperbolic fabric)
            float t = u_time * 0.2;
            vec2 a = vec2(cos(t), sin(t));
            vec2 b = vec2(sin(t*1.3)*0.5, cos(t*0.7)*0.5);
            vec2 c = vec2(-sin(t*0.8)*0.5, cos(t*1.1)*0.5);
            vec2 d_ = vec2(cos(t*0.5), -sin(t*0.9));
            
            vec2 mz = mobius(uv, a, b, c, d_);
            
            // 2. Weave Generation (Warp & Weft)
            float density = 40.0;
            vec2 grid = mz * density;
            vec2 id = floor(grid);
            vec2 f = fract(grid);
            
            float parity = mod(id.x + id.y, 2.0);
            
            float hw = sin(f.x * PI);
            float hh = sin(f.y * PI);
            if(parity < 0.5) { hw += 0.5; hh -= 0.5; } else { hh += 0.5; hw -= 0.5; }
            
            bool isWarp = hw > hh;
            float mask = isWarp ? smoothstep(0.05, 0.2, f.x)*smoothstep(0.95, 0.8, f.x) 
                                : smoothstep(0.05, 0.2, f.y)*smoothstep(0.95, 0.8, f.y);
                                
            // 3. Ikat Blur (Resist Dye Thread Shift)
            vec2 sampleUV = mz;
            float ikatNoise = fbm(mz * 15.0 + u_time * 0.2);
            if(isWarp) {
                sampleUV.y += ikatNoise * 0.2;
            } else {
                sampleUV.x += ikatNoise * 0.2;
            }
            
            // 4. Shibori & Tie-Dye Patterns
            float angle = atan(sampleUV.y, sampleUV.x);
            float radius = length(sampleUV);
            
            // Spiral Tie-Dye
            float spiral = angle / (2.0*PI) + radius * 1.5 - u_time * 0.1;
            // Accordion fold
            float accordion = abs(fract(sampleUV.x * 3.0 + sampleUV.y * 3.0) - 0.5) * 2.0;
            // Kumo Shibori (radiating spiderweb lines)
            float kumo = sin(angle * 12.0) * 0.5 + 0.5;
            
            float colorIdx = fract(spiral + accordion * 0.3 + kumo * 0.15 + ikatNoise * 0.3);
            
            // Base Dye Color
            vec3 col = palette(colorIdx);
            col = pow(col, vec3(0.6)); // Acidic boost
            
            // 5. Leopard Spots (Lisa Frank signature)
            float v = voronoi(sampleUV * 4.0);
            float spotOutline = smoothstep(0.1, 0.2, v) * smoothstep(0.4, 0.3, v);
            float spotCenter = smoothstep(0.15, 0.0, v);
            col = mix(col, vec3(0.0, 0.0, 0.2), spotOutline); // Dark indigo outline
            col = mix(col, vec3(1.0, 0.0, 0.8), spotCenter);  // Hot pink center
            
            // 6. Batik Crackle Networks
            float crackleNoise = fbm(sampleUV * 25.0 - u_time * 0.05);
            float crackle = smoothstep(0.48, 0.5, crackleNoise) * smoothstep(0.52, 0.5, crackleNoise);
            col = mix(col, vec3(0.1, 0.0, 0.2), crackle); // Dark crackle veins
            
            // 7. Kirlian Discharge (Fractal Plasma Branches)
            vec2 k_uv = sampleUV * 2.0;
            float discharge = 0.0;
            for(int i=0; i<4; i++) {
                float k_d = dot(k_uv, k_uv);
                if(k_d < 0.00001) k_d = 0.00001;
                k_uv = abs(k_uv) / k_d - vec2(0.55);
                discharge += length(k_uv);
            }
            float spark = smoothstep(0.95, 1.0, sin(discharge * 3.0 - u_time * 5.0));
            vec3 plasmaCol = mix(vec3(0.8, 0.2, 1.0), vec3(0.2, 0.8, 1.0), clamp(discharge*0.1, 0.0, 1.0));
            col += spark * plasmaCol * 3.0; // Glowing corona on the fabric
            
            // 8. Thread Shading (Physical volume)
            vec2 grad = isWarp ? vec2(cos(f.x*PI)*PI, 0.0) : vec2(0.0, cos(f.y*PI)*PI);
            vec3 normal = normalize(vec3(grad, 2.0));
            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.5));
            float diff = max(0.0, dot(normal, lightDir));
            float spec = pow(max(0.0, dot(reflect(-lightDir, normal), vec3(0,0,1))), 20.0);
            
            float threadTex = fbm(sampleUV * 200.0);
            col = col * (diff * 0.7 + 0.3) + spec * 0.5;
            col *= mix(0.85, 1.15, threadTex);
            
            // 9. Void / Stars Background
            vec2 bgUV = uv * 10.0 + vec2(u_time * 0.5, u_time * 0.2);
            vec2 f_bg = fract(bgUV) - 0.5;
            float d_bg = length(f_bg);
            float a_bg = atan(f_bg.y, f_bg.x);
            float starShape = cos(a_bg * 4.0) * 0.1 + 0.15;
            float star = smoothstep(starShape, starShape - 0.02, d_bg);
            float starTwinkle = sin(u_time * 5.0 + floor(bgUV.x)*10.0 + floor(bgUV.y)*20.0) * 0.5 + 0.5;
            vec3 bg = vec3(0.05, 0.0, 0.15); // Deep purple space
            bg += star * starTwinkle * vec3(1.0, 0.8, 1.0); // Glittery stars
            
            // Attenuate by mask and distance to hide mobius poles
            float fade = smoothstep(20.0, 5.0, length(mz)); 
            mask *= fade;
            
            fragColor = vec4(mix(bg, col, mask), 1.0);
        }
      `
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Init Failed", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;
if (material && material.uniforms && material.uniforms.u_time) {
  material.uniforms.u_time.value = time;
}
if (material && material.uniforms && material.uniforms.u_resolution) {
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);