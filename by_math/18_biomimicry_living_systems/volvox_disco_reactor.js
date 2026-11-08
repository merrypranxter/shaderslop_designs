try {
    if (!canvas.__three) {
        if (!ctx) throw new Error("WebGL 2 context not available");

        const renderer = new THREE.WebGLRenderer({ canvas, context: ctx, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        camera.position.z = 1;

        const uniforms = {
            u_time: { value: 0 },
            u_resolution: { value: new THREE.Vector2(grid.width, grid.height) },
            u_mouse: { value: new THREE.Vector2(0, 0) },
            u_mouse_pressed: { value: 0.0 }
        };

        const material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: uniforms,
            vertexShader: `
                out vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_mouse_pressed;

in vec2 vUv;
out vec4 fragColor;

#define NUM_ORG 15
#define PI 3.14159265359

// --- Core Math & Hashes ---
float hash11(float n) { return fract(sin(n) * 43758.5453); }
vec2 hash21(float n) {
    return vec2(
        fract(sin(n) * 43758.5453),
        fract(cos(n * 1.324) * 43758.5453)
    );
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

// --- Sparkles Repo: Temporal Stochastic Sparkle ---
float stochastic_sparkle(vec2 uv, float density, float t) {
    // Golden angle temporal offset for anti-flicker
    float temporal_offset = fract(t * 0.1) * 2.39996;
    vec2 hash_uv = uv * 800.0 + vec2(cos(temporal_offset), sin(temporal_offset)) * 5.0;
    float h = hash12(hash_uv);
    float threshold = 1.0 - density;
    return smoothstep(threshold - 0.02, threshold, h);
}

// --- Structural Color / Color Systems Repo: Physical Spectral Conversion ---
vec3 wavelength_to_rgb(float wavelength) {
    vec3 xyz;
    if (wavelength >= 380.0 && wavelength < 440.0) {
        xyz.x = -(wavelength - 440.0) / (440.0 - 380.0);
        xyz.y = 0.0;
        xyz.z = 1.0;
    } else if (wavelength < 490.0) {
        xyz.x = 0.0;
        xyz.y = (wavelength - 440.0) / (490.0 - 440.0);
        xyz.z = 1.0;
    } else if (wavelength < 510.0) {
        xyz.x = 0.0;
        xyz.y = 1.0;
        xyz.z = -(wavelength - 510.0) / (510.0 - 490.0);
    } else if (wavelength < 580.0) {
        xyz.x = (wavelength - 510.0) / (580.0 - 510.0);
        xyz.y = 1.0;
        xyz.z = 0.0;
    } else if (wavelength < 645.0) {
        xyz.x = 1.0;
        xyz.y = -(wavelength - 645.0) / (645.0 - 580.0);
        xyz.z = 0.0;
    } else if (wavelength <= 780.0) {
        xyz.x = 1.0;
        xyz.y = 0.0;
        xyz.z = 0.0;
    } else {
        xyz = vec3(0.0);
    }
    
    // XYZ to linear sRGB matrix (column-major)
    mat3 xyz_to_rgb = mat3(
        3.2406, -0.9689, 0.0557,
        -1.5372, 1.8758, -0.2040,
        -0.4986, 0.0415, 1.0570
    );
    return max(xyz_to_rgb * xyz, 0.0);
}

// --- Domain Warping ---
float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    vec2 shift = vec2(100.0);
    for(int i = 0; i < 4; i++) {
        f += amp * sin(p.x + sin(p.y));
        p = p * 2.0 * rot(0.5) + shift;
        amp *= 0.5;
    }
    return f;
}

// --- Lenia Repo: Continuous CA Kernels ---
float leniaRing(float rn, float mu, float sig) {
    float d = rn - mu;
    return exp(-(d * d) / (2.0 * sig * sig));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    vec2 m = (u_mouse - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    
    // Global fluid warp
    vec2 warp = vec2(fbm(uv * 3.0 + u_time * 0.15), fbm(uv * 3.0 - u_time * 0.15 + 10.0));
    vec2 puv = uv + warp * 0.05;
    
    // Mouse shockwave
    float mouseDist = length(puv - m);
    float shock = 0.0;
    if (u_mouse_pressed > 0.5) {
        shock = sin(mouseDist * 40.0 - u_time * 20.0) * exp(-mouseDist * 8.0);
        puv += normalize(puv - m) * shock * 0.04;
    }
    
    // Lenia Multi-Channels
    float ch0 = 0.0; // Body
    float ch1 = 0.0; // Excitation
    float ch2 = 0.0; // Inhibition
    float ch3 = 0.0; // Trace (Memory)
    float ch4 = 0.0; // Scaffold
    
    float global_fbm = fbm(puv * 10.0 - u_time * 0.5);
    
    // Procedural Organism Loop
    for(int i = 0; i < NUM_ORG; i++) {
        float fi = float(i);
        vec2 seed = hash21(fi);
        
        // Orbital mechanics + splitting
        float phase = u_time * (0.1 + seed.x * 0.2) + seed.y * 10.0;
        
        // Mitosis logic: organism splits into two sub-lobes
        float split = sin(u_time * 0.4 + fi) * 0.5 + 0.5;
        split = smoothstep(0.4, 0.6, split); 
        
        float scale = 0.06 + seed.y * 0.1;
        float radius = 0.15 + seed.x * 0.5 + sin(u_time * 0.2 + fi) * 0.1;
        
        // Base position orbiting center + drift
        vec2 center = vec2(cos(phase), sin(phase)) * radius;
        center += vec2(sin(u_time * 0.1 + seed.y * 5.0), cos(u_time * 0.13 + seed.x * 5.0)) * 0.2;
        
        // Motion direction for excitation/inhibition asymmetry
        vec2 dir = normalize(vec2(-sin(phase), cos(phase))); 
        dir = rot(sin(u_time * 0.5 + fi) * 0.6) * dir; // wobble
        
        vec2 lobeOffset = rot(phase * 2.5) * vec2(1.0, 0.0) * split * scale * 1.5;
        
        for(int j = 0; j < 2; j++) {
            float fj = float(j);
            vec2 c = center + (fj > 0.5 ? lobeOffset : -lobeOffset);
            
            // Mouse attraction
            if (u_mouse_pressed > 0.5) {
                vec2 dirToMouse = m - c;
                c += normalize(dirToMouse) * exp(-length(dirToMouse) * 3.0) * 0.08 * (seed.x > 0.5 ? 1.0 : -0.5);
            }
            
            vec2 d = puv - c;
            float r = length(d);
            float angle = atan(d.y, d.x);
            
            // Organic pulsing / membrane deformation
            float deform = 1.0 + 0.1 * sin(3.0 * angle + u_time * 4.0 + fi)
                              + 0.08 * sin(7.0 * angle - u_time * 2.5);
            float rn = (r * deform) / scale;
            
            // Ch0: Body (Core, Shell, Halo sums)
            float core = leniaRing(rn, 0.1, 0.05);
            float shell = leniaRing(rn, 0.4, 0.08) * 0.8;
            float halo = leniaRing(rn, 0.7, 0.1) * 0.3;
            ch0 += clamp(core + shell + halo, 0.0, 1.0);
            
            // Ch1: Excitation (asymmetric cloud ahead)
            vec2 dEx = puv - (c + dir * scale * 0.8);
            float par = dot(dEx, dir);
            float perp = length(dEx - par * dir);
            ch1 += 0.8 * exp(-((par*par)/(scale*scale*0.15) + (perp*perp)/(scale*scale*0.5)) * 2.0);
            
            // Ch2: Inhibition (diffuse cloud behind)
            vec2 dIn = puv - (c - dir * scale * 0.7);
            ch2 += 0.6 * exp(-(dot(dIn, dIn) / (scale * scale * 1.5)) * 1.5);
            
            // Ch3: Trace (smear trail)
            float rTr = length(puv - c + dir * scale * 1.5) / (scale * 3.0);
            ch3 += 0.5 * exp(-rTr * 2.0) * abs(global_fbm);
            
            // Ch4: Scaffold (geometric guide)
            float hex = max(abs(d.x)*0.866025 + abs(d.y)*0.5, abs(d.y)) / scale;
            ch4 += smoothstep(0.1, 0.0, abs(hex - 0.8)) * 0.5 * exp(-r*4.0);
        }
    }
    
    // Reaction-diffusion style sharpening
    ch0 = smoothstep(0.2, 0.8, ch0) - smoothstep(0.8, 1.5, ch0) * 0.2;
    ch1 = smoothstep(0.1, 0.9, ch1);
    ch2 = smoothstep(0.3, 1.2, ch2);
    
    // Base Palettes
    vec3 cBody = vec3(1.0, 0.05, 0.5);   // Hot magenta
    vec3 cExcite = vec3(0.0, 0.9, 1.0);  // Cyan
    vec3 cInhibit = vec3(0.3, 0.0, 0.7); // Violet
    vec3 cScaffold = vec3(1.0, 0.8, 0.6);// White/orange
    
    // Deep violet/blue living field
    vec3 bg = vec3(0.02, 0.01, 0.05);
    bg += vec3(0.04, 0.02, 0.08) * fbm(uv * 2.0 + u_time * 0.05);
    
    vec3 col = bg;
    col += cInhibit * ch2;
    col += cExcite * ch1;
    col += cBody * ch0 * 1.3;
    col += cScaffold * ch4;
    
    // Iridescent Trace (Ch3) using structural color wavelength mapping
    float wl = 400.0 + 300.0 * fract(ch3 * 1.5 - u_time * 0.3);
    vec3 iridescence = wavelength_to_rgb(wl);
    col += iridescence * ch3 * 1.5;
    
    // Sparkle layer on the membrane
    float sparkle = stochastic_sparkle(vUv, ch0 * 0.4 + ch1 * 0.2, u_time);
    col += vec3(1.0, 0.9, 1.0) * sparkle * 2.5;
    
    // Additive overlap / white-hot core
    float totalDensity = ch0 + ch1*0.5 + ch2*0.2;
    col += vec3(1.0, 0.9, 0.9) * smoothstep(1.0, 1.6, totalDensity);
    
    // Chromatic aberration (radial)
    float distSq = dot(uv, uv);
    col.r += ch0 * 0.15 * sin(distSq * 20.0 - u_time * 5.0);
    col.b += ch0 * 0.15 * cos(distSq * 20.0 - u_time * 5.0);
    
    // Shockwave flash
    if (u_mouse_pressed > 0.5) {
        col += vec3(0.0, 0.8, 1.0) * shock * 0.8;
        col += vec3(1.0) * smoothstep(0.0, 0.015, abs(mouseDist - mod(u_time*2.0, 1.0)*0.5)) * exp(-mouseDist*6.0);
    }
    
    // Vignette
    col *= smoothstep(1.3, 0.2, length(uv));
    
    // Tonemapping
    col = col / (1.0 + col);
    col = pow(col, vec3(1.0/2.2)); // Gamma correction
    
    fragColor = vec4(col, 1.0);
}
            `
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        canvas.__three = { renderer, scene, camera, material };
    }

    const { renderer, scene, camera, material } = canvas.__three;

    if (material && material.uniforms) {
        if (material.uniforms.u_time) material.uniforms.u_time.value = time;
        if (material.uniforms.u_resolution) material.uniforms.u_resolution.value.set(grid.width, grid.height);
        if (material.uniforms.u_mouse) material.uniforms.u_mouse.value.set(mouse.x, grid.height - mouse.y);
        if (material.uniforms.u_mouse_pressed) material.uniforms.u_mouse_pressed.value = mouse.isPressed ? 1.0 : 0.0;
    }

    renderer.setSize(grid.width, grid.height, false);
    renderer.render(scene, camera);

} catch (e) {
    console.error("WebGL Initialization Failed:", e);
}