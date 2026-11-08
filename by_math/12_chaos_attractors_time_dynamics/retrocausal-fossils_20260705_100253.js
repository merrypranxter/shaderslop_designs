if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.autoClear = false;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false
        };

        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_feedback: { value: null },
                u_seed: { value: Math.random() * 1000.0 }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;
                uniform sampler2D u_feedback;
                uniform float u_seed;

                in vec2 vUv;
                out vec4 fragColor;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                
                vec3 hash31(float p) {
                    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.xxy + p3.yzz) * p3.zyx); 
                }
                
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }
                
                float fbm(vec2 p) {
                    float f = 0.0;
                    float w = 0.5;
                    for (int i = 0; i < 4; i++) {
                        f += w * noise(p);
                        p *= 2.0;
                        w *= 0.5;
                    }
                    return f;
                }

                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    p.x *= u_resolution.x / u_resolution.y;

                    vec3 color = vec3(0.0);

                    for (int i = 0; i < 16; i++) {
                        vec3 h1 = hash31(float(i) + u_seed);
                        vec3 h2 = hash31(float(i) + u_seed + 12.34);

                        vec2 c = h1.xy * 2.0 - 1.0;
                        c.x *= u_resolution.x / u_resolution.y;
                        c *= 0.8; 

                        float Te = h1.z * 10.0;
                        bool isHero = (i == 0);
                        float R = isHero ? 0.7 : 0.15 + 0.2 * h2.x;
                        float lead = isHero ? 4.0 : 2.5;
                        float tail = isHero ? 2.0 : 1.2;
                        bool isFalse = (!isHero && h2.y > 0.65); 

                        float dt = mod(u_time - Te + 5.0, 10.0) - 5.0;

                        if (dt > -lead && dt < tail) {
                            vec2 dp = p - c;
                            float d = length(dp);
                            float angle = atan(dp.y, dp.x);

                            float fossilAlpha = smoothstep(-lead, -lead + 0.5, dt) * smoothstep(tail, tail - 0.5, dt);
                            if (fossilAlpha > 0.0 && d < R * 1.5) {
                                float n = fbm(dp * (8.0 + 4.0 * h2.y) + h2.z * 10.0);
                                float scar = smoothstep(0.04, 0.0, abs(d - R * n));
                                float burn = smoothstep(0.015, 0.0, abs(d - R));
                                
                                vec3 fosCol = mix(vec3(1.0, 0.1, 0.6), vec3(0.5, 1.0, 0.0), h2.z);
                                color += (scar + burn * 0.4) * fosCol * fossilAlpha * 0.6;
                            }

                            if (dt < 0.0 && dt > -lead) {
                                float prog = -dt / lead; 
                                float inward = d / R;
                                float distToPart = abs(inward - prog);
                                
                                float pShape = sin(angle * (15.0 + 20.0 * h2.x) + inward * 40.0);
                                float part = smoothstep(0.05, 0.0, distToPart) * smoothstep(0.9, 1.0, pShape);
                                
                                color += part * vec3(0.0, 1.0, 1.0) * (1.0 - prog) * 1.5;
                            }

                            if (!isFalse && dt > 0.0 && dt < tail) {
                                float blastProg = dt / tail;
                                
                                float qBits = mix(12.0, 2.0, blastProg);
                                float q = exp2(qBits);
                                vec2 qdp = floor(dp * q) / q;
                                float qd = length(qdp);
                                
                                float membrane = smoothstep(0.06, 0.0, abs(qd - R * blastProg * 2.0));
                                
                                float core = smoothstep(R * (1.0 - blastProg), 0.0, qd);
                                core *= exp(-blastProg * 6.0);
                                
                                vec3 blastCol = mix(vec3(1.0, 1.0, 0.8), vec3(0.3, 0.0, 1.0), blastProg);
                                color += (core + membrane) * blastCol * 2.5;
                                
                                float nanGlitch = step(0.96, hash(qdp * 100.0 + u_time));
                                color += vec3(0.8, 0.0, 1.0) * nanGlitch * core * 4.0;
                                
                                float dust = fbm(qdp * 15.0 - u_time * 2.0) * smoothstep(R * 2.5, R, qd);
                                color += dust * vec3(1.0, 0.4, 0.0) * exp(-blastProg * 4.0);
                            }
                        }
                    }

                    vec4 fb = texture(u_feedback, vUv);
                    vec3 clampedFb = clamp(fb.rgb, 0.0, 1.0);
                    vec3 comp = vec3(1.0) - clampedFb;
                    float intensity = max(clampedFb.r, max(clampedFb.g, clampedFb.b));
                    vec3 ghost = comp * intensity * 0.05;
                    
                    vec3 finalColor = color + fb.rgb * 0.87 + ghost;
                    
                    vec3 voidBg = vec3(0.0, 0.05, 0.15) * fbm(p * 2.0 + u_time * 0.1);
                    finalColor += voidBg * 0.02;

                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        const copyMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: { tDiffuse: { value: null } },
            vertexShader: `
                out vec2 vUv;
                void main() { 
                    vUv = uv; 
                    gl_Position = vec4(position, 1.0); 
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                in vec2 vUv;
                out vec4 fragColor;
                
                vec3 aces(vec3 x) {
                    const float a = 2.51;
                    const float b = 0.03;
                    const float c = 2.43;
                    const float d = 0.59;
                    const float e = 0.14;
                    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
                }
                
                void main() { 
                    vec3 col = texture(tDiffuse, vUv).rgb;
                    fragColor = vec4(aces(col), 1.0); 
                }
            `
        });
        const copyScene = new THREE.Scene();
        copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat));

        canvas.__three = { renderer, scene, camera, material, rtA, rtB, copyScene, copyMat };
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        throw e;
    }
}

const { renderer, scene, camera, material, copyScene, copyMat } = canvas.__three;
let { rtA, rtB } = canvas.__three;

if (rtA.width !== grid.width || rtA.height !== grid.height) {
    rtA.setSize(grid.width, grid.height);
    rtB.setSize(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);

if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    material.uniforms.u_feedback.value = rtA.texture;
}

renderer.setRenderTarget(rtB);
renderer.render(scene, camera);

renderer.setRenderTarget(null);
copyMat.uniforms.tDiffuse.value = rtB.texture;
renderer.render(copyScene, camera);

canvas.__three.rtA = rtB;
canvas.__three.rtB = rtA;