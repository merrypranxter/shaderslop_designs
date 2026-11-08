const initSoupShader = (ctx, grid, time, canvas, THREE) => {
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
                        gl_Position = vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    precision highp float;

                    uniform vec2 u_resolution;
                    uniform float u_time;

                    in vec2 vUv;
                    out vec4 fragColor;

                    #define PI 3.14159265359
                    #define GOLDEN_ANGLE 2.39996322973

                    float hash12(vec2 p) {
                        vec3 p3  = fract(vec3(p.xyx) * .1031);
                        p3 += dot(p3, p3.yzx + 33.33);
                        return fract((p3.x + p3.y) * p3.z);
                    }

                    vec2 hash22(vec2 p) {
                        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
                        p3 += dot(p3, p3.yzx+33.33);
                        return fract((p3.xx+p3.yz)*p3.zy);
                    }

                    float noise(vec2 p) {
                        vec2 i = floor(p);
                        vec2 f = fract(p);
                        vec2 u = f*f*(3.0-2.0*f);
                        return mix(mix(hash12(i + vec2(0.0,0.0)), hash12(i + vec2(1.0,0.0)), u.x),
                                   mix(hash12(i + vec2(0.0,1.0)), hash12(i + vec2(1.0,1.0)), u.x), u.y);
                    }

                    float fbm(vec2 p) {
                        float v = 0.0;
                        float a = 0.5;
                        mat2 rot = mat2(0.87758, 0.47943, -0.47943, 0.87758);
                        for (int i = 0; i < 5; i++) {
                            v += a * noise(p);
                            p = rot * p * 2.0 + vec2(10.5);
                            a *= 0.5;
                        }
                        return v;
                    }

                    vec3 voronoi(vec2 x) {
                        vec2 n = floor(x);
                        vec2 f = fract(x);
                        float F1 = 8.0, F2 = 8.0;
                        vec2 id = vec2(0.0);
                        for(int j=-1; j<=1; j++)
                        for(int i=-1; i<=1; i++) {
                            vec2 g = vec2(float(i),float(j));
                            vec2 o = hash22(n + g);
                            o = 0.5 + 0.5*sin(u_time*0.5 + 6.2831*o); 
                            vec2 r = g - f + o;
                            float d = dot(r,r);
                            if(d < F1) {
                                F2 = F1;
                                F1 = d;
                                id = n + g;
                            } else if(d < F2) {
                                F2 = d;
                            }
                        }
                        return vec3(sqrt(F1), sqrt(F2), hash12(id));
                    }

                    vec3 oklch_to_srgb(float L, float C, float h) {
                        float a = C * cos(h);
                        float b = C * sin(h);
                        float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
                        float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
                        float s_ = L - 0.0894841775 * a - 1.2914855480 * b;
                        float l = l_*l_*l_;
                        float m = m_*m_*m_;
                        float s = s_*s_*s_;
                        vec3 rgb = vec3(
                             4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
                        );
                        rgb = clamp(rgb, 0.0, 1.0);
                        vec3 srgb;
                        srgb.r = rgb.r <= 0.0031308 ? 12.92 * rgb.r : 1.055 * pow(rgb.r, 1.0/2.4) - 0.055;
                        srgb.g = rgb.g <= 0.0031308 ? 12.92 * rgb.g : 1.055 * pow(rgb.g, 1.0/2.4) - 0.055;
                        srgb.b = rgb.b <= 0.0031308 ? 12.92 * rgb.b : 1.055 * pow(rgb.b, 1.0/2.4) - 0.055;
                        return srgb;
                    }

                    vec4 evaluateSoup(vec2 p) {
                        vec2 warp = vec2(fbm(p + u_time*0.2), fbm(p + vec2(5.2, 1.3) - u_time*0.2));
                        vec2 wp = p + 1.0 * warp;
                        
                        vec3 v = voronoi(wp * 2.5);
                        float f1 = v.x;
                        float f2 = v.y;
                        float cellId = v.z;
                        float plateau = f2 - f1; 
                        
                        float lenia = exp(-pow(f1 - 0.3, 2.0)/0.02) + 0.5 * exp(-pow(f1 - 0.6, 2.0)/0.01);
                        
                        float grains = floor(f1 * 10.0 + cellId * 5.0 - u_time * 1.5);
                        float topple = fract(grains * 0.25); 
                        
                        float ridge = 1.0 - abs(2.0 * fbm(wp * 5.0) - 1.0);
                        float vascular = pow(ridge, 4.0);
                        float anastomosis = smoothstep(0.05, 0.1, vascular) - smoothstep(0.1, 0.2, vascular);
                        
                        uint ux = uint(abs(p.x * 30.0));
                        uint uy = uint(abs(p.y * 30.0));
                        float xor_val = float(ux ^ uy) / 255.0;
                        
                        float depth = f1 + vascular * 0.3 - plateau * 0.2 + lenia * 0.2;
                        float energy = topple + xor_val * 0.1 + anastomosis;
                        
                        return vec4(depth, plateau, vascular, energy);
                    }

                    vec3 mapColor(vec4 state, vec2 uv_coord) {
                        float depth = state.x;
                        float plateau = state.y;
                        float vascular = state.z;
                        float energy = state.w;
                        
                        float normDepth = clamp(depth, 0.0, 1.0);
                        float baseHue = mix(4.6, 0.0, normDepth); 
                        float hue = baseHue - energy * GOLDEN_ANGLE + u_time * 0.2;
                        
                        float chroma = 0.3 + 0.1 * sin(plateau * 15.0 + u_time);
                        float lightness = 0.55 + 0.25 * sin(depth * 12.0 - u_time * 2.0);
                        
                        float speckle = hash12(uv_coord * 200.0 + u_time) * smoothstep(0.0, 0.15, plateau);
                        lightness -= speckle * 0.2;
                        
                        if (vascular > 0.6) {
                            lightness += (vascular - 0.6) * 2.5;
                            chroma *= 0.3; 
                        }
                        
                        return oklch_to_srgb(lightness, chroma, hue);
                    }

                    void main() {
                        vec2 uv = vUv;
                        vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * 2.0;
                        
                        float r = length(p);
                        vec2 warpedP = p * (1.0 + 0.2 * sin(r * 10.0 - u_time * 2.0));
                        
                        vec2 center = vec2(0.0);
                        vec2 dir = normalize(warpedP - center + 1e-5);
                        float dist = length(warpedP - center);
                        float shiftAmount = 0.015 * dist * dist; 
                        
                        vec4 stateBase = evaluateSoup(warpedP);
                        vec4 stateR = evaluateSoup(warpedP + dir * shiftAmount);
                        vec4 stateB = evaluateSoup(warpedP - dir * shiftAmount * 0.5);
                        
                        vec3 colBase = mapColor(stateBase, uv);
                        vec3 colR = mapColor(stateR, uv + dir * shiftAmount);
                        vec3 colB = mapColor(stateB, uv - dir * shiftAmount * 0.5);
                        
                        vec3 finalColor = vec3(colR.r, colBase.g, colB.b);
                        
                        float lumaR = dot(colR, vec3(0.299, 0.587, 0.114));
                        float lumaB = dot(colB, vec3(0.299, 0.587, 0.114));
                        float contrast = abs(lumaR - lumaB);
                        finalColor += vec3(0.6, 0.0, 1.0) * smoothstep(0.1, 0.3, contrast) * 0.8; 
                        
                        float scanline = smoothstep(0.98, 1.0, sin(uv.y * 10.0 - u_time * 3.0));
                        finalColor = mix(finalColor, finalColor * vec3(1.2, 0.5, 2.0), scanline * 0.5);
                        
                        finalColor *= 1.0 - 0.4 * dot(uv - 0.5, uv - 0.5); 
                        
                        fragColor = vec4(finalColor, 1.0);
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
    }
    
    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);
};

initSoupShader(ctx, grid, time, canvas, THREE);