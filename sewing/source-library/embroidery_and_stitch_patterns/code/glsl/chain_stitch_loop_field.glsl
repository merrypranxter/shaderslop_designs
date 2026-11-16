// Decorative loop cell for chain-stitch approximation.
float ring(vec2 p, vec2 c, float r, float w){
    float d = abs(length(p-c)-r);
    return 1.0 - smoothstep(w, w+0.01, d);
}
float chainLoop(vec2 uv, float cells){
    vec2 p = fract(uv * cells);
    p.y = (p.y - 0.5) * 1.4 + 0.5;
    return ring(p, vec2(0.5,0.5), 0.32, 0.045);
}
