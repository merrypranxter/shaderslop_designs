if (!canvas.__three) {
  try {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      alpha: true,
      antialias: false
    });
    
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
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
        in vec2 vUv;
        out vec4 fragColor;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        #define PI 3.14159265359

        // Bayer 4x4 Dither Matrix (pixel_voxel repo)
        const float bayer4[16] = float[16](
            0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
           12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
            3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
           15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
        );

        // Wavelength to RGB Conversion (structural_color repo)
        vec3 wavelengthToRGB(float W) {
            vec3 c = vec3(0.0);
            if (W >= 380.0 && W < 440.0) c = vec3(-(W-440.0)/(440.0-380.0), 0.0, 1.0);
            else if (W >= 440.0 && W < 490.0) c = vec3(0.0, (W-440.0)/(490.0-440.0), 1.0);
            else if (W >= 490.0 && W < 510.0) c = vec3(0.0, 1.0, -(W-510.0)/(510.0-490.0));
            else if (W >= 510.0 && W < 580.0) c = vec3((W-510.0)/(580.0-510.0), 1.0, 0.0);
            else if (W >= 580.0 && W < 645.0) c = vec3(1.0, -(W-645.0)/(645.0-580.0), 0.0);
            else if (W >= 645.0 && W <= 780.0) c = vec3(1.0, 0.0, 0.0);
            return c;
        }

        // Thin-Film Interference calculation
        vec3 thinFilm(float thickness, float viewAngle, float n_film) {
            vec3 color = vec3(0.0);
            float pathDiff = 2.0 * n_film * thickness * sqrt(1.0 - pow(sin(viewAngle)/n_film, 2.0));
            
            for (float i = 0.0; i < 10.0; i++) {
                float lambda = mix(400.0, 700.0, i / 9.0);
                float phase = (pathDiff / lambda) * 6.28318;
                float intensity = 0.5 + 0.5 * cos(phase);
                color += wavelengthToRGB(lambda) * intensity;
            }
            return color / 10.0;
        }

        // G2 Field Definitions (g2 repo)
        vec3 g2PhiField(vec2 p, float t) {
            float a = sin(p.x * 2.1 + t * 0.55);
            float b = cos(p.y * 2.7 - t * 0.31);
            float c = sin((p.x + p.y) * 3.2 + t * 0.22);
            vec3 v = vec3(a + 0.3 * c, b - 0.25 * c, sin((p.x * p.y) * 2.0 + t * 0.18));
            return normalize(v);
        }

        vec3 g2DualField(vec2 p, float t, vec3 phi) {
            vec3 d = vec3(-phi.y, phi.x, cos((p.x - p.y) * 2.4 - t * 0.27));
            return normalize(d);
        }

        float g2Torsion(vec3 phi, vec3 dualField) {
            return abs(dot(phi, dualField));
        }

        float g2SingularityMask(vec2 p, vec3 phi, vec3 dualField, float torsion) {
            float radial = length(p);
            float fracture = sin(radial * 18.0 - torsion * 6.0 + phi.z * 4.0);
            fracture = 0.5 + 0.5 * fracture;
            float axisStress = abs(phi.x - dualField.y);
            float mask = smoothstep(0.72, 0.96, fracture + axisStress * 0.35 + torsion * 0.4);
            return clamp(mask, 0.0, 1.0);
        }

        void main() {
            // Pixel Grid Lock (pixel_voxel pipeline)
            float virtual_width = 320.0;
            float aspect = u_resolution.x / max(u_resolution.y, 1.0);
            float virtual_height = virtual_width / aspect;
            
            vec2 pixelSize = 1.0 / vec2(virtual_width, virtual_height);
            vec2 pUV = floor(vUv / pixelSize) * pixelSize + pixelSize * 0.5;
            
            vec2 p = (pUV - 0.5) * 2.0;
            p.x *= aspect;
            
            // Mouse Repulsion / Warp
            vec2 mouseNorm = u_mouse / max(u_resolution, vec2(1.0));
            vec2 mouseOffset = (mouseNorm - 0.5) * 2.0;
            p += mouseOffset * 0.3;
            
            // G2 Symbolic Render Grammar
            vec3 phi = g2PhiField(p * 1.5, u_time);
            vec3 dual = g2DualField(p, u_time, phi);
            float torsion = g2Torsion(phi, dual);
            float singMask = g2SingularityMask(p, phi, dual, torsion);
            
            // Structural Color driven by G2 Fields
            float thickness = mix(150.0, 900.0, torsion) + singMask * 300.0 + sin(u_time * 0.5) * 100.0;
            float viewAngle = abs(phi.z) * PI * 0.3;
            vec3 iridescence = thinFilm(thickness, viewAngle, 1.56); // n=1.56 (Chitin/Beetle Cuticle)
            
            // G2 Resolution / Healing Seam
            float halo = exp(-3.5 * length(p));
            vec3 scarColor = vec3(1.0, 0.55, 0.16) * smoothstep(0.2, 1.0, singMask) * (0.3 + 0.7 * torsion);
            vec3 coolBloom = vec3(0.15, 0.45, 1.0) * halo * (1.0 - singMask) * 0.45;
            vec3 repair = scarColor + coolBloom;
            
            vec3 finalColor = iridescence * 1.2 + repair * 1.5;
            
            // Pixel Art Outline (Sobel / Edge-Detect on Torsion)
            vec2 offset = vec2(pixelSize.x * 2.0 * aspect, 0.0);
            vec3 phiR = g2PhiField((p + offset) * 1.5, u_time);
            vec3 dualR = g2DualField(p + offset, u_time, phiR);
            float tR = g2Torsion(phiR, dualR);
            
            vec2 offsetY = vec2(0.0, pixelSize.y * 2.0);
            vec3 phiU = g2PhiField((p + offsetY) * 1.5, u_time);
            vec3 dualU = g2DualField(p + offsetY, u_time, phiU);
            float tU = g2Torsion(phiU, dualU);
            
            float edge = abs(torsion - tR) + abs(torsion - tU);
            if(edge > 0.15) {
                finalColor = vec3(0.05, 0.03, 0.08); // Dark Outline
            } else {
                // Ditherpunk: Ordered Dither before Palette Snap
                ivec2 pxCoord = ivec2(vUv * vec2(virtual_width, virtual_height));
                int bx = pxCoord.x % 4;
                int by = pxCoord.y % 4;
                float bayerVal = bayer4[by * 4 + bx];
                
                float spread = 0.35;
                finalColor += (bayerVal - 0.5) * spread;
                
                // Palette Quantization (approximate extended palette)
                float steps = 5.0;
                finalColor = floor(finalColor * steps + 0.5) / steps;
            }
            
            // Vignette
            float v = length((vUv - 0.5) * 2.0);
            finalColor *= smoothstep(1.6, 0.6, v);
            
            fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
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
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
  
  if (mouse && mouse.x !== undefined && mouse.y !== undefined) {
    const targetMouse = new THREE.Vector2(mouse.x, mouse.y);
    material.uniforms.u_mouse.value.lerp(targetMouse, 0.1);
  }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);