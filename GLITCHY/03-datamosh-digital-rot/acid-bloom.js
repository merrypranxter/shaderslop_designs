if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL 2 context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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

            // Feral hash for tracking noise
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vec2 uv = vUv;
                vec2 st = uv;
                st.x *= u_resolution.x / u_resolution.y;

                // --- 1. THE DAMAGE: TRACKING GLITCH & TEARING ---
                // Group UVs into horizontal bands for VHS-style head-switching/tracking tears
                float scanlineID = floor(uv.y * u_resolution.y / 8.0); 
                
                // Rare but aggressive horizontal shear
                float tearTrigger = step(0.99, hash(vec2(u_time * 0.05, scanlineID)));
                float tearOffset = (hash(vec2(scanlineID, u_time)) - 0.5) * 0.5 * tearTrigger;
                
                vec2 warpedUV = uv;
                warpedUV.x += tearOffset;

                // Rolling black tracking bands (V-Sync loss)
                float rollPhase = fract(warpedUV.y * 1.5 - u_time * 0.4);
                // Sharp primary black bar
                float blackBand = step(0.0, rollPhase) * step(rollPhase, 0.02); 
                // Noisy secondary bar
                float noiseBand = step(0.92, hash(vec2(scanlineID * 0.5, u_time))) * step(0.02, rollPhase) * step(rollPhase, 0.06);
                float totalBlackout = clamp(blackBand + noiseBand, 0.0, 1.0);

                // --- 2. THE SIGNAL: MOIRÉ INTERFERENCE PEAKS ---
                // Using concentric rings from the Moire repo to create spatial beats
                vec2 center1 = vec2(0.5 + sin(u_time * 0.3) * 0.3, 0.5 + cos(u_time * 0.25) * 0.2);
                vec2 center2 = vec2(0.5 - cos(u_time * 0.22) * 0.2, 0.5 - sin(u_time * 0.4) * 0.3);
                
                float r1 = length(st - center1);
                float r2 = length(st - center2);
                
                // High frequency rings
                float ring1 = sin(r1 * 45.0 - u_time * 4.0);
                float ring2 = sin(r2 * 48.0 + u_time * 3.0);
                
                // Multiplicative blending creates difference frequency beats
                float interference = ring1 * ring2;
                
                // Isolate only the absolute peaks for the "acid bloom"
                float peakSignal = smoothstep(0.85, 1.0, interference);
                
                // Add a sweeping high-intensity line
                float sweep = smoothstep(0.02, 0.0, abs(st.x + st.y - fract(u_time * 0.5) * 2.0));
                peakSignal = max(peakSignal, sweep * step(0.95, hash(vec2(u_time, 1.0))));

                // --- 3. THE INFRASTRUCTURE: LED MATRIX BASE ---
                float gridRes = 140.0; // Matrix density
                vec2 gridUV = warpedUV * vec2(gridRes * (u_resolution.x/u_resolution.y), gridRes);
                vec2 cell = fract(gridUV);
                
                // Simulated subpixel geometry (Deep Purple Base = Red + Blue channels active)
                float rSub = step(0.1, cell.x) * step(cell.x, 0.35);
                float bSub = step(0.65, cell.x) * step(cell.x, 0.9);
                float yMask = step(0.1, cell.y) * step(cell.y, 0.9); 
                
                vec3 baseLED = vec3(rSub, 0.0, bSub) * yMask;
                // Blacklight poster base: very dark, highly saturated purple
                vec3 deepPurple = vec3(0.5, 0.0, 0.9) * baseLED * 0.3; 

                // --- 4. THE INFECTION: ACID YELLOW PHOSPHOR BLOOM ---
                // Bloom ignores the hard subpixel mask and creates a soft glowing orb
                vec2 cellCenter = abs(cell - 0.5);
                float dist = length(cellCenter);
                
                // Soft, expansive dot for the bloom
                float bloomDot = 1.0 - smoothstep(0.0, 0.8, dist); 
                vec3 acidYellow = vec3(0.8, 1.0, 0.0);
                
                // Additive bloom applied only where the peak signal lives
                // Overdriven intensity (2.5) to simulate phosphor swelling
                vec3 bloomColor = acidYellow * bloomDot * peakSignal * 2.5;

                // Composite
                vec3 finalColor = deepPurple + bloomColor;

                // CRT Raster / Scanline dimming
                float scanline = sin(warpedUV.y * u_resolution.y * 3.1415) * 0.5 + 0.5;
                finalColor *= mix(0.6, 1.0, scanline);

                // Apply the tracking glitch blackout (cuts through everything, even bloom)
                finalColor *= (1.0 - totalBlackout);

                // Hard vignette to frame the screen
                float vignette = length(uv - 0.5);
                finalColor *= smoothstep(0.8, 0.4, vignette);

                fragColor = vec4(finalColor, 1.0);
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
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms) {
    if (material.uniforms.u_time) material.uniforms.u_time.value = time;
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);