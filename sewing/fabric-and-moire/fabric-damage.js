try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        renderer.setClearColor(0x050505, 1.0);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
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

            #define PI 3.14159265359
            #define PI_5 0.62831853071
            
            // {5,4} Tiling Constants
            // Center of inversion circle: c = cos(PI/4) / sin(PI/5) = 0.707106 / 0.587785 = 1.20299
            // Radius: r = sqrt(c^2 - 1) = 0.66874
            #define C_CENTER vec2(1.20299, 0.0)
            #define C_RADIUS_SQ 0.447213

            // Complex Math
            vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
            vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
            vec2 conj(vec2 z) { return vec2(z.x, -z.y); }
            vec2 mobius_translate(vec2 z, vec2 p) {
                return cdiv(z - p, vec2(1.0, 0.0) - cmul(conj(p), z));
            }

            // Simplex Noise (Ashima)
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ;
                m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            float hash11(float p) {
                p = fract(p * .1031);
                p *= p + 33.33;
                p *= p + p;
                return fract(p);
            }

            vec3 renderScene(vec2 uv, float damage) {
                vec2 z = uv;
                
                // Dream Physics: Gravity Inversion & Migration
                float density = length(z) + 0.2 * snoise(z * 4.0 - u_time * 0.4);
                float thresh = 0.5 + 0.2 * sin(u_time * 0.25);
                float inv = smoothstep(thresh - 0.1, thresh + 0.1, density) * 2.0 - 1.0;
                
                // Tiles migrate outward or inward based on density. Damage accelerates this.
                vec2 warp_dir = normalize(z + 0.0001);
                float warp_mag = 0.06 * inv * (1.0 + damage * 1.5);
                z = mobius_translate(z, warp_dir * warp_mag);
                
                // Slow rotation
                float angle = u_time * 0.1;
                z = cmul(z, vec2(cos(angle), sin(angle)));

                // Fold to fundamental domain of {5,4}
                int depth = 0;
                float minDist = 10.0;
                float id_hash = 0.0;
                vec2 lineNormal = vec2(sin(PI_5), -cos(PI_5));
                float c_radius = sqrt(C_RADIUS_SQ);

                for(int i = 0; i < 30; i++) {
                    bool changed = false;
                    
                    if (z.y < 0.0) {
                        z.y = -z.y;
                        changed = true;
                        depth++;
                        id_hash += 1.618;
                    }
                    
                    float dLine = dot(z, lineNormal);
                    if (dLine < 0.0) {
                        z -= 2.0 * dLine * lineNormal;
                        changed = true;
                        depth++;
                        id_hash += 2.718;
                    }
                    
                    vec2 dz = z - C_CENTER;
                    float d2 = dot(dz, dz);
                    if (d2 < C_RADIUS_SQ) {
                        z = C_CENTER + dz * (C_RADIUS_SQ / d2);
                        changed = true;
                        depth++;
                        id_hash += 3.141;
                    }
                    
                    // Track distance to edges for moiré boundaries
                    float d1 = z.y;
                    float d2_line = dot(z, lineNormal);
                    float d3_circ = abs(length(z - C_CENTER) - c_radius);
                    float currentMin = min(min(d1, d2_line), d3_circ);
                    minDist = min(minDist, currentMin);
                    
                    if (!changed) break;
                }

                // THE-LISTS Palettes (Domain 10 & 8)
                vec3 p0 = vec3(0.3, 0.0, 0.6); // Ultraviolet Shame Bleed
                vec3 p1 = vec3(0.0, 0.8, 0.6); // Spectral Joy Crescents
                vec3 p2 = vec3(0.05, 0.1, 0.2); // Blue-Black Grief Spirals
                vec3 p3 = vec3(0.9, 0.2, 0.1); // Rage Flare Geometry
                vec3 p4 = vec3(0.2, 0.9, 0.4); // Glitchwave Dichrome
                
                int c_idx = int(mod(id_hash + u_time * 0.15, 5.0));
                vec3 baseColor = p0;
                if(c_idx == 1) baseColor = p1;
                if(c_idx == 2) baseColor = p2;
                if(c_idx == 3) baseColor = p3;
                if(c_idx == 4) baseColor = p4;

                // Wet Engine / Organic distortion on the moiré metric
                minDist += 0.015 * snoise(z * 15.0 + u_time);

                // Moiré Fringes (Radial Interference)
                float m1 = sin(minDist * 160.0);
                float m2 = sin(minDist * 170.0 + u_time * 2.5);
                float moire = m1 * m2;
                
                float fringe = smoothstep(0.6, 1.0, moire);
                vec3 edgeColor = vec3(0.9, 0.8, 0.6) * (1.0 + damage); // Metallic sheen turning into blown out heat
                
                vec3 color = mix(baseColor * (0.4 + 0.6 * length(z)), edgeColor, fringe);
                
                // Add some internal domain warping
                color *= 0.8 + 0.2 * snoise(z * 20.0);

                return color;
            }

            void main() {
                vec2 uv = vUv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                float r = length(uv);
                if (r > 1.0) {
                    fragColor = vec4(0.05, 0.05, 0.05, 1.0);
                    return;
                }

                // Damage accumulates over 60 seconds
                float damage = smoothstep(5.0, 60.0, u_time);
                
                // Sync Tearing (Broadcast Signal Failure)
                float tear = step(0.98 - damage * 0.15, sin(uv.y * 12.0 + u_time * 6.0)) * damage;
                uv.x += tear * 0.08 * sin(u_time * 30.0);

                // Chromatic Aberration (RGB Shift)
                float ca = 0.02 * damage * (1.0 + sin(u_time * 7.0) * 0.5);
                vec3 finalColor;
                finalColor.r = renderScene(uv * (1.0 + ca), damage).r;
                finalColor.g = renderScene(uv, damage).g;
                finalColor.b = renderScene(uv * (1.0 - ca), damage).b;

                // Scanline Dropout (Data Corruption)
                float scanline = fract(vUv.y * u_resolution.y * 0.3 + u_time * 3.0);
                float dropout = step(damage * 0.6 * hash11(floor(vUv.y * u_resolution.y * 0.3)), scanline);
                finalColor *= mix(1.0, dropout, damage);

                // Boundary fade to infinity
                float fade = smoothstep(1.0, 0.85 - damage * 0.1, r);
                finalColor *= fade;

                // Phosphor Bloom & Clipping
                finalColor = pow(finalColor, vec3(0.8 - damage * 0.2)); 

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
            transparent: true
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        material.uniforms.u_time.value = time;
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("Feral WebGL Engine Failure:", e);
}