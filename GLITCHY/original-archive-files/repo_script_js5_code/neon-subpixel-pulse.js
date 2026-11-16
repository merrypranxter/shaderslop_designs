try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: false });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) }
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

        in vec2 vUv;
        out vec4 fragColor;

        // The core moiré interference generator
        // Using a soft dot grid to maximize 2D interference with the subpixel matrix
        float gridFunction(vec2 coord, float scale, vec2 offset) {
            vec2 st = coord * scale + offset;
            vec2 g = abs(fract(st) - 0.5);
            return smoothstep(0.4, 0.0, length(g));
        }

        void main() {
            // --- 1. THE HEARTBEAT (TEMPORAL MECHANISM) ---
            // A biological rhythm forced onto an electrical system
            float tBeat = fract(u_time * 1.0); // 60 BPM
            float beat1 = exp(-tBeat * 20.0);
            float beat2 = exp(-fract(tBeat - 0.2) * 20.0) * step(0.2, tBeat);
            float pulse = beat1 + beat2;
            
            // --- 2. THE DAMAGE (ELECTRICAL INSTABILITY) ---
            // VHS Tracking Tear tied to the systolic phase
            float tearZone = exp(-pow(vUv.y - fract(u_time * 0.4), 2.0) * 60.0);
            float tearShift = tearZone * sin(vUv.y * 100.0 + u_time * 40.0) * 0.015 * beat1;
            
            // Blocky Datamosh surge tied to the diastolic phase
            float block = fract(sin(dot(floor(vUv * vec2(12.0, 8.0)), vec2(12.9898, 78.233))) * 43758.5453);
            float moshMask = step(0.92, block);
            float moshShift = moshMask * 0.02 * beat2 * sin(vUv.y * 120.0);
            
            vec2 uvWarped = vUv;
            uvWarped.x += tearShift + moshShift;
            vec2 fragCoord = uvWarped * u_resolution;
            
            // --- 3. THE HARDWARE (SUBPIXEL MATRIX) ---
            float pixelScale = 5.0; // Size of the LED triad
            vec2 pC = fragCoord / pixelScale;
            vec2 pGrid = fract(pC);
            
            // Anti-aliased subpixel masks
            float gapX = 0.05;
            float gapY = 0.1;
            float sf = 0.06; // smooth factor
            
            float rMask = smoothstep(0.0 + gapX - sf, 0.0 + gapX + sf, pGrid.x) * (1.0 - smoothstep(0.333 - gapX - sf, 0.333 + gapX + sf, pGrid.x));
            float gMask = smoothstep(0.333 + gapX - sf, 0.333 + gapX + sf, pGrid.x) * (1.0 - smoothstep(0.666 - gapX - sf, 0.666 + gapX + sf, pGrid.x));
            float bMask = smoothstep(0.666 + gapX - sf, 0.666 + gapX + sf, pGrid.x) * (1.0 - smoothstep(1.0 - gapX - sf, 1.0 - gapX + sf, pGrid.x));
            
            float yMask = smoothstep(gapY - sf, gapY + sf, pGrid.y) * (1.0 - smoothstep(1.0 - gapY - sf, 1.0 - gapY + sf, pGrid.y));
            
            rMask *= yMask;
            gMask *= yMask;
            bMask *= yMask;
            
            // --- 4. THE PHANTOM (CHROMATIC MOIRÉ) ---
            // Scale differentials create the low-frequency interference beats
            float scaleR = 1.0 / 5.1;
            float scaleG = 1.0 / 5.14;
            float scaleB = 1.0 / 5.18;
            
            // Subtle rotations create an angled rosette moiré that twists with the heartbeat
            float aR = 0.015 + beat1 * 0.005; 
            float aG = -0.01 - beat1 * 0.005;
            float aB = 0.02 + beat1 * 0.005;
            
            mat2 rotR = mat2(cos(aR), -sin(aR), sin(aR), cos(aR));
            mat2 rotG = mat2(cos(aG), -sin(aG), sin(aG), cos(aG));
            mat2 rotB = mat2(cos(aB), -sin(aB), sin(aB), cos(aB));
            
            vec2 coordR = rotR * fragCoord;
            vec2 coordG = rotG * fragCoord;
            vec2 coordB = rotB * fragCoord;
            
            // Drift offsets create the rolling animation
            vec2 offR = vec2(u_time * 2.5, u_time * 1.5);
            vec2 offG = vec2(-u_time * 1.8, u_time * 2.8);
            vec2 offB = vec2(u_time * 3.0, -u_time * 1.9);
            
            float iR = gridFunction(coordR, scaleR, offR);
            float iG = gridFunction(coordG, scaleG, offG);
            float iB = gridFunction(coordB, scaleB, offB);
            
            // Modulate the subpixel intensity based on the interference grid
            float modR = mix(0.1, 3.0, iR);
            float modG = mix(0.1, 3.0, iG);
            float modB = mix(0.1, 3.0, iB);
            
            // The Palette: Fully Saturated
            vec3 hotPink = vec3(1.0, 0.0, 0.5);
            vec3 acidLime = vec3(0.5, 1.0, 0.0);
            vec3 electricCobalt = vec3(0.0, 0.3, 1.0);
            
            vec3 cR = rMask * hotPink * modR;
            vec3 cG = gMask * acidLime * modG;
            vec3 cB = bMask * electricCobalt * modB;
            
            vec3 pixelColor = cR + cG + cB;
            
            // --- 5. THE HALO (BLOOM & SCANLINES) ---
            // Bloom: The interference grids themselves act as a low-frequency glow
            vec3 bloom = (hotPink * iR + acidLime * iG + electricCobalt * iB) * 0.8;
            pixelColor += bloom;
            
            // Scan banding (Deep Violet)
            float scanBand = sin(vUv.y * 35.0 - u_time * 3.0) * 0.5 + 0.5;
            scanBand = pow(scanBand, 4.0);
            vec3 deepViolet = vec3(0.4, 0.0, 0.8);
            pixelColor += deepViolet * scanBand * 0.9;
            
            // Hot / Stuck Pixels from the sensor damage taxonomy
            float hot = fract(sin(dot(floor(pC), vec2(12.9898, 78.233))) * 43758.5453);
            float hotMask = step(0.998, hot) * step(0.5, sin(u_time * 15.0 + hot * 100.0));
            pixelColor = mix(pixelColor, vec3(1.0), hotMask);
            
            // Apply Heartbeat to global intensity
            float heartbeat = mix(0.65, 1.4, pulse);
            pixelColor *= heartbeat;
            
            // CRT Vignette & Edge Darkening
            float vig = 1.0 - length(vUv - 0.5) * 1.3;
            pixelColor *= smoothstep(-0.2, 0.8, vig);
            
            // Phosphor saturation compression (prevents ugly clipping, keeps colors rich)
            pixelColor = pow(pixelColor, vec3(0.9)); 
            
            fragColor = vec4(pixelColor, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };
  }

  const { renderer, scene, camera, material } = canvas.__three;

  if (material && material.uniforms && material.uniforms.u_time) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}