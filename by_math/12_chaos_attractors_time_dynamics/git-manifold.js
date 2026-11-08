// INITIALIZATION
if (!canvas.__three) {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.autoClear = false;
    renderer.setPixelRatio(1); // Force 1:1 for crisp pixel art

    // SCENE 1: Strange Attractor Particles (Foreground)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, grid.width / grid.height, 0.1, 1000);
    camera.position.z = 5;

    const partCount = 8000;
    const partGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const partMat = new THREE.PointsMaterial({
        color: 0x73bed3, // Apollo sky_blue base
        size: 2.0,
        sizeAttenuation: false, // Fixed pixel size
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const partMesh = new THREE.Points(partGeo, partMat);
    partMesh.position.set(0, -10, -20);
    partMesh.scale.set(0.5, 0.5, 0.5);
    scene.add(partMesh);

    // SCENE 2: SDF Raymarched Fractal (Background)
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const bgMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            mouse: { value: new THREE.Vector2(0, 0) },
            seed: { value: 0.5 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                // Bypass camera matrices for pure full-screen quad
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            uniform vec2 mouse;
            uniform float seed;
            varying vec2 vUv;

            mat2 rot(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // KIFS (Kaleidoscopic Iterated Function System)
            float map(vec3 p) {
                vec3 z = p;
                float scale = 1.0;
                
                // "Fractal breathing"
                float breath = sin(time * 0.3) * 0.05 + 1.0;
                
                for(int i = 0; i < 5; i++) {
                    z = abs(z);
                    if(z.x < z.y) z.xy = z.yx;
                    if(z.x < z.z) z.xz = z.zx;
                    if(z.y < z.z) z.yz = z.zy;
                    
                    z.xy *= rot(0.5 + mouse.x * 0.5 + seed);
                    z.yz *= rot(0.2 - mouse.y * 0.5 + time * 0.05);
                    
                    z = z * (2.0 * breath) - vec3(1.2, 0.8, 0.5);
                    scale *= (2.0 * breath);
                }
                
                // Octahedron distance for crystalline "sacred geometry" feel
                float d = (abs(z.x) + abs(z.y) + abs(z.z) - 1.5) * 0.57735027;
                return d / scale;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= resolution.x / resolution.y;

                // Orbiting camera
                vec3 ro = vec3(sin(time*0.2)*2.5, cos(time*0.15)*1.5, 3.0 + sin(time*0.1)*1.0);
                vec3 target = vec3(0.0, 0.0, 0.0);
                vec3 cw = normalize(target - ro);
                vec3 cp = vec3(0.0, 1.0, 0.0);
                vec3 cu = normalize(cross(cw, cp));
                vec3 cv = cross(cu, cw);
                vec3 rd = normalize(uv.x*cu + uv.y*cv + 1.2*cw);

                float t = 0.0;
                float d = 0.0;
                vec3 p;
                for(int i = 0; i < 60; i++) {
                    p = ro + rd * t;
                    d = map(p);
                    if(d < 0.001 || t > 12.0) break;
                    t += d;
                }

                vec3 col = vec3(0.0);
                if(t < 12.0) {
                    vec2 e = vec2(0.002, 0.0);
                    vec3 n = normalize(vec3(
                        map(p+e.xyy) - map(p-e.xyy),
                        map(p+e.yxy) - map(p-e.yxy),
                        map(p+e.yyx) - map(p-e.yyx)
                    ));
                    
                    // Orbit Trap Shimmer & Distance Estimator Glow
                    float shimmer = sin(length(p) * 15.0 - time * 8.0) * 0.5 + 0.5;
                    vec3 lightDir = normalize(vec3(sin(time), 1.0, cos(time)));
                    float diff = max(dot(n, lightDir), 0.0);
                    
                    // Hue-shifted shading
                    vec3 cool = vec3(0.145, 0.227, 0.369); // Apollo dark_navy
                    vec3 warm = vec3(0.678, 0.467, 0.341); // Apollo warm_light
                    
                    col = mix(cool, warm, diff);
                    col += vec3(0.8, 0.2, 0.5) * shimmer * (1.0 - diff) * 0.5; // Recursion bloom
                    
                    col *= exp(-0.15 * t); // Volumetric fog
                } else {
                    // Deep space gradient
                    col = mix(vec3(0.090, 0.125, 0.220), vec3(0.0), length(uv)*0.6);
                }

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    bgScene.add(new THREE.Mesh(quadGeo, bgMat));

    // SCENE 3: Post-Processing (Pixel Grid Lock + Bayer Dither + Palette Snap)
    const targetFBO = new THREE.WebGLRenderTarget(grid.width, grid.height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    });

    const postScene = new THREE.Scene();
    const postMat = new THREE.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: targetFBO.texture },
            resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            virtualRes: { value: new THREE.Vector2(320, 180) },
            time: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            uniform vec2 virtualRes;
            uniform float time;
            varying vec2 vUv;

            // Apollo 16 Palette
            const vec3 apollo[16] = vec3[16](
                vec3(0.090, 0.125, 0.220), vec3(0.145, 0.227, 0.369), vec3(0.235, 0.369, 0.545), vec3(0.310, 0.561, 0.729),
                vec3(0.451, 0.745, 0.827), vec3(0.643, 0.867, 0.859), vec3(0.098, 0.200, 0.176), vec3(0.145, 0.337, 0.180),
                vec3(0.275, 0.510, 0.196), vec3(0.459, 0.655, 0.263), vec3(0.659, 0.792, 0.345), vec3(0.816, 0.855, 0.569),
                vec3(0.302, 0.169, 0.196), vec3(0.478, 0.282, 0.255), vec3(0.678, 0.467, 0.341), vec3(0.753, 0.580, 0.451)
            );

            // 4x4 Bayer Matrix
            float getBayer(vec2 p) {
                int x = int(mod(p.x, 4.0));
                int y = int(mod(p.y, 4.0));
                int idx = y * 4 + x;
                if(idx==0) return 0.0/16.0;  if(idx==1) return 8.0/16.0;  if(idx==2) return 2.0/16.0;  if(idx==3) return 10.0/16.0;
                if(idx==4) return 12.0/16.0; if(idx==5) return 4.0/16.0;  if(idx==6) return 14.0/16.0; if(idx==7) return 6.0/16.0;
                if(idx==8) return 3.0/16.0;  if(idx==9) return 11.0/16.0; if(idx==10) return 1.0/16.0; if(idx==11) return 9.0/16.0;
                if(idx==12) return 15.0/16.0;if(idx==13) return 7.0/16.0; if(idx==14) return 13.0/16.0;if(idx==15) return 5.0/16.0;
                return 0.0;
            }

            float colorDist(vec3 a, vec3 b) {
                vec3 diff = a - b;
                return dot(diff * diff, vec3(0.299, 0.587, 0.114)); // Luminance weighted
            }

            void main() {
                // Feral Glitch / Divergence Tear
                float glitch = step(0.995, fract(sin(time * 10.0 + vUv.y * 50.0) * 43758.5453));
                vec2 warpedUV = vUv + vec2(glitch * 0.05 * sin(time * 20.0), 0.0);

                // Pixel Grid Lock
                vec2 pixelSize = 1.0 / virtualRes;
                vec2 snappedUV = floor(warpedUV / pixelSize) * pixelSize + pixelSize * 0.5;

                vec4 texColor = texture2D(tDiffuse, snappedUV);

                // Sobel Outline (Color Discontinuity)
                vec2 texel = 1.0 / virtualRes;
                vec3 cU = texture2D(tDiffuse, snappedUV + vec2(0.0, texel.y)).rgb;
                vec3 cD = texture2D(tDiffuse, snappedUV - vec2(0.0, texel.y)).rgb;
                vec3 cL = texture2D(tDiffuse, snappedUV - vec2(texel.x, 0.0)).rgb;
                vec3 cR = texture2D(tDiffuse, snappedUV + vec2(texel.x, 0.0)).rgb;
                
                float lC = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
                float lU = dot(cU, vec3(0.299, 0.587, 0.114));
                float lD = dot(cD, vec3(0.299, 0.587, 0.114));
                float lL = dot(cL, vec3(0.299, 0.587, 0.114));
                float lR = dot(cR, vec3(0.299, 0.587, 0.114));
                
                float edge = abs(lC - lU) + abs(lC - lD) + abs(lC - lL) + abs(lC - lR);

                // Ordered Dither
                vec2 screenPos = snappedUV * virtualRes;
                vec3 dithered = texColor.rgb + (getBayer(screenPos) - 0.5) * 0.35;

                // Palette Map Nearest
                vec3 bestCol = apollo[0];
                float bestDist = 10.0;
                for(int i = 0; i < 16; i++) {
                    float d = colorDist(dithered, apollo[i]);
                    if(d < bestDist) {
                        bestDist = d;
                        bestCol = apollo[i];
                    }
                }

                // Apply Outline
                if(edge > 0.15) {
                    bestCol = apollo[0]; // Snap to darkest shadow
                }

                gl_FragColor = vec4(bestCol, 1.0);
            }
        `
    });
    postScene.add(new THREE.Mesh(quadGeo, postMat));

    canvas.__three = { renderer, scene, camera, bgScene, bgCamera, bgMat, postScene, postMat, targetFBO, partMesh, posArray };
}

const { renderer, scene, camera, bgScene, bgCamera, bgMat, postScene, postMat, targetFBO, partMesh, posArray } = canvas.__three;

// RESIZE LOGIC
renderer.setSize(grid.width, grid.height, false);
if (targetFBO.width !== grid.width || targetFBO.height !== grid.height) {
    targetFBO.setSize(grid.width, grid.height);
    camera.aspect = grid.width / grid.height;
    camera.updateProjectionMatrix();
}

// INPUT SEEDING
let hash = 0;
for (let i = 0; i < input.length; i++) hash = Math.imul(31, hash) + input.charCodeAt(i) | 0;
const seed = (Math.abs(hash) / 2147483647.0);

// UNIFORMS UPDATE
const mx = (mouse.x / grid.width) * 2.0 - 1.0;
const my = -(mouse.y / grid.height) * 2.0 + 1.0;

bgMat.uniforms.time.value = time;
bgMat.uniforms.mouse.value.set(mx, my);
bgMat.uniforms.resolution.value.set(grid.width, grid.height);
bgMat.uniforms.seed.value = seed;

postMat.uniforms.time.value = time;
postMat.uniforms.resolution.value.set(grid.width, grid.height);
// Dynamic virtual resolution to keep pixels perfectly square
const aspect = grid.width / grid.height;
postMat.uniforms.virtualRes.value.set(240 * aspect, 240);

// LORENZ ATTRACTOR PARTICLES (Divergence Filament Auras)
const positions = partMesh.geometry.attributes.position.array;
let a = 10;
let b = 28 + Math.sin(time * 0.5) * 10 + (seed * 10);
let c = 8/3;
let dt = 0.006;

for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i+1];
    let z = positions[i+2];

    let dx = a * (y - x);
    let dy = x * (b - z) - y;
    let dz = x * y - c * z;

    x += dx * dt;
    y += dy * dt;
    z += dz * dt;

    // Reseed if they escape the attractor basin or stall
    if (Math.abs(x) > 60 || Math.abs(y) > 60 || Math.abs(z) > 60 || (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1)) {
        x = (Math.random() - 0.5) * 20;
        y = (Math.random() - 0.5) * 20;
        z = (Math.random() - 0.5) * 20 + 25;
    }

    positions[i] = x;
    positions[i+1] = y;
    positions[i+2] = z;
}
partMesh.geometry.attributes.position.needsUpdate = true;

// RENDER PIPELINE
renderer.setRenderTarget(targetFBO);
renderer.clear();
renderer.render(bgScene, bgCamera); // Render SDF Fractal
renderer.clearDepth(); // Ensure particles draw on top cleanly
renderer.render(scene, camera); // Render Attractor Particles

renderer.setRenderTarget(null);
renderer.render(postScene, bgCamera); // Render Pixelation + Dither + Palette Map