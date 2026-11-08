if (!canvas.__three) {
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!gl) throw new Error("WebGL 2 not supported or context occupied");

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    
    // Use an orthographic camera for a pure screen-space shader approach
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0.0 },
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
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        #define MAX_STEPS 100
        #define SURF_DIST 0.002
        #define MAX_DIST 25.0
        #define PI 3.14159265359

        // Photocopy noise / Precursor distribution
        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        // 4D / AdS Rotation
        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // Entanglement geometry: Ryu-Takayanagi minimal surface bridges
        float smin(float a, float b, float k) {
            float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
            return mix(b, a, h) - k * h * (1.0 - h);
        }

        // Crystalline Structures: Cubic (Fm3̄m) and Hexagonal (P6₃/mmc)
        float sdOctahedron(vec3 p, float s) {
            p = abs(p);
            return (p.x + p.y + p.z - s) * 0.57735027;
        }

        float sdHexPrism(vec3 p, vec2 h) {
            const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
            p = abs(p);
            p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
            vec2 d = vec2(
                length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
                p.z - h.y
            );
            return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
        }

        // Holographic Warp: AdS Radial Depth as Scale
        vec3 adsWarp(vec3 p) {
            float z = max(0.05, abs(p.z) + 1.5);
            float s = mix(1.0, 1.0 / z, 0.65); 
            return p * s;
        }

        // Bulk / Boundary Dictionary Map
        vec2 map(vec3 p) {
            vec3 wp = adsWarp(p);
            
            float t = u_time * 0.25;
            wp.xz *= rot(t + u_mouse.x * PI * 2.0);
            wp.yz *= rot(t * 0.8 + u_mouse.y * PI * 2.0);
            
            // Subregion logic: infinite fractal lattice
            vec3 q = mod(wp + 2.0, 4.0) - 2.0;
            
            // Phase transition logic: crystal structures shifting
            float oct = sdOctahedron(q, 0.8 + sin(u_time * 0.5) * 0.15);
            float hex = sdHexPrism(q, vec2(0.5 + cos(u_time * 0.7) * 0.1, 1.2));
            
            // Entanglement bridging forming minimal surfaces
            float d = smin(oct, hex, 0.8);
            
            // Holographic principle: Hollow bulk, surface encoded
            d = max(d, -sdOctahedron(q, 0.72));
            
            // Precursor nonlocal field injection (surface noise)
            d += sin(wp.x * 15.0) * sin(wp.y * 15.0) * sin(wp.z * 15.0) * 0.02;
            
            return vec2(d, 1.0);
        }

        vec3 getNormal(vec3 p) {
            vec2 e = vec2(0.002, 0.0);
            vec3 n = vec3(
                map(p + e.xyy).x - map(p - e.xyy).x,
                map(p + e.yxy).x - map(p - e.yxy).x,
                map(p + e.yyx).x - map(p - e.yyx).x
            );
            return normalize(n);
        }

        // Cyberdelic Neon / Lisa Frank Acid Palette
        vec3 getAcidColor(vec3 p, vec3 n) {
            vec3 magenta = vec3(1.0, 0.0, 0.80);
            vec3 cyan    = vec3(0.0, 1.0, 0.94);
            vec3 lime    = vec3(0.69, 1.0, 0.00);
            vec3 orange  = vec3(1.0, 0.42, 0.00);
            
            float f = dot(n, vec3(0.577));
            f = fract(f * 2.5 + length(p) * 0.5 - u_time * 0.4);
            
            vec3 c = mix(magenta, cyan, smoothstep(0.0, 0.33, f));
            c = mix(c, lime, smoothstep(0.33, 0.66, f));
            c = mix(c, orange, smoothstep(0.66, 1.0, f));
            return c;
        }

        void main() {
            vec2 uv = (vUv - 0.5) * 2.0;
            uv.x *= u_resolution.x / u_resolution.y;
            
            // Kaleidoscope / Mirror-Tile Pattern Warp (Psychedelic Collage)
            float folds = 6.0;
            float angleFold = atan(uv.y, uv.x);
            float radiusFold = length(uv);
            float sector = 2.0 * PI / folds;
            angleFold = mod(angleFold, sector);
            if (angleFold > sector * 0.5) angleFold = sector - angleFold;
            vec2 kUv = vec2(cos(angleFold), sin(angleFold)) * radiusFold;
            
            // Blend between pure space and kaleidoscope space based on radius
            uv = mix(uv, kUv, smoothstep(0.5, 1.5, radiusFold));
            
            vec3 ro = vec3(0.0, 0.0, -4.0);
            vec3 rd = normalize(vec3(uv, 1.0));
            
            float dO = 0.0;
            vec3 p;
            float minDist = 100.0;
            
            for(int i = 0; i < MAX_STEPS; i++) {
                p = ro + rd * dO;
                vec2 res = map(p);
                float dS = res.x;
                minDist = min(minDist, dS);
                if(dS < SURF_DIST || dO > MAX_DIST) break;
                dO += dS;
            }
            
            vec3 color = vec3(0.015, 0.02, 0.03); // Void Black
            
            if(dO < MAX_DIST) {
                vec3 n = getNormal(p);
                vec3 baseColor = getAcidColor(p, n);
                
                vec3 lightDir = normalize(vec3(1.0, 2.0, -1.5));
                float diff = max(dot(n, lightDir), 0.0);
                
                // Extreme specular for "Adamantine Luster"
                vec3 viewDir = normalize(ro - p);
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(n, halfDir), 0.0), 64.0);
                
                float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
                
                color = baseColor * (diff * 0.6 + 0.4) + spec * vec3(1.0) + fresnel * vec3(0.0, 1.0, 0.94);
            }
            
            // Holographic Stretched Horizon Glow
            float horizonGlow = exp(-minDist * 6.0) * 0.7;
            color += vec3(1.0, 0.0, 0.8) * horizonGlow; // Magenta precursor bleed
            
            // --- PRINT ARTIFACTS / PSYCHEDELIC COLLAGE ENGINE ---
            
            // 1. CMYK Misregistration (Simulated Chromatic Fringing)
            float shiftX = 0.01 * hash21(vec2(u_time, vUv.y * 10.0));
            color.r += max(0.0, color.r * shiftX * 50.0);
            color.b += max(0.0, color.b * shiftX * -50.0);

            // 2. Risograph Rainbow Halftone Screen
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            float htFreq = 120.0;
            float htAngle = 0.785398; // 45 deg
            mat2 rotScreen = mat2(cos(htAngle), -sin(htAngle), sin(htAngle), cos(htAngle));
            vec2 st = rotScreen * vUv * vec2(u_resolution.x / u_resolution.y, 1.0) * htFreq;
            vec2 grid = fract(st) - 0.5;
            float dotRad = sqrt(1.0 - clamp(luma, 0.0, 1.0)) * 0.65;
            float halftoneMask = smoothstep(dotRad + 0.08, dotRad - 0.08, length(grid));
            
            // Multiply blend halftone over substrate
            vec3 risoPaper = vec3(0.12, 0.13, 0.12);
            vec3 halftoneColor = mix(risoPaper, color * 1.6, halftoneMask);
            
            // 3. Photocopy Noise / Xerox Streak
            float streak = step(0.995, hash21(vec2(vUv.x * 0.05, u_time * 0.02))) * 0.3;
            halftoneColor += vec3(streak);
            
            // 4. Watercolor Paper Grain / Dust
            float grain = fract(sin(dot(vUv * 1000.0 + u_time, vec2(127.1, 311.7))) * 43758.5453);
            halftoneColor += (grain - 0.5) * 0.18;

            fragColor = vec4(halftoneColor, 1.0);
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

if (material?.uniforms) {
  if (material.uniforms.u_time) material.uniforms.u_time.value = time;
  if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
  if (material.uniforms.u_mouse) {
    // Map mouse position to normalized coordinates 0.0 to 1.0
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    // Smooth trailing interpolation for organic feel
    material.uniforms.u_mouse.value.lerp(new THREE.Vector2(mx, my), 0.05);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);