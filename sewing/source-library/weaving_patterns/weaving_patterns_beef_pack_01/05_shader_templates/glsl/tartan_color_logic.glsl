vec3 pickBandColor(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3){
    float b = mod(floor(t), 4.0);
    if(b < 1.0) return c0;
    if(b < 2.0) return c1;
    if(b < 3.0) return c2;
    return c3;
}

vec3 tartanColor(vec2 uv, float scale, float mask){
    vec3 a = vec3(0.02, 0.04, 0.16);
    vec3 b = vec3(0.85, 0.05, 0.08);
    vec3 c = vec3(0.95, 0.86, 0.55);
    vec3 d = vec3(0.02, 0.38, 0.18);
    vec3 warp = pickBandColor(uv.x * scale, a,b,c,d);
    vec3 weft = pickBandColor(uv.y * scale, a,b,c,d);
    return mix(weft, warp, mask);
}
