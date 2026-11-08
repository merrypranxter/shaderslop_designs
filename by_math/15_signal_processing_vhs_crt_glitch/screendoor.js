if (!canvas.__three) {
  try {
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
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        in vec2 vUv;
        out vec4 fragColor;
        
        uniform float u_time;
        uniform vec2 u_resolution;
        
        void main() {
            vec2 centered = vUv - 0.5;
            float rDist = length(centered);
            
            // Barrel distortion (face pressed against monitor lens effect)
            vec2 distortedUv = centered * (1.0 + rDist * rDist * 0.18) + 0.5;
            
            // Wobble (very slight grid instability / micro-saccades)
            float wobbleX = sin(u_time * 2.0 + vUv.y * 20.0) * cos(u_time * 1.3 + vUv.x * 5.0);
            float wobbleY = cos(u_time * 1.7 + vUv.x * 15.0) * sin(u_time * 1.1 + vUv.y * 6.0);
            vec2 wobble = vec2(wobbleX, wobbleY) * 1.2;
            
            vec2 distortedCoord = distortedUv * u_resolution + wobble;
            
            // Pixel scaling - extremely high density but visible
            float pixelScale = 9.0;
            vec2 pixelCoord = floor(distortedCoord / pixelScale);
            vec2 subCoord = fract(distortedCoord / pixelScale);
            
            // Subpixel structure (3 stripes per pixel)
            float subX = subCoord.x * 3.0;
            float subIndex = floor(subX);
            float subFrac = fract(subX);
            
            // Screen door gaps (Black Matrix)
            float gapX = 0.16;
            float edgeX = 0.08;
            float activeX = smoothstep(gapX, gapX + edgeX, subFrac) * smoothstep(1.0 - gapX, 1.0 - gapX - edgeX, subFrac);
            
            float gapY = 0.14;
            float edgeY = 0.08;
            float activeY = smoothstep(gapY, gapY + edgeY, subCoord.y) * smoothstep(1.0 - gapY, 1.0 - gapY - edgeY, subCoord.y);
            
            // RGB Triad assignment
            float r = step(subIndex, 0.5) * activeX;
            float g = step(0.5, subIndex) * step(subIndex, 1.5) * activeX;
            float b = step(1.5, subIndex) * activeX;
            
            vec3 triad = vec3(r, g, b) * activeY;
            
            // Base signal (Neutral / White-ish)
            vec3 signal = vec3(0.96, 0.98, 0.95);
            
            // Moiré / Interference patterns beating against the grid
            float moire1 = sin(distortedUv.y * 150.0 - u_time * 2.0);
            float moire2 = sin(length(centered) * 120.0 + u_time * 1.5);
            float interference = mix(0.75, 1.0, (moire1 * moire2) * 0.5 + 0.5);
            signal *= interference;
            
            // Moving shadow/ghost image on screen (to give the display some content)
            float shadow = length(distortedUv - vec2(0.5 + sin(u_time * 0.7) * 0.25, 0.5 + cos(u_time * 0.5) * 0.15));
            signal *= mix(0.3, 1.0, smoothstep(0.05, 0.8, shadow));
            
            // Micro-noise for signal grit
            float signalNoise = fract(sin(dot(distortedCoord, vec2(12.9898, 78.233))) * 43758.5453);
            signal *= mix(0.9, 1.0, signalNoise);
            
            // Dead / Hot pixels (Sensor/Display failure)
            float n = fract(sin(dot(pixelCoord, vec2(12.9898, 78.233))) * 43758.5453);
            float dead = step(0.9992, n);
            float hot = step(0.9985, n) * (1.0 - dead);
            
            if (dead > 0.5) {
                signal = vec3(0.0);
            } else if (hot > 0.5) {
                signal = vec3(
                    step(0.33, fract(n * 13.0)),
                    step(0.33, fract(n * 17.0)),
                    step(0.33, fract(n * 19.0))
                );
            }
            
            // Multiply physical structure by logical signal
            vec3 color = triad * signal;
            
            // Optical Vignette
            float vignette = 1.0 - smoothstep(0.3, 0.95, rDist);
            color *= vignette;
            
            // Backlight bleed (LCD black level leaking through the matrix)
            vec3 backlight = vec3(0.06, 0.07, 0.08) * vignette * signal;
            float maxColor = max(r, max(g, b)) * activeY;
            color += backlight * (1.0 - maxColor);
            
            fragColor = vec4(color, 1.0);
        }
      `
    });
    
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    
    canvas.__three = { renderer, scene, camera, material };
  } catch (e) {
    console.error("WebGL Init failed", e);
    return;
  }
}

const { renderer, scene, camera, material } = canvas.__three;
if (material && material.uniforms) {
  material.uniforms.u_time.value = time;
  material.uniforms.u_resolution.value.set(grid.width, grid.height);
}
renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);