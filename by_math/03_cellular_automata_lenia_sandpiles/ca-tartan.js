try {
    if (!ctx) throw new Error("WebGL2 context not available");

    const NUM_CELLS = 128; // Number of threads in the weave

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // CA State Arrays
        const stateX = new Uint8Array(NUM_CELLS);
        const stateY = new Uint8Array(NUM_CELLS);
        const ageX = new Uint8Array(NUM_CELLS);
        const ageY = new Uint8Array(NUM_CELLS);
        
        // Initial seeds
        stateX[Math.floor(NUM_CELLS / 2)] = 1;
        stateY[Math.floor(NUM_CELLS / 2)] = 1;

        // Texture Data
        const dataX = new Uint8Array(NUM_CELLS * 4);
        const dataY = new Uint8Array(NUM_CELLS * 4);

        const texX = new THREE.DataTexture(dataX, NUM_CELLS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
        texX.minFilter = THREE.NearestFilter;
        texX.magFilter = THREE.NearestFilter;
        
        const texY = new THREE.DataTexture(dataY, NUM_CELLS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
        texY.minFilter = THREE.NearestFilter;
        texY.magFilter = THREE.NearestFilter;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_res: { value: new THREE.Vector2(grid.width, grid.height) },
                u_texX: { value: texX },
                u_texY: { value: texY },
                u_cells: { value: NUM_CELLS }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                in vec2 vUv;
                out vec4 fragColor;
                
                uniform float u_time;
                uniform vec2 u_res;
                uniform sampler2D u_texX;
                uniform sampler2D u_texY;
                uniform float u_cells;

                // Hash function for fibers
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    // Slight fabric warp/distortion
                    vec2 warp = vec2(
                        sin(vUv.y * 10.0 + u_time * 0.5) * 0.01,
                        cos(vUv.x * 12.0 - u_time * 0.4) * 0.01
                    );
                    vec2 uv = vUv + warp;
                    
                    // Thread coordinates
                    vec2 tCoord = uv * u_cells;
                    vec2 tIdx = floor(tCoord);
                    vec2 tFract = fract(tCoord);
                    
                    // Sample the 1D CA textures
                    vec4 caX = texture(u_texX, vec2(tIdx.x / u_cells, 0.5));
                    vec4 caY = texture(u_texY, vec2(tIdx.y / u_cells, 0.5));
                    
                    // Decode states (r = state, g = age)
                    float sX = caX.r; float aX = caX.g;
                    float sY = caY.r; float aY = caY.g;

                    // Weave Logic: over/under pattern
                    float weaveBase = mod(tIdx.x + tIdx.y, 2.0);
                    // Computational punk glitch: weave inverts based on CA state overlap
                    if (sX > 0.5 && sY > 0.5) {
                        weaveBase = step(0.5, hash(tIdx + floor(u_time * 2.0)));
                    }
                    bool isXTop = weaveBase < 1.0;

                    // Thread 3D Profiles (Normals & Heights)
                    vec2 uvC = tFract - 0.5;
                    float hX = cos(uvC.y * 3.14159);
                    float hY = cos(uvC.x * 3.14159);
                    
                    vec3 normX = normalize(vec3(0.0, -sin(uvC.y * 3.14159), 1.0));
                    vec3 normY = normalize(vec3(-sin(uvC.x * 3.14159), 0.0, 1.0));
                    
                    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
                    float diffX = max(dot(normX, lightDir), 0.0) * 0.8 + 0.2;
                    float diffY = max(dot(normY, lightDir), 0.0) * 0.8 + 0.2;
                    
                    float specX = pow(max(dot(reflect(-lightDir, normX), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);
                    float specY = pow(max(dot(reflect(-lightDir, normY), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);

                    // Fibers (high frequency lines along the thread)
                    float fibX = smoothstep(0.4, 0.6, hash(vec2(tIdx.x, tFract.y * 10.0)));
                    float fibY = smoothstep(0.4, 0.6, hash(vec2(tFract.x * 10.0, tIdx.y)));
                    
                    diffX *= mix(0.7, 1.0, fibX);
                    diffY *= mix(0.7, 1.0, fibY);

                    // Palettes (Acidic Neon)
                    vec3 cElectricBlue = vec3(0.0, 0.8, 1.0);
                    vec3 cHotPink      = vec3(1.0, 0.0, 0.4);
                    vec3 cAcidGreen    = vec3(0.7, 1.0, 0.0);
                    vec3 cNeonYellow   = vec3(1.0, 0.9, 0.0);
                    vec3 cViolet       = vec3(0.5, 0.0, 1.0);
                    vec3 cDark         = vec3(0.05, 0.0, 0.1);

                    // X Thread Color
                    vec3 colX = mix(cElectricBlue, cHotPink, sX);
                    colX = mix(colX, cAcidGreen, aX);
                    // Pulsing wave
                    colX *= 0.8 + 0.4 * sin(tIdx.x * 0.2 - u_time * 3.0);

                    // Y Thread Color
                    vec3 colY = mix(cViolet, cNeonYellow, sY);
                    colY = mix(colY, cElectricBlue, aY);
                    // Pulsing wave
                    colY *= 0.8 + 0.4 * sin(tIdx.y * 0.2 + u_time * 2.5);

                    // Apply Shading
                    colX = colX * diffX + specX * vec3(1.0);
                    colY = colY * diffY + specY * vec3(1.0);

                    // Thread Gaps (Alpha)
                    float alphaX = smoothstep(0.0, 0.15, tFract.y) * smoothstep(1.0, 0.85, tFract.y);
                    float alphaY = smoothstep(0.0, 0.15, tFract.x) * smoothstep(1.0, 0.85, tFract.x);

                    // Layering
                    vec3 finalCol = cDark;
                    if (isXTop) {
                        finalCol = mix(finalCol, colY, alphaY); // Bottom
                        finalCol = mix(finalCol, colX, alphaX); // Top
                    } else {
                        finalCol = mix(finalCol, colX, alphaX); // Bottom
                        finalCol = mix(finalCol, colY, alphaY); // Top
                    }

                    // Luminous Knots at CA overlaps
                    if (sX > 0.5 && sY > 0.5) {
                        float knotDist = length(tFract - 0.5);
                        float glow = exp(-knotDist * 6.0) * (0.8 + 0.5 * sin(u_time * 8.0 + tIdx.x + tIdx.y));
                        finalCol += cNeonYellow * glow * 1.5;
                        
                        // Tiny woven glitch
                        if (hash(tIdx + u_time) > 0.95) {
                            finalCol = vec3(1.0);
                        }
                    }

                    // Moiré Overlap Effect in dense age regions
                    float moire = sin((uv.x + uv.y) * 600.0) * cos((uv.x - uv.y) * 600.0);
                    float density = aX * aY;
                    finalCol += moire * density * 0.25 * cHotPink;

                    // Edge darkening
                    float vignette = 1.0 - length(vUv - 0.5) * 0.8;
                    finalCol *= vignette;

                    fragColor = vec4(finalCol, 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = {
            renderer, scene, camera, material,
            stateX, stateY, ageX, ageY,
            dataX, dataY, texX, texY,
            ruleX: 30, ruleY: 90,
            lastTick: 0,
            tickAccum: 0
        };
    }

    const sys = canvas.__three;
    
    // Handle Resizing
    if (sys.renderer.getSize(new THREE.Vector2()).x !== grid.width || 
        sys.renderer.getSize(new THREE.Vector2()).y !== grid.height) {
        sys.renderer.setSize(grid.width, grid.height, false);
        sys.material.uniforms.u_res.value.set(grid.width, grid.height);
    }

    // Time & CA Update Logic
    sys.material.uniforms.u_time.value = time;
    sys.tickAccum += (time - sys.lastTick);
    sys.lastTick = time;

    // Interaction: Mouse seeds the CA
    if (mouse.isPressed) {
        let mx = Math.floor((mouse.x / grid.width) * NUM_CELLS);
        let my = Math.floor((1.0 - mouse.y / grid.height) * NUM_CELLS);
        if (mx >= 0 && mx < NUM_CELLS) { sys.stateX[mx] = 1; sys.ageX[mx] = 255; }
        if (my >= 0 && my < NUM_CELLS) { sys.stateY[my] = 1; sys.ageY[my] = 255; }
    }

    // Advance 1D Cellular Automata every 0.08 seconds
    if (sys.tickAccum > 0.08) {
        sys.tickAccum = 0;

        // Mutate rules occasionally (Computational Punk behavior)
        if (Math.random() < 0.05) sys.ruleX ^= (1 << Math.floor(Math.random() * 8));
        if (Math.random() < 0.05) sys.ruleY ^= (1 << Math.floor(Math.random() * 8));

        let nextX = new Uint8Array(NUM_CELLS);
        let nextY = new Uint8Array(NUM_CELLS);
        let sumX = 0, sumY = 0;

        for (let i = 0; i < NUM_CELLS; i++) {
            // Update X
            let lx = sys.stateX[(i - 1 + NUM_CELLS) % NUM_CELLS];
            let cx = sys.stateX[i];
            let rx = sys.stateX[(i + 1) % NUM_CELLS];
            let idxX = (lx << 2) | (cx << 1) | rx;
            nextX[i] = (sys.ruleX >> idxX) & 1;
            
            // Feral glitch injection
            if (Math.random() < 0.001) nextX[i] = 1;

            if (nextX[i]) sys.ageX[i] = Math.min(sys.ageX[i] + 15, 255);
            else sys.ageX[i] = Math.max(sys.ageX[i] - 5, 0);
            sumX += nextX[i];

            // Update Y
            let ly = sys.stateY[(i - 1 + NUM_CELLS) % NUM_CELLS];
            let cy = sys.stateY[i];
            let ry = sys.stateY[(i + 1) % NUM_CELLS];
            let idxY = (ly << 2) | (cy << 1) | ry;
            nextY[i] = (sys.ruleY >> idxY) & 1;

            // Feral glitch injection
            if (Math.random() < 0.001) nextY[i] = 1;

            if (nextY[i]) sys.ageY[i] = Math.min(sys.ageY[i] + 15, 255);
            else sys.ageY[i] = Math.max(sys.ageY[i] - 5, 0);
            sumY += nextY[i];
        }

        // Prevent extinction
        if (sumX === 0) nextX[Math.floor(Math.random() * NUM_CELLS)] = 1;
        if (sumY === 0) nextY[Math.floor(Math.random() * NUM_CELLS)] = 1;

        for (let i = 0; i < NUM_CELLS; i++) {
            sys.stateX[i] = nextX[i];
            sys.stateY[i] = nextY[i];

            // Write to texture buffers
            sys.dataX[i * 4 + 0] = sys.stateX[i] * 255;
            sys.dataX[i * 4 + 1] = sys.ageX[i];
            sys.dataX[i * 4 + 2] = 0;
            sys.dataX[i * 4 + 3] = 255;

            sys.dataY[i * 4 + 0] = sys.stateY[i] * 255;
            sys.dataY[i * 4 + 1] = sys.ageY[i];
            sys.dataY[i * 4 + 2] = 0;
            sys.dataY[i * 4 + 3] = 255;
        }

        sys.texX.needsUpdate = true;
        sys.texY.needsUpdate = true;
    }

    sys.renderer.render(sys.scene, sys.camera);

} catch (e) {
    console.error("Cellular Tartan Error:", e);
}