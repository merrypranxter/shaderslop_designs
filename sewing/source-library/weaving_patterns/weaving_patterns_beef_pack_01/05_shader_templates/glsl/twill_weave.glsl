// Twill mask with diagonal step
float twillWeave(vec2 uv, float count, float stepSize, float floatWidth){
    vec2 cell = floor(uv * count);
    float phase = mod(cell.x + cell.y * stepSize, floatWidth);
    return step(phase, floatWidth * 0.5);
}
