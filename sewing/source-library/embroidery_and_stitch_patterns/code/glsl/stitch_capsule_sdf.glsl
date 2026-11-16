// Capsule distance field for a single thread-like stitch segment.
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float stitchMask(vec2 uv, vec2 a, vec2 b, float width, float softness) {
    float d = sdCapsule(uv, a, b, width);
    return 1.0 - smoothstep(0.0, softness, d);
}
