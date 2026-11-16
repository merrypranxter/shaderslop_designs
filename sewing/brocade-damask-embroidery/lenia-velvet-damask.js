try {
  if (!canvas.__three) {
    if (!ctx) throw new Error("WebGL 2 context not available");

    const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    
    // Orthographic camera for full-screen 2D shader
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
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
      uniform vec2 u_mouse;

      // Generates the Lenia-style cellular damask pattern
      float getLenia(vec2 aspectUV, float brush) {
        // Slowly unroll the fabric
        vec2 p = aspectUV * 3.5 + vec2(u_time * 0.015, u_time * 0.025);
        
        // Damask mirrored folding (p4m wallpaper group symmetry)
        vec2 local = fract(p);
        local = abs(local - 0.5) * 2.0;
        if (local.x < local.y) local = local.yx;

        float density = 0.0;
        
        // Layered moving metaballs simulating cellular organisms
        for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float t = u_time * 0.12 + fi * 1.618;

            // Complex organic orbital paths
            vec2 pos = 0.5 + 0.35 * vec2(sin(t), cos(t * 1.3));
            pos += 0.12 * vec2(sin(t * 2.1 + fi), cos(t * 1.7 - fi));

            float dist = length(local - pos);
            density += 0.045 / (dist * dist + 0.008);
        }

        // Mouse brush adds energy to the cellular field, causing it to bloom
        density += brush * 1.8;

        // Fake continuous CA (Lenia) using multiple Gaussian growth rings
        float membrane = exp(-pow(density - 0.8, 2.0) * 12.0);
        float inner = exp(-pow(density - 1.6, 2.0) * 16.0);
        float core = exp(-pow(density - 3.0, 2.0) * 24.0);

        // Combine into a heightmap
        return membrane * 0.4 + inner * 0.8 + core * 1.3;
      }

      void main() {
        vec2 uv = vUv;
        vec2 aspectUV = uv;
        aspectUV.x *= u_resolution.x / u_resolution.y;

        vec2 mouseUV = u_mouse;
        mouseUV.x *= u_resolution.x / u_resolution.y;

        // Mouse brush distance
        vec2 mDelta = aspectUV - mouseUV;
        float mDist = length(mDelta);
        float brush = smoothstep(0.35, 0.0, mDist);

        // Height map sampling with finite differences for surface normals
        vec2 eps = vec2(0.003, 0.0);
        float h0 = getLenia(aspectUV, brush);
        float hX = getLenia(aspectUV + eps.xy, brush);
        float hY = getLenia(aspectUV + eps.yx, brush);

        vec3 normal = normalize(vec3(h0 - hX, h0 - hY, 0.012));

        // Velvet Nap (fiber direction)
        // High-frequency directional noise for the velvet pile
        vec2 nap = vec2(sin(uv.y * 40.0 + u_time), cos(uv.x * 40.0 - u_time)) * 0.04;
        
        // Brushing the velvet overrides the nap direction
        vec2 brushDir = normalize(mDelta + 0.0001);
        nap = mix(nap, brushDir * 0.5, brush);

        // Perturb the normal with the nap
        vec3 nNap = normalize(normal + vec3(nap, 0.0));

        // Royal Alien Palette
        vec3 baseColor = vec3(0.06, 0.0, 0.18); // Deep ultraviolet velvet
        vec3 haloColor = vec3(0.0, 0.7, 0.9);   // Cyan membrane
        vec3 motifColor = vec3(0.9, 0.0, 0.5);  // Hot magenta tissue
        vec3 bioColor = vec3(0.5, 0.95, 0.0);   // Acid green organelles
        vec3 coreColor = vec3(1.0, 0.6, 0.0);   // Orange/yellow nucleus

        // Map height to biological colors
        vec3 albedo = baseColor;
        albedo = mix(albedo, haloColor, smoothstep(0.05, 0.35, h0) * 0.7);
        albedo = mix(albedo, motifColor, smoothstep(0.35, 0.75, h0));
        albedo = mix(albedo, bioColor, smoothstep(0.75, 1.1, h0));
        albedo = mix(albedo, coreColor, smoothstep(1.1, 1.5, h0));

        // Lighting Model
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        // Dynamic roaming light
        vec3 lightDir = normalize(vec3(sin(u_time * 0.4), cos(u_time * 0.25), 0.6));
        vec3 halfVec = normalize(lightDir + viewDir);

        float NdotL = max(0.0, dot(nNap, lightDir));
        float NdotV = max(0.0, dot(nNap, viewDir));
        float NdotH = max(0.0, dot(nNap, halfVec));

        // Velvet Asperity Scattering (bright grazing angles)
        float rim = pow(1.0 - NdotV, 2.5);
        float velvetHighlight = smoothstep(0.2, 0.9, rim) * (0.4 + 0.6 * NdotL);

        // Raised biological motifs have a different, wetter specular shimmer
        float motifShimmer = pow(NdotH, 18.0) * smoothstep(0.2, 1.0, h0);

        // Combine Lighting
        vec3 color = albedo * (0.15 + 0.85 * NdotL); // Ambient + Diffuse
        
        // Apply velvet grazing sheen
        color += baseColor * velvetHighlight * 3.5;
        color += vec3(0.4, 0.1, 0.8) * velvetHighlight * 1.5; // Iridescent shift at edges

        // Apply motif wet specular
        color += mix(motifColor, vec3(1.0), 0.6) * motifShimmer * 2.5;

        // Sparkle Dust (embedded in the brightest velvet pile)
        float sparkNoise = fract(sin(dot(uv * 300.0, vec2(12.9898, 78.233))) * 43758.5453);
        float sparkle = step(0.975, sparkNoise) * pow(NdotH, 4.0) * smoothstep(0.4, 1.5, h0);
        color += vec3(1.0, 0.9, 1.0) * sparkle * 5.0;

        // Subtle vignette for drama
        float vignette = length(uv - 0.5);
        color *= smoothstep(0.85, 0.25, vignette);

        // Filmic Tonemapping
        color = color / (1.0 + color);
        color = pow(color, vec3(1.0 / 2.2)); // Gamma correction

        fragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
        u_mouse: { value: new THREE.Vector2(0.5, 0.5) }
      },
      vertexShader,
      fragmentShader
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    canvas.__three = { renderer, scene, camera, material };

    // Mouse Interaction Setup
    if (!canvas.__mouseState) {
      canvas.__mouseState = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        canvas.__mouseState.targetX = (e.clientX - rect.left) / rect.width;
        canvas.__mouseState.targetY = 1.0 - (e.clientY - rect.top) / rect.height;
      });
    }
  }

  const { renderer, scene, camera, material } = canvas.__three;

  // Smooth mouse interpolation (spring physics for brushing)
  if (canvas.__mouseState) {
    canvas.__mouseState.x += (canvas.__mouseState.targetX - canvas.__mouseState.x) * 0.08;
    canvas.__mouseState.y += (canvas.__mouseState.targetY - canvas.__mouseState.y) * 0.08;
  }

  // Safely update uniforms
  if (material && material.uniforms) {
    material.uniforms.u_time.value = time;
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    if (canvas.__mouseState) {
      material.uniforms.u_mouse.value.set(canvas.__mouseState.x, canvas.__mouseState.y);
    }
  }

  renderer.setSize(grid.width, grid.height, false);
  renderer.render(scene, camera);

} catch (e) {
  console.error("WebGL Initialization Failed:", e);
}