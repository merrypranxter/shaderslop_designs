// Fake thread sheen: strongest when light aligns with stitch direction.
float threadSheen(vec2 stitchDir, vec2 lightDir, float power) {
    float a = abs(dot(normalize(stitchDir), normalize(lightDir)));
    return pow(a, power);
}
