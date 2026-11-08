try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
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

            const vec3 hotPink = vec3(1.0, 0.1, 0.6);
            const vec3 acidLime = vec3(0.6, 1.0, 0.1);
            const vec3 elecCobalt = vec3(0.1, 0.3, 1.0);
            const vec3 deepViolet = vec3(0.3, 0.0, 0.4);

            float grid(vec2 uv, float scale, vec2 offset) {
                vec2 st = uv * scale + offset;
                vec2 g = abs(fract(st) - 0.5);
                return smoothstep(0.3, 0.0, length(g));
            }

            float ringRaw(vec2 uv, float ringFreq, vec2 center, float offset) {
                float r = length(uv - center);
                return sin(r * ringFreq + offset);
            }

            void main() {
                vec2 fragCoord = vUv * u_resolution;
                vec2 uv = (vUv - 0.5) * (u_resolution / u_resolution.y);
                
                // Heartbeat pulse: thump-thump
                float beatTime = u_time * 1.2;
                float beat = fract(beatTime);
                float pulse = exp(-beat * 5.0) + exp(-fract(beatTime + 0.2) * 5.0) * 0.4;
                
                // Spatial distortion linked to the heartbeat
                vec2 muv = uv * (1.0 - pulse * 0.05);
                float rPhase = length(muv) * 8.0 - u_time * 0.8;
                vec2 ruv = muv + vec2(cos(rPhase), sin(rPhase)) * (0.02 + pulse * 0.015);

                // Chromatic moiré offsets
                vec2 offR = vec2(sin(u_time * 0.3), cos(u_time * 0.25)) * 0.1;
                vec2 offG = vec2(cos(u_time * 0.32), sin(u_time * 0.27)) * 0.1;
                vec2 offB = vec2(sin(u_time * 0.35), cos(u_time * 0.29)) * 0.1;
                
                // Rolling radial + square lattice interference (Beat frequencies)
                float r1 = ringRaw(ruv, 180.0, offR, u_time * 3.0);
                float r2 = ringRaw(ruv, 184.0, -offR, -u_time * 2.0);
                float mR = (r1 * r2) * 0.5 + 0.5;
                mR += grid(ruv, 70.0, offR) * 0.6;

                float g1 = ringRaw(ruv, 182.0, offG, u_time * 3.1);
                float g2 = ringRaw(ruv, 186.0, -offG, -u_time * 2.1);
                float mG = (g1 * g2) * 0.5 + 0.5;
                mG += grid(ruv, 70.5, offG) * 0.6;

                float b1 = ringRaw(ruv, 184.0, offB, u_time * 3.2);
                float b2 = ringRaw(ruv, 188.0, -offB, -u_time * 2.2);
                float mB = (b1 * b2) * 0.5 + 0.5;
                mB += grid(ruv, 71.0, offB) * 0.6;
                
                // Contrast push
                mR = smoothstep(0.2, 1.4, mR);
                mG = smoothstep(0.2, 1.4, mG);
                mB = smoothstep(0.2, 1.4, mB);
                
                // LED Subpixel Grid
                float cellSize = 10.0;
                vec2 localUV = fract(fragCoord / cellSize);
                
                float px = localUV.x;
                float py = localUV.y;
                
                // Subpixel triads (R, G, B)
                float maskY = smoothstep(0.05, 0.2, py) * smoothstep(0.95, 0.8, py);
                float maskR = smoothstep(0.05, 0.2, px) * smoothstep(0.33, 0.18, px) * maskY;
                float maskG = smoothstep(0.38, 0.53, px) * smoothstep(0.66, 0.51, px) * maskY;
                float maskB = smoothstep(0.71, 0.86, px) * smoothstep(1.0, 0.85, px) * maskY;
                
                vec3 ledColor = hotPink * mR * maskR + acidLime * mG * maskG + elecCobalt * mB * maskB;
                
                // Phosphor Bloom
                float glowR = smoothstep(0.3, 1.2, mR);
                float glowG = smoothstep(0.3, 1.2, mG);
                float glowB = smoothstep(0.3, 1.2, mB);
                vec3 bloom = (hotPink * glowR + acidLime * glowG + elecCobalt * glowB) * 0.5;
                bloom *= (1.0 + pulse * 1.5); 
                
                // Deep Violet Scan Banding
                float scan = sin(fragCoord.y * 1.2 - u_time * 12.0) * 0.5 + 0.5;
                scan = pow(scan, 2.5);
                
                vec3 finalColor = ledColor * 3.5 + bloom;
                finalColor = mix(finalColor, finalColor + deepViolet * 2.0, scan * 0.5);
                finalColor -= deepViolet * (1.0 - scan) * 0.2;

                // Sensor/CRT Pixel Failure (Dead/Hot pixels)
                float noise = fract(sin(dot(floor(fragCoord/cellSize), vec2(12.9898, 78.233))) * 43758.5453);
                if(noise > 0.998) finalColor *= 0.1; 
                if(noise < 0.002) finalColor += vec3(0.8);

                // Vignette & Final Pulse Multiplication
                float vig = 1.0 - length(uv) * 0.85;
                finalColor *= smoothstep(-0.2, 0.9, vig);
                finalColor *= 0.75 + pulse * 0.4;

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
            fragmentShader
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material?.uniforms?.u_time) {
        material.uniforms.u_time.value = time;
    }
    if (material?.uniforms?.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization or Render Failed:", e);
}