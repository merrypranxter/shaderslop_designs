/**
 * CYMATIC LACE RELIQUARY
 * 
 * A synthesis of the provided repo genomes:
 * - [cymatics_sacred]: Heptagram (7-fold) Bessel-like standing waves forming the base topology.
 * - [lace_patterns]: Negative space thresholding (smoothstep over abs()) creating "threads" and "voids".
 * - [rococo_style]: Asymmetric S-scroll domain warping (rocaille motif) applied to the coordinate space.
 * - [moire] & [damage_aesthetics]: RGB Chromatic Separation. Three distinct frequency layers scaled and 
 *   rotated slightly off-axis to create vivid interferential moiré fringes and VHS-style chroma bleed.
 * - [shoegaze_style]: Halation bloom on high-intensity intersections, heavy film grain, and dissolving edges.
 * - [color_systems]: Golden Angle (137.5 deg) phase shifting across color channels.
 */

try {
    if (!ctx) throw new Error("WebGL2 context not available");

    // Initialize Three.js scene only once per canvas
    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize for performance
        
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

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
            uniform float u_isPressed;

            #define PI 3.14159265359
            #define GOLDEN_ANGLE 2.39996323 // 137.508 degrees in radians

            // [damage_aesthetics] & [shoegaze_style]: Film grain noise
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            // [rococo_style]: Asymmetric S-scroll domain warping
            vec2 rocailleWarp(vec2 p, float t) {
                float s1 = sin(p.y * 3.0 + t * 0.7) * cos(p.x * 2.0 - t * 0.4);
                float s2 = cos(p.x * 4.0 - t * 0.5) * sin(p.y * 5.0 + t * 0.6);
                // Introduce slight hyperbolic curvature
                float r = length(p);
                float poincare = 1.0 / (1.0 + r * r * 0.5);
                return p + vec2(s1, s2) * 0.18 * poincare;
            }

            // [cymatics_sacred] & [lace_patterns]: Nodal interference topology
            float cymaticLace(vec2 p, float freq, float t, float symmetry) {
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Faraday/Bessel-like standing wave approximation
                float radial = sin(r * freq - t * 1.5);
                float angular = cos(symmetry * a + t * 0.8);
                
                // Underlying Cartesian grid for structural interference
                float grid = sin(p.x * freq * 0.6) * cos(p.y * freq * 0.6);
                
                float val = radial * angular + grid * 0.4;
                
                // Negative space thresholding: abs() creates the "threads", smoothstep defines thickness
                return smoothstep(0.25, 0.45, abs(val));
            }

            // Custom palette for vivid, saturated acid/neon colors
            vec3 palette(in float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.263, 0.416, 0.557); // Electric blue/cyan base
                return a + b * cos(6.28318 * (c * t + d));
            }

            void main() {
                // Normalize coordinates and fix aspect ratio
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // Mouse interaction: physical perturbation of the cymatic fluid
                vec2 mouse = u_mouse * 2.0 - 1.0;
                mouse.x *= u_resolution.x / u_resolution.y;
                float mouseDist = length(uv - mouse);
                float mouseForce = exp(-mouseDist * 4.0) * u_isPressed;
                
                // Time with local entropy/agitation from mouse
                float t = u_time * 0.4 + mouseForce * sin(u_time * 12.0) * 0.15;
                
                // Apply Rococo Domain Warping & Mouse Repulsion
                vec2 warpedUV = rocailleWarp(uv, t);
                warpedUV -= normalize(uv - mouse + 0.001) * mouseForce * 0.25;
                
                // --- THE MOIRÉ ENGINE (RGB Chromatic Separation) ---
                // [moire] & [color_systems]: Separate channels with scale/rotation offsets
                float freq = 28.0; 
                float sym = 7.0; // Heptagram geometry
                
                // Golden angle scaling and rotation for maximum perceptual interference
                vec2 uvR = warpedUV * 1.00;
                vec2 uvG = warpedUV * 1.015;
                vec2 uvB = warpedUV * 1.030;
                
                mat2 rotG = mat2(cos(0.015), -sin(0.015), sin(0.015), cos(0.015));
                mat2 rotB = mat2(cos(0.030), -sin(0.030), sin(0.030), cos(0.030));
                uvG *= rotG;
                uvB *= rotB;
                
                // Generate lace networks with Golden Angle phase offsets
                float r = cymaticLace(uvR, freq, t, sym);
                float g = cymaticLace(uvG, freq, t + GOLDEN_ANGLE, sym);
                float b = cymaticLace(uvB, freq, t + GOLDEN_ANGLE * 2.0, sym);
                
                vec3 interference = vec3(r, g, b);
                
                // --- COLOR ALCHEMY ---
                // Base fluid color
                vec3 baseColor = palette(length(warpedUV) * 0.4 - t * 0.2);
                
                // Inject hyper-saturated tones based on channel interference
                vec3 finalColor = baseColor * 0.2; // Darken base
                finalColor = mix(finalColor, vec3(1.0, 0.0, 0.4), r);           // Hot Pink
                finalColor = mix(finalColor, vec3(0.0, 1.0, 0.7), g);           // Acid Cyan
                finalColor = mix(finalColor, vec3(0.9, 0.8, 0.1), b * (1.0-r)); // Gilded Gold (Rococo)
                finalColor = mix(finalColor, vec3(0.1, 0.0, 0.8), r * b);       // Deep Violet
                
                // [shoegaze_style]: Halation & Bloom
                // Where all channels align, blow out the highlights with a warm film tint
                float align = r * g * b;
                vec3 bloom = vec3(1.0, 0.85, 0.6) * align * 2.5; 
                finalColor += bloom;
                
                // [damage_aesthetics]: CRT/VHS Phosphor Smear & Grain
                float grain = hash(uv * 1000.0 + vec2(t)) * 0.18;
                finalColor += grain;
                
                // Soft Vignette to dissolve edges into the void
                float vig = 1.0 - smoothstep(0.4, 1.8, length(uv));
                finalColor *= vig;
                
                // Contrast push to exaggerate the moiré fringes
                finalColor = smoothstep(0.0, 1.0, finalColor);
                finalColor = pow(finalColor, vec3(0.85)); 
                
                fragColor = vec4(finalColor, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_isPressed: { value: 0.0 }
            },
            depthWrite: false,
            depthTest: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    // Guard uniform access and update state
    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        
        // Update resolution in case canvas resized
        if (material.uniforms.u_resolution.value.x !== grid.width || 
            material.uniforms.u_resolution.value.y !== grid.height) {
            material.uniforms.u_resolution.value.set(grid.width, grid.height);
            renderer.setSize(grid.width, grid.height, false);
        }

        // Map mouse coordinates to 0.0 - 1.0 range safely
        if (mouse) {
            const mx = Math.max(0, Math.min(1, mouse.x / grid.width));
            const my = Math.max(0, Math.min(1, 1.0 - (mouse.y / grid.height))); // Flip Y for GLSL
            material.uniforms.u_mouse.value.set(mx, my);
            
            // Smoothly interpolate the press state for organic interaction
            const targetPress = mouse.isPressed ? 1.0 : 0.0;
            material.uniforms.u_isPressed.value += (targetPress - material.uniforms.u_isPressed.value) * 0.1;
        }
    }

    renderer.render(scene, camera);

} catch (error) {
    console.error("The Feral Math Engine Failed to Compile:", error);
}