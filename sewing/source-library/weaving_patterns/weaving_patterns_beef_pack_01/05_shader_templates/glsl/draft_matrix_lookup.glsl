// Replace with texture lookup in production. This is a tiny procedural draft placeholder.
float draftLookup(ivec2 cell){
    return float((cell.x + cell.y) % 2);
}

float wovenCell(vec2 uv, vec2 count){
    ivec2 cell = ivec2(floor(uv * count));
    return draftLookup(cell);
}
