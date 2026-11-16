float crossLine(vec2 p, float w){
    float d1 = abs(p.x - p.y);
    float d2 = abs((1.0 - p.x) - p.y);
    return 1.0 - min(smoothstep(w, w+0.02, d1), smoothstep(w, w+0.02, d2));
}
float crossStitchCell(vec2 uv, float cells, float width){
    vec2 cell = fract(uv * cells);
    return crossLine(cell, width);
}
