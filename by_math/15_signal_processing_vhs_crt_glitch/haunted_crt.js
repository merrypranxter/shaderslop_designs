try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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
            uniform vec2 u_resolution;

            #define PI 3.14159265359

            // 2D Value Noise for organic static
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
            }

            // Perfect looping noise by sampling a 2D circle in noise space
            float loopNoise(float y, float phase, float scale) {
                vec2 p = vec2(y, 0.0) + vec2(cos(phase), sin(phase)) * scale;
                return vnoise(p);
            }

            // VHS Tracking Tear: horizontal displacement bands drifting upward
            float trackingTear(vec2 uv, float phase, float cycle) {
                float t = cycle;
                
                // Primary thick tear band
                float center1 = fract(t * 2.0);
                float dist1 = min(abs(uv.y - center1), 1.0 - abs(uv.y - center1));
                float mask1 = smoothstep(0.15, 0.0, dist1);
                
                // Secondary thin tear band
                float center2 = fract(t * 3.0 + 0.4);
                float dist2 = min(abs(uv.y - center2), 1.0 - abs(uv.y - center2));
                float mask2 = smoothstep(0.05, 0.0, dist2);
                
                // Chaotic displacement within the bands
                float n1 = loopNoise(uv.y * 40.0, phase, 2.0) - 0.5;
                float n2 = loopNoise(uv.y * 90.0, phase, 3.0) - 0.5;
                
                // Skew the noise to simulate tape drag bias
                n1 = sign(n1) * pow(abs(n1), 1.5) * 3.0;
                
                return mask1 * n1 * 0.08 + mask2 * n2 * 0.15;
            }

            // Scanline generator
            float hlines(vec2 uv, float freq, float offset) {
                float line = abs(fract(uv.y * freq + offset) - 0.5);
                return smoothstep(0.4, 0.0, line); // Soft analog falloff
            }

            // Phosphor dot matrix based on screen resolution
            float phosphor(vec2 uv) {
                vec2 gridScale = u_resolution.xy * 0.3; // Scale dots to screen
                vec2 grid = abs(fract(uv * gridScale) - 0.5);
                return smoothstep(0.4, 0.0, length(grid));
            }

            void main() {
                vec2 uv = vUv;
                
                // 10-second perfect loop timing
                float loopDuration = 10.0;
                float cycle = fract(u_time / loopDuration);
                float phase = cycle * 2.0 * PI;

                // Per-channel vertical jitter (machine hesitation)
                float jR = (loopNoise(10.0, phase, 1.5) - 0.5) * 0.015;
                float jG = (loopNoise(20.0, phase, 1.5) - 0.5) * 0.015;
                float jB = (loopNoise(30.0, phase, 1.5) - 0.5) * 0.015;

                // RGB Separation & Chroma Bleed (horizontal offset)
                vec2 uvR = uv + vec2(0.008, jR);
                vec2 uvG = uv + vec2(0.000, jG);
                vec2 uvB = uv + vec2(-0.008, jB);

                // Apply VHS tracking damage
                uvR.x += trackingTear(uvR, phase, cycle);
                uvG.x += trackingTear(uvG, phase, cycle);
                uvB.x += trackingTear(uvB, phase, cycle);

                // Moiré interference: Two offset horizontal grids
                // Integer multiplier on cycle ensures perfect looping drift
                float off1 = sin(phase) * 4.0 + cycle * 12.0; 
                float off2 = -cos(phase) * 3.0 - cycle * 8.0;
                
                float freq1 = 160.0;
                float freq2 = 164.0; // 4 visible interference bands
                
                float mR = hlines(uvR, freq1, off1) * hlines(uvR, freq2, off2);
                float mG = hlines(uvG, freq1, off1) * hlines(uvG, freq2, off2);
                float mB = hlines(uvB, freq1, off1) * hlines(uvB, freq2, off2);

                // Aggressive tonal push to extract the moiré fringes
                mR = smoothstep(0.05, 0.5, mR);
                mG = smoothstep(0.05, 0.5, mG);
                mB = smoothstep(0.05, 0.5, mB);

                // Phosphor dot bloom (glow expands on bright elements)
                float pR = phosphor(uvR);
                float pG = phosphor(uvG);
                float pB = phosphor(uvB);

                float r = mR + (mR * pR * 2.5);
                float g = mG + (mG * pG * 2.5);
                float b = mB + (mB * pB * 2.5);

                // Palette: Sickly green/cyan/white
                // Suppress red to push overall tone to cyan/green, but allow white peaks
                r *= 0.5;
                g *= 1.2;
                b *= 1.0;

                // Add deep background sickly glow (cathode tube heat)
                float bgGlow = (sin(uv.y * 6.0 - phase * 2.0) * 0.5 + 0.5) * 0.15;
                g += bgGlow;
                b += bgGlow * 0.8;

                // Edge vignette (tube curvature shadow)
                float vig = 1.0 - length(uv - 0.5) * 1.3;
                vig = smoothstep(0.0, 0.7, vig);

                // CRT scanline blanking (subtle high-frequency horizontal darkening)
                float blank = sin(uv.y * u_resolution.y * 1.5) * 0.15 + 0.85;

                fragColor = vec4(r * vig * blank, g * vig * blank, b * vig * blank, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
            },
            vertexShader,
            fragmentShader,
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution.value.x !== grid.width || material.uniforms.u_resolution.value.y !== grid.height) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
        }
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Loop Execution Failed:", e);
}