if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL2 context not available");

        const renderer = new THREE.WebGLRenderer({ 
            canvas, 
            context: ctx, 
            alpha: true, 
            antialias: true,
            preserveDrawingBuffer: true 
        });
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const vertexShader = `
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            in vec2 vUv;
            out vec4 fragColor;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_seed;
            uniform float u_distortion;

            #define MAX_ITER 150
            #define BAILOUT 256.0
            #define PI 3.14159265359
            #define TAU 6.28318530718

            // Complex multiplication
            vec2 cmul(vec2 a, vec2 b) { 
                return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); 
            }

            // Acid / Cyberdelic Neon Palette Generator
            vec3 palette(float t) {
                vec3 a = vec3(0.5);
                vec3 b = vec3(0.5);
                vec3 c = vec3(1.0);
                vec3 d = vec3(0.1, 0.4, 0.7) + u_seed;
                
                vec3 col = a + b * cos(TAU * (c * t + d));
                
                // Boost saturation for that "candy-acid" look
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                col = mix(vec3(luma), col, 1.6);
                return clamp(col, 0.0, 1.0);
            }

            // Julia Iteration Engine with Orbit Traps & Distance Estimation
            float getJulia(vec2 z, vec2 c, out float trap, out float de, out float moire) {
                trap = 1e20;
                vec2 dz = vec2(1.0, 0.0);
                float smooth_n = 0.0;
                float r2 = 0.0;

                // Moving trap points for "living organism" feel
                vec2 trap_pt = vec2(sin(u_time*0.4)*0.5, cos(u_time*0.6)*0.5);

                for(int i = 0; i < MAX_ITER; i++) {
                    // DE derivative update
                    dz = 2.0 * cmul(z, dz);
                    // Core Julia math
                    z = cmul(z, z) + c;
                    
                    r2 = dot(z,z);

                    // Alien Floral Orbit Trap
                    float theta = atan(z.y, z.x);
                    float r = length(z);
                    float petals = abs(sin(theta * 5.0 + r * 3.0 - u_time * 2.0));
                    float d1 = length(z - trap_pt);
                    float d2 = r * (petals + 0.1);
                    
                    trap = min(trap, min(d1, d2));

                    if(r2 > BAILOUT) {
                        float log_zn = log(r2) * 0.5;
                        float nu = log(log_zn / log(2.0)) / log(2.0);
                        smooth_n = float(i) + 1.0 - nu;
                        
                        // Distance estimator for crisp edge halos
                        de = sqrt(r2 / dot(dz,dz)) * log_zn;
                        
                        // Op-art contour striping based on smooth iteration
                        moire = sin(smooth_n * 12.0 - u_time * 6.0);
                        return smooth_n;
                    }
                }
                
                de = 0.0;
                // Interior fluid ripples
                moire = sin(length(z) * 40.0 - u_time * 4.0);
                return 0.0;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;

                // Slow hypnotic rotation
                float rot = u_time * 0.05;
                mat2 mRot = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
                uv = mRot * uv;

                // Fluid distortion ripples (amplified by mouse press)
                float ripple = sin(length(uv) * 8.0 - u_time * 3.0) * 0.03 * (1.0 + u_distortion * 2.0);
                uv += normalize(uv) * ripple;

                // The Sentient Weather System: animating parameter 'c'
                float t = u_time * 0.15;
                vec2 c = vec2(
                    0.35 * cos(t * 1.3) - 0.15 * cos(t * 3.7),
                    0.35 * sin(t * 1.3) - 0.15 * sin(t * 3.7)
                );
                
                // Interactive exploration via mouse
                c += (u_mouse - 0.5) * 0.5;

                // Breathing zoom drift
                float zoom = 1.2 + sin(u_time * 0.2) * 0.15;
                uv *= zoom;

                vec3 finalColor = vec3(0.0);

                // Chromatic Aberration as Structure
                // The fractal diverges differently for R, G, B channels
                float shift = 0.006 + length(uv) * 0.01 * (1.0 + u_distortion);
                vec2 offsets[3];
                offsets[0] = vec2(shift, 0.0);   // Red shifted right
                offsets[1] = vec2(0.0, 0.0);     // Green centered
                offsets[2] = vec2(-shift, 0.0);  // Blue shifted left

                for(int i = 0; i < 3; i++) {
                    float trap, de, moire;
                    float n = getJulia(uv + offsets[i], c, trap, de, moire);

                    if(n > 0.0) {
                        float norm_n = n / float(MAX_ITER);

                        // Base recursive color
                        vec3 col = palette(norm_n * 3.0 - u_time * 0.3);

                        // Moiré interference bands (Op-art contouring)
                        float band = smoothstep(0.1, 0.5, moire) * smoothstep(0.9, 0.5, moire);
                        col = mix(col, vec3(0.02, 0.0, 0.08), band * 0.8);

                        // Reaction-diffusion-like bloom (Orbit Trap)
                        float glow = exp(-trap * 2.5);
                        col += palette(norm_n + 0.4) * glow * 2.0;

                        // Crystalline edge halos (Distance Estimation)
                        float edge = exp(-de * 90.0);
                        col += vec3(1.0, 0.9, 1.0) * edge * 2.5;

                        finalColor[i] = col[i];
                    } else {
                        // Interior void texture
                        float pulse = sin(u_time * 1.5) * 0.5 + 0.5;
                        finalColor[i] = mix(0.0, 0.15, pulse + moire * 0.1);
                    }
                }

                // VHS/CRT Shimmer & Scanlines
                float scanline = sin(vUv.y * u_resolution.y * PI * 0.5) * 0.06;
                finalColor -= scanline;

                // Digital noise / Quantum dust
                float noise = fract(sin(dot(vUv + u_time, vec2(12.9898, 78.233))) * 43758.5453);
                finalColor += (noise - 0.5) * 0.07;

                // Atmospheric vignette
                float vig = length(vUv - 0.5);
                finalColor *= smoothstep(0.85, 0.2, vig);

                // High-energy contrast pop
                finalColor = pow(clamp(finalColor, 0.0, 1.0), vec3(0.85));

                fragColor = vec4(finalColor, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2() },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_seed: { value: Math.random() * 100.0 },
                u_distortion: { value: 0.0 }
            },
            vertexShader,
            fragmentShader
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
        canvas.__state = {
            seed: Math.random() * 100.0,
            paused: false,
            internalTime: time,
            lastTime: time,
            distortion: 0.0,
            targetDistortion: 0.0,
            mouseX: 0.5,
            mouseY: 0.5
        };

        if (!canvas.__hasKeyListeners) {
            window.addEventListener('keydown', (e) => {
                if (!canvas.__state) return;
                const key = e.key.toLowerCase();
                
                if (key === 's') {
                    const link = document.createElement('a');
                    link.download = `julia_spectacle_${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                } else if (key === 'r') {
                    canvas.__state.seed = Math.random() * 100.0;
                } else if (e.key === ' ') {
                    e.preventDefault();
                    canvas.__state.paused = !canvas.__state.paused;
                }
            });
            canvas.__hasKeyListeners = true;
        }

    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;
const state = canvas.__state;

if (material && material.uniforms) {
    if (!state.paused) {
        let dt = time - state.lastTime;
        if (dt > 0.1) dt = 0.016; 
        state.internalTime += dt;
    }
    state.lastTime = time;

    let targetX = mouse.x / grid.width;
    let targetY = 1.0 - (mouse.y / grid.height);
    state.mouseX += (targetX - state.mouseX) * 0.08;
    state.mouseY += (targetY - state.mouseY) * 0.08;

    state.targetDistortion = mouse.isPressed ? 1.0 : 0.0;
    state.distortion += (state.targetDistortion - state.distortion) * 0.1;

    material.uniforms.u_time.value = state.internalTime;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    material.uniforms.u_mouse.value.set(state.mouseX, state.mouseY);
    material.uniforms.u_seed.value = state.seed;
    material.uniforms.u_distortion.value = state.distortion;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);