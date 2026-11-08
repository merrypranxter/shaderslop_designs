if (typeof THREE === 'undefined') return;

if (!canvas.__three) {
    try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 vUv;
            
            #define MAX_ITER 60

            // Complex arithmetic
            vec2 cmul(vec2 a, vec2 b) {
                return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
            }

            // Möbius transformation: translates point 'a' to the origin
            vec2 mobius_translate(vec2 z, vec2 a) {
                vec2 num = z - a;
                vec2 a_conj = vec2(a.x, -a.y);
                vec2 den = vec2(1.0, 0.0) - cmul(a_conj, z);
                float d = dot(den, den);
                return vec2(num.x*den.x + num.y*den.y, num.y*den.x - num.x*den.y) / d;
            }

            // Fold into the fundamental domain of the {7, 3} hyperbolic tiling
            vec2 fold_pq(vec2 z, out int depth, float time) {
                depth = 0;
                // Normal to the line at angle PI/7
                vec2 n = vec2(-0.433883739, 0.900968868); 
                // Center of the inversion circle for {7,3}
                vec2 gc = vec2(2.01219212, 0.0);
                
                // The Feral Glitch: Overclock the hyperbolic geometry by perturbing the inversion radius.
                // This causes the fundamental domains to misregister and tear at the edges.
                float glitch = sin(time * 2.0) * cos(time * 7.0) * 0.015;
                float gr2 = 3.048917 + glitch; // Base radius squared + noise
                
                for (int i = 0; i < MAX_ITER; i++) {
                    bool changed = false;
                    
                    // 1. Reflect across x-axis
                    if (z.y < 0.0) { 
                        z.y = -z.y; 
                        depth++; 
                        changed = true; 
                    }
                    
                    // 2. Reflect across PI/7 line
                    float d_n = dot(z, n);
                    if (d_n > 0.0) { 
                        z -= 2.0 * d_n * n; 
                        depth++; 
                        changed = true; 
                    }
                    
                    // 3. Invert across the boundary circle
                    vec2 dz = z - gc;
                    float d2 = dot(dz, dz);
                    if (d2 < gr2) { 
                        z = gc + gr2 * dz / d2; 
                        depth++; 
                        changed = true; 
                    }
                    
                    if (!changed) break;
                }
                return z;
            }

            // Lisa Frank extreme saturation palette
            vec3 neonRainbow(float t) {
                // Cosine palette
                vec3 col = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
                // Luma approximation
                float l = dot(col, vec3(0.333));
                // Overclocked saturation curve
                return clamp(mix(vec3(l), col, 2.8), 0.0, 1.0); 
            }

            vec2 hash22(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return fract(sin(p) * 43758.5453123);
            }

            // Cellular noise for leopard spots
            vec2 leopard(vec2 p, float time) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float minDist = 1.0;
                float secondMin = 1.0;
                
                for(int y = -1; y <= 1; y++) {
                    for(int x = -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x), float(y));
                        vec2 point = hash22(i + neighbor);
                        // Mutate the spots slightly
                        point = 0.5 + 0.5 * sin(time * 3.0 + 6.2831 * point);
                        vec2 diff = neighbor + point - f;
                        float dist = length(diff);
                        
                        if(dist < minDist) {
                            secondMin = minDist;
                            minDist = dist;
                        } else if(dist < secondMin) {
                            secondMin = dist;
                        }
                    }
                }
                return vec2(minDist, secondMin);
            }

            // Procedural sparkles
            float sparkle(vec2 p, vec2 cell) {
                vec2 h = hash22(cell);
                // Only 15% chance of a sparkle per cell
                if (h.x > 0.15) return 0.0;
                // Random offset
                p -= (h - 0.5) * 0.8;
                float d = length(p);
                float cross = min(abs(p.x), abs(p.y));
                return smoothstep(0.05, 0.0, d) + smoothstep(0.01, 0.0, cross) * smoothstep(0.2, 0.0, d);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                // Zoom out slightly to see the void corona
                uv *= 1.15; 
                
                float r = length(uv);
                
                // Outer space / non-euclidean void boundary
                if (r > 1.0) {
                    float glow = exp(-(r - 1.0) * 15.0);
                    vec3 outer = mix(vec3(0.05, 0.0, 0.1), vec3(1.0, 0.0, 0.8), glow);
                    // Glitchy scanlines bleeding into the void
                    outer += vec3(0.1, 0.0, 0.3) * step(0.9, fract(uv.y * 50.0 + u_time * 5.0)) * glow;
                    gl_FragColor = vec4(outer, 1.0);
                    return;
                }
                
                // Animate the center of the Möbius transform to "swim" through hyperbolic space
                vec2 a = 0.55 * vec2(cos(u_time * 0.3), sin(u_time * 0.41));
                vec2 z = mobius_translate(uv, a);
                
                // Spin the disk
                float th = u_time * 0.1;
                float c = cos(th), s = sin(th);
                z = vec2(z.x*c - z.y*s, z.x*s + z.y*c);
                
                // Fold space
                int depth = 0;
                vec2 zf = fold_pq(z, depth, u_time);
                
                // Depth-based color mapping for that concentric rainbow effect
                float t = float(depth) * 0.05 + u_time * 0.2;
                
                // Tiger stripes base layer (domain warped)
                float warp = sin(zf.x * 20.0 + u_time) * 0.1;
                float stripes = smoothstep(0.0, 0.1, sin((zf.y + warp) * 40.0));
                vec3 bg = mix(neonRainbow(t), neonRainbow(t + 0.15), stripes);
                
                // Leopard spots layer
                vec2 leo = leopard(zf * 18.0, u_time);
                // Create the rosette ring
                float ring = smoothstep(0.06, 0.0, abs(leo.x - 0.25));
                // Break the ring up so it looks organic
                ring *= smoothstep(0.0, 0.1, leo.y - leo.x - 0.05);
                // Solid inside
                float inside = smoothstep(0.2, 0.15, leo.x);
                
                // Composite the leopard spots
                vec3 spotCenterCol = neonRainbow(t + 0.5 + length(zf)*3.0);
                bg = mix(bg, spotCenterCol, inside);
                bg = mix(bg, vec3(0.0), ring); // High contrast black outline
                
                // Tile the sparkles according to the fundamental domain
                vec2 sp_uv_raw = zf * 25.0 + vec2(float(depth)*0.3);
                vec2 sp_cell = floor(sp_uv_raw);
                vec2 sp_uv = fract(sp_uv_raw) - 0.5;
                float sp = sparkle(sp_uv, sp_cell);
                bg += sp * vec3(1.0, 0.9, 1.0);
                
                // Dithering (Vibe Engine specific) to add a 90s trapper-keeper noise texture
                float dither = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
                bg += (dither - 0.5) * 0.15;
                
                // Poincaré boundary fade to neon pink
                float fade = smoothstep(1.0, 0.96, r);
                vec3 edgeCol = vec3(1.0, 0.0, 0.8);
                bg = mix(edgeCol, bg, fade);
                
                gl_FragColor = vec4(bg, 1.0);
            }
        `;

        const material = new THREE.ShaderMaterial({
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
    } catch (e) {
        console.error("WebGL Initialization Failed:", e);
        return;
    }
}

const { renderer, scene, camera, material } = canvas.__three;

if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);