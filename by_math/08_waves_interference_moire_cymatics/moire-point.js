const FERAL_MOIRE_GRAFFITI = `
// GLSL 3.0 Feral Graffiti Moiré
in vec2 vUv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_isPressed;

// Feral Noise Engine (Simplex 2D)
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
           + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Fractional Brownian Motion for Spray/Drip Textures
float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
        v += a * snoise(x);
        x = rot * x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// Halftone Structural Core (Repo 1: 08_cmyk_separation)
// Warped to feel like dripping spray paint (Repo 2: grafitti_aesthetic)
float halftone(vec2 uv, float scale, float angle, vec2 offset) {
    float c = cos(angle), s = sin(angle);
    vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    vec2 st = rotUV * scale + offset;
    vec2 grid = abs(fract(st) - 0.5);
    // Smoothstep creates soft, bleeding edges like wet paint
    return smoothstep(0.4, 0.05, length(grid)); 
}

void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect;
    vec2 m = (u_mouse - 0.5) * aspect;
    
    // 1. GRAFFITI DRIP WARPING (The Vandalism)
    // Domain warp the space heavily based on noise and time
    vec2 warp = vec2(
        fbm(p * 2.5 + u_time * 0.15),
        fbm(p * 2.5 - u_time * 0.1 + vec2(10.0))
    );
    
    // Mouse interaction: Smudge the wet paint, creating a phase singularity
    float mDist = length(p - m);
    float smudge = exp(-mDist * 8.0) * u_isPressed;
    warp += normalize(p - m + 0.0001) * smudge * 0.8;
    
    // Gravity drip: y-axis pulling down based on noise structure
    float drip = smoothstep(0.2, 0.8, fbm(p * 8.0)) * 0.1;
    vec2 distortedUV = p + warp * 0.08;
    distortedUV.y -= drip * fract(u_time * 0.05) * 2.0; // Sagging over time
    
    // 2. CMYK MOIRÉ SYSTEM (The Point)
    // Angles slowly drifting to create dynamic interference rosettes
    float t = u_time * 0.2;
    
    // Classic CMYK angles, perturbed by time and space
    float aC = 0.261 + sin(t * 0.5) * 0.1 + warp.x * 0.2;
    float aM = 1.309 + cos(t * 0.6) * 0.1 - warp.y * 0.2;
    float aY = 0.000 + sin(t * 0.4) * 0.1 + warp.x * 0.1;
    float aK = 0.785 + cos(t * 0.7) * 0.1 - warp.y * 0.1;
    
    // High frequency scales for tight moiré (Creates macro-fringes)
    float baseScale = 120.0 + fbm(p * 5.0) * 20.0; // Noise modulates frequency!
    
    // Machine Hesitation: Stuttering spray can offsets
    float stutter = step(0.9, fract(u_time * 4.0)) * 0.05;
    vec2 offC = vec2(sin(t), cos(t)) * 0.5 + stutter;
    vec2 offM = vec2(cos(t*1.1), sin(t*0.9)) * 0.5;
    vec2 offY = vec2(sin(t*1.3), cos(t*1.2)) * 0.5 - stutter;
    vec2 offK = vec2(cos(t*0.7), sin(t*1.4)) * 0.5;
    
    // Slight scale differentials create the massive Chromatic Moiré
    float cVal = halftone(distortedUV, baseScale * 1.00, aC, offC);
    float mVal = halftone(distortedUV, baseScale * 1.03, aM, offM);
    float yVal = halftone(distortedUV, baseScale * 0.97, aY, offY);
    float kVal = halftone(distortedUV, baseScale * 1.01, aK, offK);
    
    // 3. COLOR MIXING (Additive Moiré for maximum visible interference)
    vec3 color = vec3(0.0);
    color += vec3(0.0, 0.9, 1.0) * cVal; // Cyan
    color += vec3(1.0, 0.0, 0.8) * mVal; // Magenta
    color += vec3(1.0, 1.0, 0.0) * yVal; // Yellow
    
    // Black acts as a heavy subtractive mask, creating sharp fringes and dirt
    color *= (1.0 - kVal * 0.85);
    
    // Add "overspray" glow where moiré aligns perfectly (white-hot spots)
    float alignIntensity = cVal * mVal * yVal;
    color += vec3(alignIntensity * 2.0);
    
    // Push contrast to make the interference pop (The Moiré Principle)
    color = smoothstep(0.0, 1.2, color);
    
    // Background concrete texture
    vec3 bg = vec3(0.08, 0.09, 0.10) + fbm(p * 100.0) * 0.03;
    
    // Blend spray onto wall
    float paintMask = smoothstep(0.1, 0.3, max(max(cVal, mVal), yVal) + kVal);
    
    // Vignette
    float vig = 1.0 - length(p) * 0.6;
    
    fragColor = vec4(mix(bg, color, paintMask) * vig, 1.0);
}
`;

const VERTEX_SHADER = `
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

if (!canvas.__three) {
    try {
        if (!ctx) throw new Error("Context not available");
        
        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FERAL_MOIRE_GRAFFITI,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_isPressed: { value: 0.0 }
            },
            depthWrite: false,
            depthTest: false
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
    material.uniforms.u_resolution.value.set(grid.width, grid.height);
    
    // Map mouse to 0.0 - 1.0 range, flipping Y for GLSL
    const mx = mouse.x / grid.width;
    const my = 1.0 - (mouse.y / grid.height);
    material.uniforms.u_mouse.value.set(mx, my);
    material.uniforms.u_isPressed.value = mouse.isPressed ? 1.0 : 0.0;
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);