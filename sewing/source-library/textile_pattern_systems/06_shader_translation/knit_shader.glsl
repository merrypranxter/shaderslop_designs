// Knit Pattern Shader
// Generates the appearance of stockinette and garter knit stitch fabric.
// Includes V-stitch field, purl bump option, yarn fuzz, and cable displacement.
// GLSL fragment shader — reference implementation, all lines commented.

// ─── Uniforms ──────────────────────────────────────────────────────────────

uniform vec2  u_resolution;       // Canvas resolution in pixels
uniform float u_stitch_count_x;   // Stitches per unit width
uniform float u_row_count_y;      // Rows per unit height
uniform float u_stitch_mode;      // 0=stockinette, 1=garter, 2=rib_1x1
uniform float u_yarn_thickness;   // Yarn visual diameter (0.01–0.15)
uniform float u_fuzz_amount;      // Fiber halo amount (0–1; mohair=0.8, smooth=0.0)
uniform float u_fuzz_frequency;   // Fuzz noise frequency (20–150)
uniform float u_specular_power;   // Yarn highlight sharpness (2–32)
uniform float u_tension_variation;// Slight stitch size irregularity (0=machine, 0.1=hand)
uniform vec3  u_yarn_color;       // Yarn color
uniform vec3  u_yarn_color_B;     // Second color (for stranded/fair isle, optional)
uniform float u_colorwork_phase;  // Color change phase for stranded work
uniform vec3  u_light_dir;        // Normalized light direction

// ─── Utilities ─────────────────────────────────────────────────────────────

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(random(i), random(i + vec2(1.0, 0.0)), u.x),
        mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

// ─── Stitch Shape Functions ────────────────────────────────────────────────

// V-stitch shape (knit stitch, right-side)
// Returns 0–1 where 1 is the center of the V-stitch body
float v_stitch(vec2 local_uv) {
    // V shape: two diagonal legs meeting at bottom center
    float x = local_uv.x - 0.5;  // center on 0
    float y = local_uv.y;

    // Left leg: x < 0, going from top-left to bottom-center
    float left_leg = 1.0 - smoothstep(0.0, 0.08, abs(x + y * 0.4));
    // Right leg: x > 0, going from top-right to bottom-center
    float right_leg = 1.0 - smoothstep(0.0, 0.08, abs(x - y * 0.4));

    // V body is the union of both legs
    return max(left_leg, right_leg);
}

// Purl bump shape (wrong-side or garter)
// Returns 0–1 where 1 is the bump itself
float purl_bump(vec2 local_uv) {
    // Horizontal arc centered in the cell
    float x = local_uv.x - 0.5;
    float y = local_uv.y - 0.35;  // bump sits lower in cell

    // Circular arc shape
    float dist = length(vec2(x * 1.5, y));
    return 1.0 - smoothstep(0.08, 0.15, dist);
}

// ─── Main ──────────────────────────────────────────────────────────────────

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Scale to stitch grid
    vec2 stitch_uv = uv * vec2(u_stitch_count_x, u_row_count_y);

    // Integer cell position and local position within cell
    vec2 cell = floor(stitch_uv);
    vec2 local = fract(stitch_uv);

    // ─ Tension Variation (hand-knitting irregularity) ────────────────────
    // Real hand-knitting has slight stitch size variation
    float tension = 1.0 + (random(cell) - 0.5) * u_tension_variation;
    vec2 local_adj = (local - 0.5) * tension + 0.5;  // scale around center

    // ─ Stitch Mode Selection ─────────────────────────────────────────────
    float stitch_alpha;

    if (u_stitch_mode < 0.5) {
        // Stockinette: all face stitches are knit (V-shape)
        stitch_alpha = v_stitch(local_adj);

    } else if (u_stitch_mode < 1.5) {
        // Garter: every row is knit = alternating V and purl rows
        // Even rows: V stitch; Odd rows: purl bumps
        bool is_purl_row = mod(cell.y, 2.0) > 0.5;
        stitch_alpha = is_purl_row ? purl_bump(local_adj) : v_stitch(local_adj);

    } else {
        // Rib 1x1: alternating columns of knit and purl
        bool is_purl_col = mod(cell.x, 2.0) > 0.5;
        stitch_alpha = is_purl_col ? purl_bump(local_adj) : v_stitch(local_adj);
    }

    // ─ Colorwork (Stranded / Fair Isle) ──────────────────────────────────
    // Simple two-color Fair Isle: color changes every few stitches
    float color_period = 8.0;  // change color every 8 stitches
    float color_wave = sin(cell.x / color_period * 6.28318 + u_colorwork_phase);
    // Float (color B) shows where not in use — slightly recessed
    float is_color_B = step(0.0, color_wave);  // 0 = color A, 1 = color B
    vec3 yarn_color = mix(u_yarn_color, u_yarn_color_B, is_color_B);

    // ─ Yarn Highlight (Curved Surface Simulation) ─────────────────────────
    // The yarn body is a cylinder. The top of the stitch catches more light.
    // Stitch height approximation from local_adj.y
    float stitch_height = stitch_alpha * (1.0 - (local_adj.y - 0.5) * 0.5);
    float normal_y = stitch_height;  // Approximate normal Y component

    // Lambertian shading on the stitch surface
    float light_up = max(dot(u_light_dir, vec3(0.0, 0.0, 1.0)), 0.0);
    float diffuse = mix(0.4, 1.0, normal_y * light_up);

    // Specular highlight on yarn curve
    vec3 view_dir = vec3(0.0, 0.0, 1.0);  // Orthographic view from above
    vec3 H = normalize(u_light_dir + view_dir);
    float spec = pow(max(dot(H, vec3(0.0, normal_y, stitch_height)), 0.0),
                     u_specular_power);

    // ─ Fiber Fuzz Halo ───────────────────────────────────────────────────
    float fuzz_noise = noise(uv * u_fuzz_frequency);
    // Halo is visible just outside the stitch body, and at edges of stitch
    float halo_dist = 1.0 - smoothstep(0.3, 0.5, stitch_alpha);
    float fuzz = halo_dist * fuzz_noise * u_fuzz_amount;

    // ─ Compose Final Color ────────────────────────────────────────────────
    // Background: slightly darker version of yarn color (reverse of fabric)
    vec3 background = yarn_color * 0.25;

    // Stitch body with shading
    vec3 stitch_color = yarn_color * diffuse + vec3(spec * 0.2);

    // Fuzz blends stitch color into background at edges
    vec3 fuzz_color = mix(background, stitch_color, 0.6);

    // Composite: stitch on top, fuzz in halo zone, background elsewhere
    vec3 final_color = background;
    final_color = mix(final_color, fuzz_color, fuzz);
    final_color = mix(final_color, stitch_color, stitch_alpha);

    gl_FragColor = vec4(final_color, 1.0);
}
