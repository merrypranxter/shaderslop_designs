try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
        renderer.autoClear = false;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const rtOptions = {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping
        };
        
        const rtA = new THREE.WebGLRenderTarget(grid.width, grid.height, rtOptions);
        const rtB = rtA.clone();

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_feedback: { value: null }
            },
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D u_feedback;
                uniform float u_time;
                uniform vec2 u_resolution;
                
                in vec2 vUv;
                out vec4 fragColor;

                #define PI 3.14159265359

                vec2 rotate(vec2 p, float a) {
                    float s = sin(a), c = cos(a);
                    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
                }

                void main() {
                    vec2 uv = (vUv - 0.5) * 2.0;
                    float aspect = u_resolution.x / u_resolution.y;
                    uv.x *= aspect;

                    // Machine Hesitation: stuttering time progression
                    float stutter = floor(u_time * 12.0) / 12.0;
                    float t = mix(u_time, stutter, 0.65);

                    // Read memory buffer
                    vec3 memory = texture(u_feedback, vUv).rgb;
                    float mem_intensity = length(memory);

                    // Holographic Boundary Warp (AdS Scaling)
                    float radius = length(uv);
                    float z = max(0.01, 1.0 - radius * 0.85 + mem_intensity * 0.08);
                    vec2 w_uv = uv / z;

                    // Fungal / Glitch Domain Warp (Infected memory distorts current space)
                    w_uv += vec2(memory.r - memory.b, memory.g - memory.r) * 0.18 * sin(t);

                    // CMYK Moiré Separation (Print Ghost)
                    float t_slow = t * 0.12;
                    vec2 c_uv = rotate(w_uv, t_slow);
                    vec2 m_uv = rotate(w_uv, t_slow + PI/3.0);
                    vec2 y_uv = rotate(w_uv, t_slow + PI*2.0/3.0);

                    // Spiral Phantoms Frequency
                    float freq = 28.0 + sin(t * 0.15) * 14.0;
                    float twist = atan(w_uv.y, w_uv.x) * 5.0 + log(radius + 0.1) * 12.0;

                    float cyan = sin(c_uv.x * freq + twist) * 0.5 + 0.5;
                    float magenta = sin(m_uv.x * (freq * 1.02) + twist) * 0.5 + 0.5;
                    float yellow = sin(y_uv.x * (freq * 1.04) + twist) * 0.5 + 0.5;

                    // Print Artifact: Halftone Screen Crush
                    cyan = smoothstep(0.4, 0.6, cyan);
                    magenta = smoothstep(0.4, 0.6, magenta);
                    yellow = smoothstep(0.4, 0.6, yellow);

                    // Cyberdelic Acid Palette Mapping
                    vec3 color = vec3(0.0);
                    color += vec3(0.0, 1.0, 0.8) * cyan;     // Neon Cyan
                    color += vec3(1.0, 0.0, 0.7) * magenta;  // Electric Magenta
                    color += vec3(0.8, 1.0, 0.0) * yellow;   // Acid Lime

                    // Overprint Burn (Ink Bleed / Misregistration)
                    float overlap = (cyan * magenta) + (magenta * yellow) + (yellow * cyan);
                    color -= overlap * vec3(0.5, 0.15, 0.6);

                    // Temporal Moiré (Memory Feedback / Kaleidoscope Zoom)
                    float fb_angle = 0.01 * sin(t * 0.4);
                    vec2 fb_uv = rotate(vUv - 0.5, fb_angle) * 0.985 + 0.5;

                    // Chromatic Aberration Scan Bend
                    vec2 scan_offset = vec2(0.005 * sin(vUv.y * 60.0 + t * 8.0), 0.0);
                    vec3 fb;
                    fb.r = texture(u_feedback, fb_uv + scan_offset).r;
                    fb.g = texture(u_feedback, fb_uv).g;
                    fb.b = texture(u_feedback, fb_uv - scan_offset).b;

                    // Fungal Blooming (Overclocked resonance)
                    if (length(fb) > 1.7) {
                        fb *= 0.82;
                        fb.g += 0.2; // Spore injection
                    }

                    // Radial Decay (Preserve central entanglement, fade edges)
                    float decay = mix(0.96, 0.75, smoothstep(0.3, 1.3, radius));
                    vec3 finalColor = mix(color, fb, decay);

                    // Xerox Noise / Grain Artifacts
                    float grain = fract(sin(dot(vUv * (t+1.0), vec2(12.9898, 78.233))) * 43758.5453);
                    finalColor += (grain - 0.5) * 0.18;

                    fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
                }
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material, rtA, rtB, ping: true };
    }

    const { renderer, scene, camera, material, rtA, rtB } = canvas.__three;

    if (rtA.width !== grid.width || rtA.height !== grid.height) {
        renderer.setSize(grid.width, grid.height, false);
        rtA.setSize(grid.width, grid.height);
        rtB.setSize(grid.width, grid.height);
        if (material?.uniforms?.u_resolution) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
        }
    }

    if (material?.uniforms?.u_time) {
        material.uniforms.u_time.value = time;
    }

    const readBuffer = canvas.__three.ping ? rtA : rtB;
    const writeBuffer = canvas.__three.ping ? rtB : rtA;

    if (material?.uniforms?.u_feedback) {
        material.uniforms.u_feedback.value = readBuffer.texture;
    }

    renderer.setRenderTarget(writeBuffer);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    canvas.__three.ping = !canvas.__three.ping;

} catch (e) {
    console.error("Feral Moiré Initialization Failed:", e);
}