if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("WebGL context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        };
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_feedback: { value: null },
                u_mouse: { value: new THREE.Vector2(0, 0) }
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
                uniform vec2 u_mouse;

                in vec2 vUv;
                out vec4 fragColor;

                // The Glitch Prophet: Hash noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                // Moire as Point: Archimedean Phantom Spiral
                float phantomSpiral(vec2 p, float tightness, float arms, float rot) {
                    float r = length(p);
                    float a = atan(p.y, p.x);
                    // The interference creates radial spokes that appear to spin independently
                    float phase = a * arms + log(r + 0.001) * tightness + rot;
                    return sin(phase);
                }

                void main() {
                    float aspect = u_resolution.x / u_resolution.y;
                    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
                    
                    // 1. Glitchcore Anchor Protection (The "Beauty Zone")
                    vec2 anchorPos = u_mouse;
                    if(length(u_mouse) < 0.01) {
                        // Auto-roaming anchor when mouse is released
                        anchorPos = vec2(sin(u_time * 0.5) * 0.3, cos(u_time * 0.37) * 0.2);
                    }
                    float anchorDist = length(p - anchorPos);
                    float anchor = smoothstep(0.6, 0.05, anchorDist);
                    
                    // 2. Glitchcore: Compression Chew (Macroblock Breakup)
                    float chewIntensity = (1.0 - anchor) * 0.9;
                    vec2 blockUV = floor(vUv * 25.0) / 25.0;
                    float glitchTrigger = hash(blockUV + floor(u_time * 10.0));
                    
                    vec2 distUV = vUv;
                    vec2 distP = p;
                    
                    if (glitchTrigger < chewIntensity * 0.35) {
                        // Packet loss and spatial displacement
                        distP.x += (hash(blockUV * 2.0) - 0.5) * 0.25;
                        distP.y += (hash(blockUV * 3.0) - 0.5) * 0.25;
                        distUV += (vec2(hash(blockUV), hash(blockUV + 1.0)) - 0.5) * 0.08;
                    }
                    
                    // 3. Glitchcore: Channel Split (RGB Displacement)
                    vec2 offsetR = vec2(sin(u_time * 1.1), cos(u_time * 0.8)) * 0.08 * chewIntensity;
                    vec2 offsetG = vec2(cos(u_time * 1.3), sin(u_time * 0.9)) * 0.08 * chewIntensity;
                    vec2 offsetB = vec2(sin(u_time * 0.7), cos(u_time * 1.2)) * 0.08 * chewIntensity;
                    
                    float tightness = 35.0 + sin(u_time * 0.2) * 10.0;
                    float arms = 4.0;
                    
                    // Red Channel Moire
                    float s1R = phantomSpiral(distP + offsetR, tightness, arms, u_time * 2.0);
                    float s2R = phantomSpiral(distP - offsetR, tightness * 1.05, arms, -u_time * 2.2);
                    float mR = smoothstep(0.2, 0.8, s1R * s2R * 0.5 + 0.5);
                    
                    // Green Channel Moire
                    float s1G = phantomSpiral(distP + offsetG, tightness * 1.02, arms, u_time * 2.1);
                    float s2G = phantomSpiral(distP - offsetG, tightness * 1.07, arms, -u_time * 2.3);
                    float mG = smoothstep(0.2, 0.8, s1G * s2G * 0.5 + 0.5);
                    
                    // Blue Channel Moire
                    float s1B = phantomSpiral(distP + offsetB, tightness * 1.04, arms, u_time * 2.2);
                    float s2B = phantomSpiral(distP - offsetB, tightness * 1.09, arms, -u_time * 2.4);
                    float mB = smoothstep(0.2, 0.8, s1B * s2B * 0.5 + 0.5);
                    
                    // 4. Glitchcore Palette: Hyperpop Rupture
                    vec3 hotPink = vec3(1.0, 0.0, 0.5);
                    vec3 electricCyan = vec3(0.0, 1.0, 1.0);
                    vec3 pearlWhite = vec3(1.0, 0.95, 0.95);
                    vec3 deepPurple = vec3(0.05, 0.0, 0.15);
                    
                    vec3 mappedColor = mix(deepPurple, hotPink, mR);
                    mappedColor = mix(mappedColor, electricCyan, mG * (1.0 - mR));
                    mappedColor = mix(mappedColor, pearlWhite, mB * mR);
                    
                    // Clean Anchor Overwrite (Mathematical precision in the beauty zone)
                    float cleanS1 = phantomSpiral(p - anchorPos, tightness, arms, u_time * 2.0);
                    float cleanS2 = phantomSpiral(p - anchorPos, tightness, arms, -u_time * 2.0);
                    float cleanMoire = smoothstep(0.4, 0.6, cleanS1 * cleanS2 * 0.5 + 0.5);
                    vec3 cleanColor = mix(deepPurple, pearlWhite, cleanMoire);
                    
                    mappedColor = mix(mappedColor, cleanColor, anchor);
                    
                    // 5. Temporal Feedback (Moiré as Memory / Ghost Frame Stack)
                    vec2 flow = vec2(hash(distP) - 0.5, hash(distP + 1.0) - 0.5) * 0.015 * chewIntensity;
                    vec2 feedbackUV = distUV + flow + (distUV - 0.5) * -0.005; 
                    
                    // Chromatic Phase Lag in Feedback
                    float fbR = texture(u_feedback, feedbackUV + vec2(0.004, 0.0)).r;
                    float fbG = texture(u_feedback, feedbackUV).g;
                    float fbB = texture(u_feedback, feedbackUV - vec2(0.004, 0.0)).b;
                    vec3 prevFrame = vec3(fbR, fbG, fbB);
                    
                    // Stutter Echo Trigger
                    float stutter = step(0.95, hash(vec2(floor(u_time * 5.0), 1.0)));
                    float decay = mix(0.85, 0.97, stutter);
                    decay *= (1.0 - anchor * 0.7); // Less ghosting in the protected center
                    
                    vec3 finalColor = mix(mappedColor, prevFrame, decay);
                    
                    // 6. UI Debris & Bloom Contamination
                    float uiStrip = step(0.99, hash(vec2(floor(vUv.y * 50.0), floor(u_time * 4.0))));
                    if (uiStrip > 0.0 && hash(vec2(u_time)) > 0.4) {
                        finalColor = mix(finalColor, electricCyan, 0.7 * chewIntensity);
                    }
                    
                    float luma = dot(finalColor, vec3(0.299, 0.587, 0.114));
                    finalColor += hotPink * smoothstep(0.6, 1.0, luma) * 0.4 * chewIntensity;
                    
                    // 7. Scanline & Quantization Banding (Codec Damage)
                    float scanline = sin(vUv.y * 800.0) * 0.05;
                    finalColor -= scanline * chewIntensity;
                    
                    // Simulate 8-bit compression depth
                    finalColor = floor(finalColor * 24.0) / 24.0;
                    
                    fragColor = vec4(finalColor, 1.0);
                }
            `
        });
        
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        
        const finalScene = new THREE.Scene();
        const finalMaterial = new THREE.ShaderMaterial({
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
                void main() {
                    fragColor = texture(tDiffuse, vUv);
                }
            `
        });
        const finalMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMaterial);
        finalScene.add(finalMesh);
        
        renderer.setRenderTarget(rtA);
        renderer.clear();
        renderer.setRenderTarget(rtB);
        renderer.clear();
        renderer.setRenderTarget(null);
        
        canvas.__three = { renderer, scene, camera, material, rtA, rtB, finalScene, finalMaterial, width: grid.width, height: grid.height };
    } catch (e) {
        console.error("WebGL Init Failed", e);
        return;
    }
}

const t = canvas.__three;

if (t.width !== grid.width || t.height !== grid.height) {
    t.renderer.setSize(grid.width, grid.height, false);
    t.rtA.setSize(grid.width, grid.height);
    t.rtB.setSize(grid.width, grid.height);
    t.width = grid.width;
    t.height = grid.height;
    
    t.renderer.setRenderTarget(t.rtA);
    t.renderer.clear();
    t.renderer.setRenderTarget(t.rtB);
    t.renderer.clear();
}

t.material.uniforms.u_time.value = time;
t.material.uniforms.u_resolution.value.set(grid.width, grid.height);

const aspect = grid.width / Math.min(grid.width, grid.height);
const normalizedMouseX = ((mouse.x / grid.width) * 2.0 - 1.0) * aspect;
const normalizedMouseY = (-(mouse.y / grid.height) * 2.0 + 1.0) * (grid.height / Math.min(grid.width, grid.height));

if (mouse.isPressed) {
    t.material.uniforms.u_mouse.value.set(normalizedMouseX, normalizedMouseY);
} else {
    t.material.uniforms.u_mouse.value.lerp(new THREE.Vector2(0, 0), 0.05);
}

// Ping-pong Feedback (Temporal Echo & Overprint Stacking)
t.material.uniforms.u_feedback.value = t.rtB.texture;
t.renderer.setRenderTarget(t.rtA);
t.renderer.render(t.scene, t.camera);

// Render composite to screen
t.finalMaterial.uniforms.tDiffuse.value = t.rtA.texture;
t.renderer.setRenderTarget(null);
t.renderer.render(t.finalScene, t.camera);

// Swap buffers
const temp = t.rtA;
t.rtA = t.rtB;
t.rtB = temp;