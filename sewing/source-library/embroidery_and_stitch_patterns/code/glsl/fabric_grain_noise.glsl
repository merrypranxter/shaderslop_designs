float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float fabricGrain(vec2 uv, float scale){
    vec2 g = floor(uv * scale);
    return hash(g) * 0.06;
}
