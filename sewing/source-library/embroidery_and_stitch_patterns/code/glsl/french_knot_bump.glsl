// Raised knot bump mask.
float knotBump(vec2 uv, vec2 center, float radius) {
    float d = length(uv - center) / radius;
    return exp(-d * d * 3.5);
}
