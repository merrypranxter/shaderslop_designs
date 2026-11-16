// Plain weave mask: 1.0 = warp visible, 0.0 = weft visible
float plainWeave(vec2 uv, vec2 threadCount){
    ivec2 cell = ivec2(floor(uv * threadCount));
    return float((cell.x + cell.y) % 2);
}
