if (typeof THREE === 'undefined') {
    return;
}

if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(1);
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const sceneCA = new THREE.Scene();
    const sceneDisplay = new THREE.Scene();
    
    const simRes = 512;
    const rtOptions = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false
    };
    
    const rtA = new THREE.WebGLRenderTarget(simRes, simRes, rtOptions);
    const rtB = new THREE.WebGLRenderTarget(simRes, simRes, rtOptions);
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // --------------------------------------------------------
    // PASS 1: Gray-Scott Reaction-Diffusion (cellular_automata)
    // --------------------------------------------------------
    const caMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tInput: { value: null },
            resolution: { value: new THREE.Vector2(simRes, simRes) },
            mouse: { value: new THREE.Vector2(0, 0) },
            isPressed: { value: 0 },
            time: { value: 0 },
            brushSize: { value: 0.03 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tInput;
            uniform vec2 resolution;
            uniform vec2 mouse;
            uniform float isPressed;
            uniform float time;
            uniform float brushSize;
            varying vec2 vUv;

            void main() {
                vec2 texel = 1.0 / resolution;
                vec2 c = texture2D(tInput, vUv).rg;

                // 3x3 Laplacian kernel
                vec2 lap = -c;
                lap += 0.2 * (
                    texture2D(tInput, vUv + vec2(-texel.x, 0.0)).rg +
                    texture2D(tInput, vUv + vec2(texel.x, 0.0)).rg +
                    texture2D(tInput, vUv + vec2(0.0, -texel.y)).rg +
                    texture2D(tInput, vUv + vec2(0.0, texel.y)).rg
                );
                lap += 0.05 * (
                    texture2D(tInput, vUv + vec2(-texel.x, -texel.y)).rg +
                    texture2D(tInput, vUv + vec2(texel.x, -texel.y)).rg +
                    texture2D(tInput, vUv + vec2(-texel.x, texel.y)).rg +
                    texture2D(tInput, vUv + vec2(texel.x, texel.y)).rg
                );

                // Spatially varying parameters for diverse animal prints (spots, stripes, mazes)
                float f = 0.024 + 0.01 * sin(vUv.x * 6.28);
                float k = 0.055 + 0.01 * cos(vUv.y * 6.28);

                float a = c.r;
                float b = c.g;
                float abb = a * b * b;

                float a_new = a + (1.0 * lap.r - abb + f * (1.0 - a));
                float b_new = b + (0.5 * lap.g + abb - (k + f) * b);

                // Mouse interaction / injection
                if (isPressed > 0.5 && distance(vUv, mouse) < brushSize) {
                    b_new = 1.0;
                }

                // Initial Seed State
                if (time < 0.1) {
                    a_new = 1.0;
                    b_new = 0.0;
                    
                    // Grid of seeds
                    vec2 gridUV = fract(vUv * 8.0);
                    if (length(gridUV - 0.5) < 0.2) b_new = 1.0;
                    
                    // Center Heart Motif
                    vec2 p = (vUv - 0.5) * 2.0;
                    p.y += 0.2;
                    float heart = (p.x * p.x + p.y * p.y - 0.15);
                    heart = heart * heart * heart - p.x * p.x * p.y * p.y * p.y;
                    if (heart < 0.0) b_new = 1.0;
                }

                gl_FragColor = vec4(clamp(a_new, 0.0, 1.0), clamp(b_new, 0.0, 1.0), 0.0, 1.0);
            }
        `
    });
    
    const meshCA = new THREE.Mesh(geometry, caMaterial);
    sceneCA.add(meshCA);

    // --------------------------------------------------------
    // PASS 2: Ditherpunk & Palette Map (pixel_voxel + lisa_frank)
    // --------------------------------------------------------
    const displayMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tInput: { value: null },
            resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            time: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tInput;
            uniform vec2 resolution;
            uniform float time;
            varying vec2 vUv;

            // Bayer 4x4 Dither Matrix (column-major)
            const mat4 bayer4 = mat4(
                0.0, 12.0, 3.0, 15.0,
                8.0, 4.0, 11.0, 7.0,
                2.0, 14.0, 1.0, 13.0,
                10.0, 6.0, 9.0, 5.0
            ) / 16.0;

            vec3 nearestPalette(vec3 col) {
                // Lisa Frank Neon Palette
                vec3 palette[8];
                palette[0] = vec3(1.0, 0.0, 0.8);  // Hot Pink
                palette[1] = vec3(0.0, 1.0, 1.0);  // Cyan
                palette[2] = vec3(1.0, 1.0, 0.0);  // Yellow
                palette[3] = vec3(0.1, 1.0, 0.1);  // Lime
                palette[4] = vec3(0.6, 0.1, 0.9);  // Purple
                palette[5] = vec3(1.0, 0.5, 0.0);  // Orange
                palette[6] = vec3(1.0, 1.0, 1.0);  // White
                palette[7] = vec3(0.05, 0.0, 0.15); // Deep Dark Purple (Outline)

                vec3 best = palette[0];
                float bestDist = 1000.0;
                
                for(int i=0; i<8; i++) {
                    vec3 diff = col - palette[i];
                    // Perceptual YUV-ish distance metric
                    float d = dot(diff * diff, vec3(0.299, 0.587, 0.114));
                    if(d < bestDist) {
                        bestDist = d;
                        best = palette[i];
                    }
                }
                return best;
            }

            void main() {
                float virtualW = 320.0;
                float virtualH = virtualW * (resolution.y / resolution.x);
                vec2 pixelSize = 1.0 / vec2(virtualW, virtualH);
                
                // Domain Warping: Liquid marble effect underneath the grid
                vec2 warpUv = vUv;
                warpUv.x += 0.015 * sin(vUv.y * 15.0 + time * 1.5);
                warpUv.y += 0.015 * cos(vUv.x * 15.0 + time * 1.2);
                
                // Pipeline Step 1: Grid Lock (Pixelate)
                vec2 snappedUV = floor(warpUv / pixelSize) * pixelSize + pixelSize * 0.5;

                float bCenter = texture2D(tInput, snappedUV).g;
                float bnCenter = clamp(bCenter * 3.0, 0.0, 1.0);

                // Rainbow Background Gradient
                vec3 bgCol = vec3(0.5) + 0.5 * cos(6.28318 * (vec3(1.0) * (snappedUV.x - snappedUV.y + time * 0.2) + vec3(0.0, 0.33, 0.67)));
                bgCol = clamp(mix(vec3(dot(bgCol, vec3(0.33))), bgCol, 2.5), 0.0, 1.0);

                // Foreground Animal Motif Gradient
                vec3 fgCol = vec3(0.5) + 0.5 * cos(6.28318 * (vec3(1.0) * (bnCenter * 2.0 - time * 0.5) + vec3(0.5, 0.2, 0.8)));
                fgCol = clamp(mix(vec3(dot(fgCol, vec3(0.33))), fgCol, 2.5), 0.0, 1.0);

                vec3 continuousCol = mix(bgCol, fgCol, smoothstep(0.2, 0.4, bnCenter));

                // Pipeline Step 2: Sobel Edge Detect (Outline)
                float bU = texture2D(tInput, snappedUV + vec2(0.0, pixelSize.y)).g;
                float bD = texture2D(tInput, snappedUV - vec2(0.0, pixelSize.y)).g;
                float bL = texture2D(tInput, snappedUV - vec2(pixelSize.x, 0.0)).g;
                float bR = texture2D(tInput, snappedUV + vec2(pixelSize.x, 0.0)).g;
                
                float bnU = clamp(bU * 3.0, 0.0, 1.0);
                float bnD = clamp(bD * 3.0, 0.0, 1.0);
                float bnL = clamp(bL * 3.0, 0.0, 1.0);
                float bnR = clamp(bR * 3.0, 0.0, 1.0);

                float edge = abs(bnCenter - bnU) + abs(bnCenter - bnD) + abs(bnCenter - bnL) + abs(bnCenter - bnR);
                if (edge > 0.6) {
                    continuousCol = vec3(0.05, 0.0, 0.15); // Hard dark outline
                }

                // Pipeline Step 3: Ordered Dither
                int bx = int(mod(snappedUV.x * virtualW, 4.0));
                int by = int(mod(snappedUV.y * virtualH, 4.0));
                float bayerVal = bayer4[bx][by];
                
                vec3 dithered = continuousCol + (bayerVal - 0.5) * 0.4;
                
                // Pipeline Step 4: Nearest Palette Map
                vec3 finalCol = nearestPalette(clamp(dithered, 0.0, 1.0));

                // Glitch stripe overlay for the "overclocked" vibe
                float glitch = step(0.99, fract(time * 0.5 + snappedUV.y * 5.0));
                if (glitch > 0.5) {
                    finalCol = finalCol.gbr;
                }

                gl_FragColor = vec4(finalCol, 1.0);
            }
        `
    });

    const meshDisplay = new THREE.Mesh(geometry, displayMaterial);
    sceneDisplay.add(meshDisplay);
    
    // Clear targets initially
    renderer.setRenderTarget(rtA);
    renderer.clear();
    renderer.setRenderTarget(rtB);
    renderer.clear();
    renderer.setRenderTarget(null);

    canvas.__three = { renderer, camera, sceneCA, sceneDisplay, caMaterial, displayMaterial, rtA, rtB, pingpong: 0 };
}

const { renderer, camera, sceneCA, sceneDisplay, caMaterial, displayMaterial, rtA, rtB } = canvas.__three;

// Handle canvas resize
renderer.setSize(grid.width, grid.height, false);

// Update Simulation Uniforms
caMaterial.uniforms.time.value = time;
caMaterial.uniforms.isPressed.value = mouse.isPressed ? 1.0 : 0.0;
caMaterial.uniforms.mouse.value.set(mouse.x / grid.width, 1.0 - (mouse.y / grid.height));

displayMaterial.uniforms.time.value = time;
displayMaterial.uniforms.resolution.value.set(grid.width, grid.height);

// Step the Gray-Scott simulation multiple times for visible growth speed
const steps = 12;
for (let i = 0; i < steps; i++) {
    const inputRT = canvas.__three.pingpong % 2 === 0 ? rtA : rtB;
    const outputRT = canvas.__three.pingpong % 2 === 0 ? rtB : rtA;
    
    caMaterial.uniforms.tInput.value = inputRT.texture;
    renderer.setRenderTarget(outputRT);
    renderer.render(sceneCA, camera);
    
    canvas.__three.pingpong++;
}

// Render the final stylized output to the screen
const finalRT = canvas.__three.pingpong % 2 === 0 ? rtA : rtB;
displayMaterial.uniforms.tInput.value = finalRT.texture;

renderer.setRenderTarget(null);
renderer.render(sceneDisplay, camera);