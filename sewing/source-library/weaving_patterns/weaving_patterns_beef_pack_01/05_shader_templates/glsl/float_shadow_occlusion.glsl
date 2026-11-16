float floatShadow(vec2 uv, float mask, float threadScale){
    vec2 f = fract(uv * threadScale) - 0.5;
    float gap = min(abs(f.x), abs(f.y));
    float occlusion = 1.0 - smoothstep(0.0, 0.08, gap);
    return occlusion * 0.25 * (0.5 + 0.5 * mask);
}
