// Weave Pattern Shader
// Generates woven fabric appearance for plain, twill, and satin weaves.
// GLSL fragment shader — intended as a reference implementation.
// All lines commented for clarity.

// ─── Uniforms ──────────────────────────────────────────────────────────────

uniform vec2 u_resolution;       // Canvas resolution in pixels
uniform float u_time;             // Time (for animation, optional)
uniform float u_warp_count;       // Threads per unit (warp direction, vertical)
uniform float u_weft_count;       // Threads per unit (weft direction, horizontal)
uniform float u_thread_thickness; // Thread visual diameter (0.001–0.1)
uniform float u_weave_rule;       // 0=plain, 1=twill_2/1, 2=satin_4/1
uniform float u_twill_angle;      // Twill advance per row (default 1.0)
uniform float u_specular_power;   // Highlight sharpness (1–128)
uniform float u_nap_angle;        // Thread direction for anisotropic highlight (radians)
uniform float u_fuzz_amount;      // Fiber halo width (0–1)
uniform vec3  u_warp_color;       // Warp thread color (RGB)
uniform vec3  u_weft_color;       // Weft thread color (RGB)
uniform vec3  u_light_dir;        // Normalized light direction

// ─── Utilities ─────────────────────────────────────────────────────────────

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Simple 2D value noise
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// ─── Weave Logic ───────────────────────────────────────────────────────────

// Returns 1.0 if warp is on top, 0.0 if weft is on top
// at cell position (warp_index, weft_index)
float weave_cell(float warp_idx, float weft_idx, float rule) {
    if (rule < 0.5) {
        // Plain weave: alternate 1,0,1,0...
        return mod(warp_idx + weft_idx, 2.0);
    } else if (rule < 1.5) {
        // Twill 2/1: warp over for 2, under for 1
        // Diagonal advances by u_twill_angle per weft row
        float twill_phase = mod(warp_idx + weft_idx * u_twill_angle, 3.0);
        return step(1.0, twill_phase); // 0 or 1: under for 1 row, over for 2
    } else {
        // Satin 4/1: warp over 4, under 1
        // Interlacing points distributed with offset
        float satin_phase = mod(warp_idx + weft_idx * 2.0, 5.0);
        return step(1.0, satin_phase); // under for 1 row, over for 4
    }
}

// ─── Main ──────────────────────────────────────────────────────────────────

void main() {
    // Normalized UV coordinates (0 to 1)
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Scale UV to thread count — each unit = one thread cell
    vec2 thread_uv = uv * vec2(u_warp_count, u_weft_count);

    // Integer and fractional parts of thread position
    vec2 thread_cell = floor(thread_uv);      // which thread cell
    vec2 cell_local = fract(thread_uv);       // position within cell (0–1)

    // Determine if warp or weft is on top in this cell
    float warp_on_top = weave_cell(thread_cell.x, thread_cell.y, u_weave_rule);

    // ─ Thread visibility (circle distance field within cell) ─────────────
    // Center of cell is at (0.5, 0.5)
    // Thread body is visible inside the circle of u_thread_thickness radius
    float dist_to_warp_center = abs(cell_local.x - 0.5);   // warp runs vertically
    float dist_to_weft_center = abs(cell_local.y - 0.5);   // weft runs horizontally

    // Warp thread visible in vertical stripe
    float warp_visible = 1.0 - smoothstep(
        u_thread_thickness * 0.5 - 0.005,
        u_thread_thickness * 0.5 + 0.005,
        dist_to_warp_center
    );

    // Weft thread visible in horizontal stripe
    float weft_visible = 1.0 - smoothstep(
        u_thread_thickness * 0.5 - 0.005,
        u_thread_thickness * 0.5 + 0.005,
        dist_to_weft_center
    );

    // Determine which thread color to use based on interlacing
    // If warp_on_top=1 and we're in the warp stripe, show warp color
    // If warp_on_top=0 and we're in the weft stripe, show weft color
    vec3 thread_color;
    float thread_mask;

    if (warp_on_top > 0.5) {
        // Warp is on top — warp thread covers weft at intersection
        thread_color = u_warp_color;
        thread_mask = warp_visible;
    } else {
        // Weft is on top
        thread_color = u_weft_color;
        thread_mask = weft_visible;
    }

    // Show the underlying thread where both are visible
    // (at non-intersection points, the lower thread peeks out)
    vec3 lower_color = (warp_on_top > 0.5) ? u_weft_color : u_warp_color;
    float lower_mask = (warp_on_top > 0.5) ? weft_visible : warp_visible;
    // Where the lower thread isn't covered by upper, show it
    thread_mask = max(thread_mask, lower_mask * (1.0 - thread_mask));
    thread_color = mix(lower_color, thread_color,
        (warp_on_top > 0.5) ? warp_visible : weft_visible);

    // ─ Anisotropic Thread Highlight ─────────────────────────────────────
    // Thread direction determines specular highlight angle
    vec2 thread_dir = vec2(cos(u_nap_angle), sin(u_nap_angle));
    // Light direction projected to surface
    vec2 light_dir_2d = normalize(u_light_dir.xy);
    float aniso = pow(max(dot(light_dir_2d, thread_dir), 0.0), u_specular_power);
    vec3 highlight = vec3(aniso * 0.3);  // Additive highlight

    // ─ Fiber Fuzz (Halo) ────────────────────────────────────────────────
    // Distance to nearest thread center determines halo falloff
    float nearest_thread_dist = min(dist_to_warp_center, dist_to_weft_center);
    float fuzz = exp(-nearest_thread_dist * 20.0 / max(u_fuzz_amount, 0.001));
    fuzz *= u_fuzz_amount;
    vec3 fuzz_color = thread_color * fuzz;

    // ─ Thread Micro-Irregularity (Slub/Twist Noise) ──────────────────────
    float slub_noise = noise(thread_cell * 0.5) * 0.05;  // Very subtle
    float thickness_variation = 1.0 + slub_noise;

    // ─ Compose Final Color ──────────────────────────────────────────────
    vec3 background_color = mix(u_warp_color, u_weft_color, 0.5) * 0.3;
    vec3 final_color = mix(background_color, thread_color + highlight, thread_mask);
    final_color += fuzz_color * (1.0 - thread_mask);

    // Output
    gl_FragColor = vec4(final_color, 1.0);
}
