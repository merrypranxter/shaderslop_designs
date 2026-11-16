float hash21(vec2 p){ return fract(sin(dot(p, vec2(27.619, 57.583))) * 43758.5453); }
float fiberFuzz(vec2 uv, float scale){
    float n = hash21(floor(uv * scale));
    return smoothstep(0.72, 1.0, n);
}
