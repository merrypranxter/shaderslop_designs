try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
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

        vec3 c_mag = vec3(1.0, 0.0, 0.8);
        vec3 c_cya = vec3(0.0, 0.9, 1.0);
        vec3 c_lim = vec3(0.7, 1.0, 0.0);
        vec3 c_ora = vec3(1.0, 0.3, 0.0);
        vec3 c_yel = vec3(1.0, 0.9, 0.0);
        vec3 c_wht = vec3(1.0, 1.0, 1.0);
        vec3 c_blk = vec3(0.05, 0.05, 0.08);

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float starWave(vec2 p, float arms, float spiral) {
            float r = length(p);
            float a = atan(p.y, p.x);
            return r * (1.0 - 0.35 * sin(a * arms + r * spiral));
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution.xy;
            
            vec2 gridUv = fract(uv * 2.0);
            vec2 cell = floor(uv * 2.0);
            
            vec2 p = gridUv * 2.0 - 1.0;
            p.x *= u_resolution.x / u_resolution.y; 
            
            float rot1 = u_time * 0.2 * (cell.x + 1.0);
            float rot2 = -u_time * 0.15 * (cell.y + 1.0);
            
            vec2 p1 = mat2(cos(rot1), -sin(rot1), sin(rot1), cos(rot1)) * p;
            vec2 p2 = mat2(cos(rot2), -sin(rot2), sin(rot2), cos(rot2)) * p;
            
            float d1 = starWave(p1, 5.0, 2.0);
            float d2 = starWave(p2, 5.0, -2.0);
            float d3 = starWave(p, 5.0, 0.0);
            
            float scale1 = 25.0 + cell.x * 10.0;
            float scale2 = 28.0 + cell.y * 12.0;
            float scale3 = 22.0 + (cell.x * cell.y) * 15.0;
            
            float w1 = 0.5 + 0.5 * sin(d1 * scale1 - u_time * 3.0);
            float w2 = 0.5 + 0.5 * sin(d2 * scale2 + u_time * 2.5);
            float w3 = 0.5 + 0.5 * sin(d3 * scale3 + u_time * 1.0);
            
            float cleanMoire = (w1 + w2 + w3) / 3.0;
            float moire = cleanMoire + (random(uv + u_time) - 0.5) * 0.1; 
            
            float darkThresh = 0.35;
            float lightThresh = 0.65;
            
            vec3 c_shadow = c_blk;
            vec3 c_bg, c_dot, c_high;
            
            if (cell.x < 0.5 && cell.y < 0.5) {
                c_bg = c_mag; c_dot = c_cya; c_high = c_yel;
            } else if (cell.x > 0.5 && cell.y < 0.5) {
                c_bg = c_cya; c_dot = c_lim; c_high = c_mag;
            } else if (cell.x < 0.5 && cell.y > 0.5) {
                c_bg = c_lim; c_dot = c_ora; c_high = c_wht;
            } else {
                c_bg = c_ora; c_dot = c_yel; c_high = c_cya;
            }
            
            vec3 finalCol = vec3(0.0);
            
            if (moire < darkThresh) {
                finalCol = c_shadow;
            } else if (moire > lightThresh) {
                finalCol = c_high;
            } else {
                float tone = (moire - darkThresh) / (lightThresh - darkThresh);
                float radius = 0.45 * sqrt(1.0 - tone); 
                
                float a = 15.0 * 3.14159 / 180.0;
                mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
                vec2 drift = vec2(sin(u_time * 2.0), cos(u_time * 1.5)) * 2.0;
                vec2 dotP = rot * (gl_FragCoord.xy + drift) / 10.0;
                vec2 dotGrid = fract(dotP);
                float dotDist = length(dotGrid - 0.5);
                
                if (dotDist < radius) {
                    finalCol = c_dot;
                } else {
                    finalCol = c_bg;
                }
            }
            
            float fw = max(fwidth(cleanMoire), 0.001);
            if (abs(moire - darkThresh) < fw * 1.8 || abs(moire - lightThresh) < fw * 1.8) {
                finalCol = c_blk;
            }
            
            float centerDist = length(p);
            if (centerDist < 0.04) {
                finalCol = c_wht;
            } else if (centerDist < 0.06) {
                finalCol = c_blk;
            }
            
            vec2 borderThickness = 12.0 / u_resolution.xy;
            vec2 border = step(borderThickness, gridUv) * step(gridUv, 1.0 - borderThickness);
            if (border.x * border.y == 0.0) {
                finalCol = c_blk;
            }
            
            vec2 outerThickness = 16.0 / u_resolution.xy;
            vec2 outer = step(outerThickness, uv) * step(uv, 1.0 - outerThickness);
            if (outer.x * outer.y == 0.0) {
                finalCol = c_blk;
            }
            
            fragColor = vec4(finalCol, 1.0);
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

    if (material && material.uniforms) {
        if (material.uniforms.u_time) material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}