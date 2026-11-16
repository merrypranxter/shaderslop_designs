float threadHighlight(vec2 uv, vec2 direction, float strength){
    vec2 d = normalize(direction);
    float wave = sin(dot(uv, d) * 240.0) * 0.5 + 0.5;
    return pow(wave, 8.0) * strength;
}
