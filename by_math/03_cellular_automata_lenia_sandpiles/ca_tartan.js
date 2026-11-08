try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    if (!canvas.__three) {
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
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

            uniform vec2 u_resolution;
            uniform float u_time;
            uniform vec2 u_mouse;
            uniform float u_mousePressed;

            const vec3 C_VIOLET = vec3(0.33, 0.0, 1.0);
            const vec3 C_BLUE   = vec3(0.0, 0.94, 1.0);
            const vec3 C_PINK   = vec3(1.0, 0.0, 0.33);
            const vec3 C_GREEN  = vec3(0.66, 1.0, 0.0);
            const vec3 C_YELLOW = vec3(1.0, 1.0, 0.0);
            const vec3 C_WHITE  = vec3(1.0, 1.0, 1.0);

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            int getCA(int x, int t, int rule) {
                int v = 0;
                x = abs(x);
                t = abs(t);
                if (rule == 0) v = x ^ t;
                else if (rule == 1) v = (x | t) ^ (x & t);
                else if (rule == 2) v = (x * 3) ^ (t * 2);
                else v = x ^ (t >> 1);
                return abs(v) % 4;
            }

            vec3 getColor(int state) {
                if (state == 0) return C_VIOLET;
                if (state == 1) return C_BLUE;
                if (state == 2) return C_PINK;
                return C_GREEN;
            }

            void main() {
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 p = (vUv - 0.5) * aspect;

                float t = u_time + sin(u_time * 15.0) * 0.03;

                float warpX = sin(p.y * 12.0 + t) * 0.01 + sin(p.y * 3.0) * 0.02;
                float warpY = cos(p.x * 12.0 - t) * 0.01 + cos(p.x * 3.0) * 0.02;
                p += vec2(warpX, warpY);

                vec2 m = (u_mouse - 0.5) * aspect;
                float dist = length(p - m);
                float mutation = smoothstep(0.5, 0.0, dist) * u_mousePressed;

                float scale = 80.0 + mutation * 20.0;
                vec2 grid = floor(p * scale);
                vec2 local = fract(p * scale);

                float glitch = step(0.995, hash(grid + floor(t * 2.0)));
                if (glitch > 0.0) {
                    grid.x += float(int(hash(grid) * 10.0));
                }

                int tBase = int(mod(t * 5.0, 10000.0));
                int tLocal = tBase + int(mutation * 50.0);

                int ruleX = (int(t * 0.2) + int(mutation * 3.0)) % 4;
                int ruleY = (int(t * 0.3) + 1 + int(mutation * 2.0)) % 4;

                int stateX = getCA(int(grid.x), tLocal, ruleX);
                int stateY = getCA(int(grid.y), tLocal, ruleY);

                float weavePattern = mod(grid.x + grid.y + float(stateX + stateY), 2.0);
                bool over = weavePattern > 0.5;

                float fiberX = abs(sin(local.x * 3.1415)) * sin(local.y * 3.1415 * 8.0);
                float fiberY = abs(sin(local.y * 3.1415)) * sin(local.x * 3.1415 * 8.0);

                float heightX = sin(local.x * 3.1415);
                float heightY = sin(local.y * 3.1415);

                vec3 colX = getColor(stateX);
                vec3 colY = getColor(stateY);

                float pulseX = sin(grid.x * 0.1 - t * 3.0) * 0.5 + 0.5;
                float pulseY = sin(grid.y * 0.1 + t * 4.0) * 0.5 + 0.5;

                colX = mix(colX, C_WHITE, pulseX * 0.4 * float(stateX >= 2));
                colY = mix(colY, C_WHITE, pulseY * 0.4 * float(stateY >= 2));

                vec3 color = vec3(0.0);
                float fibers = 0.0;

                if (over) {
                    color = colY;
                    fibers = fiberY;
                    color *= smoothstep(0.0, 0.3, local.y) * smoothstep(1.0, 0.7, local.y);
                    color -= (1.0 - heightY) * 0.2;
                } else {
                    color = colX;
                    fibers = fiberX;
                    color *= smoothstep(0.0, 0.3, local.x) * smoothstep(1.0, 0.7, local.x);
                    color -= (1.0 - heightX) * 0.2;
                }

                color *= 0.6 + 0.4 * fibers;

                if (stateX >= 2 && stateY >= 2) {
                    float knot = smoothstep(0.5, 0.0, length(local - 0.5));
                    vec3 knotCol = mix(C_YELLOW, C_WHITE, pulseX * pulseY);
                    color = mix(color, knotCol, knot * 0.8);
                    color += knotCol * knot * 1.5; 
                }

                if (stateX + stateY >= 4) {
                    float moire = sin(p.x * 300.0 + t * 10.0) * sin(p.y * 310.0 - t * 8.0);
                    moire = smoothstep(0.7, 1.0, moire);
                    color += C_PINK * moire * (0.3 + mutation * 0.5);
                }

                if (glitch > 0.0) {
                    color = vec3(1.0, color.g, 0.0);
                }

                float gap = (1.0 - heightX) * (1.0 - heightY);
                color -= gap * 0.6;

                float vig = length(vUv - 0.5);
                color *= 1.0 - vig * 0.5;

                fragColor = vec4(color, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_time: { value: 0 },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_mousePressed: { value: 0.0 }
            }
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
        material.uniforms.u_time.value = time;
        
        const mx = mouse.x / grid.width;
        const my = 1.0 - (mouse.y / grid.height);
        material.uniforms.u_mouse.value.set(mx, my);
        material.uniforms.u_mousePressed.value = mouse.isPressed ? 1.0 : 0.0;
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}