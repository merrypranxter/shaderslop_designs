float herringboneWeave(vec2 uv, float count, float period){
    vec2 cell = floor(uv * count);
    float block = mod(floor(cell.y / period), 2.0);
    float dir = mix(1.0, -1.0, block);
    float phase = mod(cell.x + dir * cell.y, 4.0);
    return step(phase, 1.5);
}
