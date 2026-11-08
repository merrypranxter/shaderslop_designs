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

#define PI 3.14159265359
#define MAX_ITER 60

// Complex Math & Mobius Transformations
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
vec2 conj(vec2 z) { return vec2(z.x, -z.y); }

vec2 mobius_translate(vec2 z, vec2 p) {
    return cdiv(z - p, vec2(1.0, 0.0) - cmul(conj(p), z));
}

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Lisa Frank Overclocked Neon Palette
vec3 neonPalette(float t) {
    t = fract(t);
    vec3 lfCol;
    if(t < 0.2)      lfCol = mix(vec3(1.0, 0.0, 0.5), vec3(0.6, 0.0, 1.0), t/0.2); // Hot Pink to Purple
    else if(t < 0.4) lfCol = mix(vec3(0.6, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (t-0.2)/0.2); // Purple to Cyan
    else if(t < 0.6) lfCol = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t-0.4)/0.2); // Cyan to Lime
    else if(t < 0.8) lfCol = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t-0.6)/0.2); // Lime to Yellow
    else             lfCol = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.5), (t-0.8)/0.2); // Yellow to Hot Pink
    return lfCol;
}

void main() {
    // Map screen UV to Poincare Disk coordinates
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;
    
    float r_uv = length(uv);
    vec2 z = uv;
    
    // Domain Warp: Animate the view center via Mobius translation
    float t_anim = u_time * 0.2;
    vec2 center = vec2(cos(t_anim), sin(t_anim * 1.3)) * 0.6;
    z = mobius_translate(z, center);
    z *= rot(u_time * 0.1);
    
    // Hyperbolic Tiling {5,4} - Fold to Fundamental Domain
    int p_sym = 5; 
    float sector = PI / float(p_sym);
    
    // Geodesic circle for the {5,4} reflection group
    // Breathing deformation (quasi-fuchsian distortion)
    float c_dist = 1.3 + 0.05 * sin(u_time * 0.3); 
    float r_circle = sqrt(c_dist * c_dist - 1.0);
    vec2 C = vec2(c_dist, 0.0);
    
    int depth = 0;
    for(int i = 0; i < MAX_ITER; i++) {
        bool changed = false;
        
        // 1. Fold across the symmetry sector lines
        float a = (z.x == 0.0 && z.y == 0.0) ? 0.0 : atan(z.y, z.x);
        a = mod(a + 2.0 * PI, 2.0 * PI);
        float amod = mod(a, 2.0 * sector);
        float a_fold = amod;
        if(amod > sector) {
            a_fold = 2.0 * sector - amod;
        }
        if(abs(a_fold - a) > 0.0001 && length(z) > 0.00001) {
            z = length(z) * vec2(cos(a_fold), sin(a_fold));
            changed = true;
        }
        
        // 2. Fold across the geodesic circle
        vec2 dz = z - C;
        float d2 = dot(dz, dz);
        if(d2 < r_circle * r_circle) {
            z = C + (r_circle * r_circle) * dz / d2;
            changed = true;
        }
        
        if(!changed) break;
        depth++;
    }
    
    // z is now inside the fundamental domain. 
    // Inject the Lisa Frank aesthetic.
    vec2 zw = z;
    
    // Domain warp the interior to make the animal print "flow"
    zw += 0.05 * vec2(sin(zw.y * 20.0 + u_time), cos(zw.x * 20.0 - u_time));
    
    // Cellular noise for Leopard Spots
    vec2 p_leopard = zw * 12.0;
    vec2 ip = floor(p_leopard);
    vec2 fp = fract(p_leopard);
    float d = 1.0;
    vec2 nearest = vec2(0.0);
    for(int y = -1; y <= 1; y++) {
        for(int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 r = fract(sin(vec2(dot(ip + o, vec2(12.9898, 78.233)), dot(ip + o, vec2(39.346, 11.135)))) * 43758.5453);
            r = 0.5 + 0.4 * sin(u_time * 1.5 + 6.2831 * r); // Jittering spots
            vec2 diff = o + r - fp;
            float dist = length(diff);
            if(dist < d) {
                d = dist;
                nearest = ip + o;
            }
        }
    }
    
    // Break the rings to make it look organic
    vec2 centerDiff = fp - (nearest - ip);
    float angle = (centerDiff.x == 0.0 && centerDiff.y == 0.0) ? 0.0 : atan(centerDiff.y, centerDiff.x);
    float broken = smoothstep(0.0, 0.5, sin(angle * 3.0 + nearest.x * 10.0));
    
    float spotShape = smoothstep(0.15, 0.25, d) * smoothstep(0.45, 0.35, d);
    spotShape *= (0.5 + 0.5 * broken); // Broken outlines
    float innerSpot = smoothstep(0.2, 0.1, d); // Filled centers
    
    // Color mapping based on orbit depth and distance
    float hue = length(zw) * 3.0 - u_time * 0.8 + float(depth) * 0.15;
    vec3 baseCol = neonPalette(hue);
    
    vec3 spotOutlineCol = vec3(0.1, 0.0, 0.2); // Dark purple outline
    float rndColor = fract(sin(dot(nearest, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 innerSpotCol = neonPalette(hue + 0.3 + rndColor * 0.5);
    
    vec3 finalCol = mix(baseCol, spotOutlineCol, spotShape);
    finalCol = mix(finalCol, innerSpotCol, innerSpot);
    
    // Lisa Frank Stars
    vec2 star_p = fract(zw * 6.0) - 0.5;
    vec2 star_id = floor(zw * 6.0);
    vec2 star_rnd = fract(sin(vec2(dot(star_id, vec2(1.1, 2.2)), dot(star_id, vec2(3.3, 4.4)))) * 43758.5);
    star_p += (star_rnd - 0.5) * 0.5; 
    
    float s = 0.0;
    s += smoothstep(0.1, 0.0, length(star_p)); // core glow
    s += smoothstep(0.02, 0.0, abs(star_p.x)) * smoothstep(0.4, 0.0, abs(star_p.y)); // vertical ray
    s += smoothstep(0.02, 0.0, abs(star_p.y)) * smoothstep(0.4, 0.0, abs(star_p.x)); // horizontal ray
    
    float showStar = step(0.7, star_rnd.x); // 30% chance of star
    finalCol += s * showStar * vec3(1.0, 0.9, 1.0); 
    
    // Overwhelm the contrast (Lisa Frank rule #1)
    finalCol = pow(finalCol, vec3(0.8));
    finalCol *= 1.2; 
    finalCol = clamp(finalCol, 0.0, 1.0);
    
    // Background outside the Poincare disk
    vec3 bgCol = neonPalette(uv.x * 0.5 + uv.y * 0.5 - u_time * 0.2) * 0.15;
    float bgStar = pow(fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453), 100.0);
    bgCol += bgStar * 0.5;
    float diskGlow = smoothstep(1.05, 0.99, r_uv) * 0.5;
    bgCol += diskGlow * neonPalette(u_time);
    
    // Antialiased boundary masking
    float diskMask = smoothstep(1.0, 0.99, r_uv);
    vec3 outputCol = mix(bgCol, finalCol, diskMask);
    
    gl_FragColor = vec4(outputCol, 1.0);
}
`;

if (!canvas.__three) {
    try {
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error("WebGL 2 not supported or context occupied");
        
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, context: gl });
        const scene = new THREE.Scene();
        // A simple orthographic camera isn't strictly necessary since we map screen coords directly, 
        // but setting up a PerspectiveCamera is standard boiler-plate.
        const camera = new THREE.PerspectiveCamera(75, grid.width / grid.height, 0.1, 1000);
        camera.position.z = 1;
        
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

if (material && material.uniforms) {
    if (material.uniforms.u_time) {
        material.uniforms.u_time.value = time;
    }
    if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(grid.width, grid.height);
    }
}

renderer.setSize(grid.width, grid.height, false);
renderer.render(scene, camera);