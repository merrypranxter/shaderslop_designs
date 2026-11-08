if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
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
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        // Complex math for Möbius transformations (from kleinian_groups)
        vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
        vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y) / d; }

        // 4x4 Bayer Matrix (from dither repo)
        float bayer(vec2 p) {
            int x = int(mod(p.x, 4.0));
            int y = int(mod(p.y, 4.0));
            int m[16] = int[](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
            return float(m[x + y * 4]) / 16.0;
        }

        // IQ Cosine Palette - Neon Acid (from color_fields)
        vec3 palette(float t) {
            vec3 a = vec3(0.5);
            vec3 b = vec3(0.5, 0.5, 0.33);
            vec3 c = vec3(2.0, 1.0, 1.0);
            vec3 d = vec3(0.5, 0.2, 0.25);
            return a + b * cos(6.28318 * (c * t + d));
        }

        // Evaluates a Schottky-style inversion fractal and returns a mask for a specific iteration depth
        float evalFractal(vec2 z, int target_depth, float time) {
            // Apply a breathing Möbius hyperbolic warp
            vec2 a = vec2(1.0, 0.0);
            vec2 b = vec2(0.15 * sin(time), 0.15 * cos(time));
            vec2 c_mob = vec2(0.25 * cos(time * 0.5), 0.0);
            vec2 d_mob = vec2(1.0, 0.0);
            z = cdiv(cmul(a, z) + b, cmul(c_mob, z) + d_mob);
            
            vec2 centers[4];
            float t = time * 0.4;
            float s = sin(t), c_rot = cos(t);
            mat2 rot = mat2(c_rot, -s, s, c_rot);
            
            centers[0] = rot * vec2(0.5, 0.0);
            centers[1] = rot * vec2(-0.5, 0.0);
            centers[2] = rot * vec2(0.0, 0.5);
            centers[3] = rot * vec2(0.0, -0.5);
            
            // Radius pulses to bridge the gap between Cantor dust and connected limit sets
            float rad = 0.51 + 0.09 * sin(time * 2.0);
            
            int depth = 0;
            float dist = 1.0;
            
            for(int i = 0; i < 12; i++) {
                bool hit = false;
                for(int j = 0; j < 4; j++) {
                    vec2 dz = z - centers[j];
                    float d2 = dot(dz, dz);
                    if(d2 < rad*rad) {
                        // Circle inversion
                        z = centers[j] + dz * (rad*rad / d2);
                        hit = true;
                        depth++;
                        dist = (rad - sqrt(d2)) / rad; // Normalized distance to edge
                        break;
                    }
                }
                if(!hit) break;
            }
            
            if (depth == target_depth) {
                return smoothstep(0.0, 0.35, dist);
            }
            return 0.0;
        }

        void main() {
            vec3 finalColor = vec3(0.01, 0.0, 0.03); // Cosmic void base
            
            // Faint Terminator HUD grid in the background
            float hgrid = pow(abs(sin(vUv.y * 60.0 + u_time)), 30.0);
            float vgrid = pow(abs(sin(vUv.x * 60.0 + u_time)), 30.0);
            if (bayer(gl_FragCoord.xy) < (hgrid + vgrid) * 0.6) {
                finalColor += vec3(0.0, 0.3, 0.2);
            }
            
            float aspect = u_resolution.x / u_resolution.y;
            
            // "The machine sees in layers." (Parallax Depth Fields logic)
            // Render back-to-front, slicing the Kleinian group by iteration depth
            for(int plane = 8; plane >= 1; plane--) {
                float depthVal = float(plane) / 8.0;
                float signedDepth = depthVal - 0.5;
                
                vec2 pOffset = (u_mouse - 0.5) * signedDepth * 0.4;
                
                // Chromatic separation amplifies with distance from focal plane
                float chrom = abs(signedDepth) * 0.12;
                vec2 uvR = vUv + pOffset + vec2(chrom, 0.0);
                vec2 uvG = vUv + pOffset;
                vec2 uvB = vUv + pOffset + vec2(-chrom, chrom * 0.5);
                
                vec2 zR = (uvR - 0.5) * 2.5; zR.x *= aspect;
                vec2 zG = (uvG - 0.5) * 2.5; zG.x *= aspect;
                vec2 zB = (uvB - 0.5) * 2.5; zB.x *= aspect;
                
                // Evaluate the fractal independently for each color channel at this specific depth
                float r = evalFractal(zR, plane, u_time);
                float g = evalFractal(zG, plane, u_time);
                float b = evalFractal(zB, plane, u_time);
                
                vec3 planeCol = palette(depthVal + u_time * 0.15);
                
                // Dither each channel with a spatial offset to create RGB noise at chromatic boundaries
                float dR = step(bayer(gl_FragCoord.xy), r);
                float dG = step(bayer(gl_FragCoord.xy + vec2(2.0, 3.0)), g);
                float dB = step(bayer(gl_FragCoord.xy + vec2(3.0, 1.0)), b);
                
                vec3 splitDither = vec3(dR, dG, dB) * planeCol;
                float combinedAlpha = max(dR, max(dG, dB));
                
                // Accumulate layers
                finalColor = mix(finalColor, splitDither, combinedAlpha);
            }
            
            fragColor = vec4(finalColor, 1.0);
        }
      `
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

if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  
  let mx = mouse.x / grid.width;
  let my = 1.0 - (mouse.y / grid.height);
  if (mouse.x === 0 && mouse.y === 0) {
    mx = 0.5;
    my = 0.5;
  }
  
  material.uniforms.u_mouse.value.set(mx, my);
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);