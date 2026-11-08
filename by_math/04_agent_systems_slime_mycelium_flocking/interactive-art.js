if (!canvas.__three) {
    try {
        const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
        if (!gl) throw new Error("WebGL 2 not supported or context occupied");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
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
            uniform vec2 u_mouse;
            uniform float u_pressed;
            uniform vec2 u_resolution;
            
            // --- NOISE ---
            vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
            float snoise(vec2 v) {
              const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
              vec2 i  = floor(v + dot(v, C.yy) );
              vec2 x0 = v -   i + dot(i, C.xx);
              vec2 i1;
              i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
              vec4 x12 = x0.xyxy + C.xxzz;
              x12.xy -= i1;
              i = mod(i, 289.0);
              vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
              vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
              m = m*m ; m = m*m ;
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
            
            vec2 random2(vec2 p) {
                return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
            }
            
            float worleyF2minusF1(vec2 p) {
                vec2 i_st = floor(p);
                vec2 f_st = fract(p);
                float m_dist1 = 10.0;
                float m_dist2 = 10.0;
                for (int y= -1; y <= 1; y++) {
                    for (int x= -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x),float(y));
                        vec2 point = random2(i_st + neighbor);
                        point = 0.5 + 0.5*sin(u_time * 0.8 + 6.2831*point);
                        vec2 diff = neighbor + point - f_st;
                        float dist = length(diff);
                        if (dist < m_dist1) {
                            m_dist2 = m_dist1;
                            m_dist1 = dist;
                        } else if (dist < m_dist2) {
                            m_dist2 = dist;
                        }
                    }
                }
                return m_dist2 - m_dist1;
            }
            
            // --- MECHANICS ---
            vec2 kaleidoscope(vec2 uv, float folds) {
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                float sector = 6.2831853 / folds;
                angle = mod(angle, sector);
                if (angle > sector * 0.5) angle = sector - angle;
                return vec2(cos(angle), sin(angle)) * radius;
            }
            
            float chladni(vec2 uv, float m, float n) {
                float pi = 3.14159265;
                float a = cos(n * pi * uv.x) * cos(m * pi * uv.y);
                float b = cos(m * pi * uv.x) * cos(n * pi * uv.y);
                return a - b;
            }
            
            vec2 domainWarp(vec2 p, float strength) {
                vec2 warp1 = vec2(snoise(p * 2.0 + u_time * 0.5), snoise(p * 2.0 - u_time * 0.5 + vec2(5.2, 1.3)));
                vec2 warp2 = vec2(snoise((p + warp1) * 4.0 - u_time), snoise((p + warp1) * 4.0 + u_time + vec2(1.7, 9.2)));
                return p + (warp1 * 0.6 + warp2 * 0.4) * strength;
            }
            
            // --- PALETTES ---
            vec3 getHostColor(float v) {
                vec3 gold = vec3(0.79, 0.66, 0.30);
                vec3 violet = vec3(0.24, 0.0, 0.44);
                vec3 black = vec3(0.04, 0.04, 0.07);
                v = v * 2.0; 
                v = v * 0.5 + 0.5; 
                if(v > 0.5) return mix(violet, gold, smoothstep(0.5, 1.0, v));
                return mix(black, violet, smoothstep(0.0, 0.5, v));
            }
            
            vec3 getParasiteColor(float v) {
                vec3 magenta = vec3(1.0, 0.0, 0.8);
                vec3 cyan = vec3(0.0, 1.0, 0.94);
                vec3 lime = vec3(0.67, 1.0, 0.0);
                v = fract(v * 2.0 - u_time * 0.5);
                if(v < 0.333) return mix(magenta, cyan, v * 3.0);
                if(v < 0.666) return mix(cyan, lime, (v - 0.333) * 3.0);
                return mix(lime, magenta, (v - 0.666) * 3.0);
            }
            
            // --- RENDER PASS ---
            vec3 render(vec2 uv, float infection) {
                vec2 centered = uv * 2.0 - 1.0;
                centered.x *= u_resolution.x / u_resolution.y;
                
                vec2 offset = vec2(sin(u_time*0.5), cos(u_time*0.3)) * 0.05;
                vec2 wobbled = centered + offset;
                
                vec2 k_uv = kaleidoscope(wobbled, 8.0);
                vec2 p_uv = domainWarp(centered, 0.5 + infection * 1.5);
                vec2 final_uv = mix(k_uv, p_uv, infection);
                
                float mc = 2.0 + sin(u_time * 0.4) * 1.5;
                float nc = 4.0 + cos(u_time * 0.3) * 1.5;
                
                float c_val = chladni(final_uv * 3.0, mc, nc) * 0.5;
                float w_val = worleyF2minusF1(final_uv * (4.0 + infection * 4.0));
                
                float mixed_val = mix(abs(c_val), w_val, infection);
                
                float edge_noise = snoise(uv * 100.0) * 0.05;
                float edge = smoothstep(0.0, 0.05 + edge_noise, mixed_val);
                
                vec3 host_col = getHostColor(c_val);
                vec3 parasite_col = getParasiteColor(w_val);
                
                vec3 base_col = mix(host_col, parasite_col, infection);
                return base_col * (0.1 + 0.9 * edge);
            }
            
            void main() {
                vec2 uv = vUv;
                vec2 centered = uv * 2.0 - 1.0;
                centered.x *= u_resolution.x / u_resolution.y;
                
                vec2 mouseCentered = u_mouse * 2.0 - 1.0;
                mouseCentered.x *= u_resolution.x / u_resolution.y;
                float distToMouse = length(centered - mouseCentered);
                
                float infectionNoise = snoise(centered * 2.0 - u_time * 0.3) * 0.5 + 0.5;
                float infection = smoothstep(1.2, 0.0, distToMouse) * infectionNoise;
                infection = mix(infection, infectionNoise, u_pressed);
                
                vec2 dir = normalize(centered + 0.001);
                float shift = (0.005 + u_pressed * 0.02) * infection;
                
                float r = render(uv + dir * shift, infection).r;
                float g = render(uv, infection).g;
                float b = render(uv - dir * shift, infection).b;
                
                vec3 col = vec3(r, g, b);
                
                float grain = fract(sin(dot(uv + u_time, vec2(12.9898,78.233))) * 43758.5453);
                float gv = grain * 2.0 - 1.0;
                col = col + gv * (col - col * col) * 0.3;
                
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                float freq = 200.0;
                float rad = 0.785398;
                mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
                vec2 cell = fract(rot * uv * freq) - 0.5;
                float dotRadius = sqrt(1.0 - luma) * 0.6;
                float ht = smoothstep(dotRadius + 0.1, dotRadius - 0.1, length(cell));
                
                vec3 paper = vec3(0.83, 0.77, 0.59);
                vec3 halftone_print = mix(paper, col, ht);
                col = mix(col, halftone_print, infection * 0.8);
                
                float dist = length(centered);
                float vignette = smoothstep(1.6, 0.4, dist);
                col *= vignette;
                
                fragColor = vec4(col, 1.0);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_pressed: { value: 0.0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader,
            fragmentShader
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
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    const targetX = mouse.x / grid.width;
    const targetY = 1.0 - (mouse.y / grid.height);
    
    if (material.uniforms.u_mouse) {
        if (isNaN(material.uniforms.u_mouse.value.x)) {
            material.uniforms.u_mouse.value.set(0.5, 0.5);
        }
        material.uniforms.u_mouse.value.x += (targetX - material.uniforms.u_mouse.value.x) * 0.1;
        material.uniforms.u_mouse.value.y += (targetY - material.uniforms.u_mouse.value.y) * 0.1;
    }
    
    if (material.uniforms.u_pressed) {
        const targetPressed = mouse.isPressed ? 1.0 : 0.0;
        if (isNaN(material.uniforms.u_pressed.value)) material.uniforms.u_pressed.value = 0.0;
        material.uniforms.u_pressed.value += (targetPressed - material.uniforms.u_pressed.value) * 0.1;
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);