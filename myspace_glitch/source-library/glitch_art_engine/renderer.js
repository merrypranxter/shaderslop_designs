import {ChromaticPipeline} from "./chroma-post.js";
// Original GLSL implementation for GLITCH ART ENGINE.
// Intentionally independent of the glitchGL library and any reference artist's imagery.

const VERTEX = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_seed;
uniform float u_phase;
uniform float u_variant;
uniform float u_density;
uniform float u_quiet;
uniform vec4 u_scars[16];
uniform int u_scarCount;
uniform float u_allBW;
uniform float u_chromaPunch;
uniform float u_infection;
uniform float u_crossTalk;
uniform int u_chromaMode;
uniform float u_chromaTargets[16];
uniform float u_enabled[16];
uniform float u_bw[16];
uniform float u_strength[16];
uniform float u_effectSeeds[16];
uniform float u_scale[16];
uniform float u_rate[16];
uniform vec3 u_palette[5];

const float TAU = 6.28318530718;

float hash1(float n) {
  return fract(sin(n * 127.13 + u_seed * 2.991) * 43758.5453);
}
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 1.773) * 43758.5453);
}
float hashEffect(vec2 p, int idx) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_effectSeeds[idx] * 1.773) * 43758.5453);
}
vec3 pal(float f) {
  f = fract(f);
  if(f < .2) return u_palette[0];
  if(f < .4) return u_palette[1];
  if(f < .6) return u_palette[2];
  if(f < .8) return u_palette[3];
  return u_palette[4];
}
// Wave Three: eight independent, original signal-source grammars.
// They supply both colorful source pixels and color-independent monochrome structure.
// All time functions are periodic in phase, and their seeds derive from u_seed.
vec2 patternAt(vec2 uv, float phase) {
  uv=fract(uv);
  float family=mod(floor(u_variant),8.0);
  float angle=TAU*phase;
  vec2 p=uv;
  float activity=.8;
  float structure=0.0;
  float grain=hash2(floor(uv * vec2(131.0,113.0)) + floor(phase*12.0));
  vec2 tile;
  float row;
  if(family<1.0) {
    // Broadcast sediment: long staggered strata crossed with chunked wordless data.
    float bands=16.0+floor(hash1(14.0)*34.0);
    row=floor(p.y*bands);
    float offset=(hash1(row+71.0)-.5)*.32;
    tile=floor(vec2((p.x+offset)* (5.0+12.0*hash1(8.0)), p.y*bands));
    structure=hash2(tile)*.67+step(.83,fract(p.y*bands))*.4;
    activity=step(.18+u_quiet*.48,hash1(row*.7+4.0));
  }else if(family<2.0) {
    // Fugitive barcode: differential vertical scan widths with occasional blanks.
    float x=p.x + .10*sin(p.y*11.0 + angle);
    float fine=42.0+floor(115.0*hash1(9.0));
    float band=floor(x*fine);
    float stripe=hash1(band + floor(phase*9.0)*.17);
    structure=step(.31,stripe)*.74 + fract(p.y*16.0)*.16 + grain*.15;
    activity=step(.19+u_quiet*.55,hash1(floor(x*9.0)+3.0));
  }else if(family<3.0) {
    // Dislocated plate mosaic: stable polygon-like tiles with animated fine fracture.
    tile=floor((p+vec2(.05*sin(angle),.02*cos(angle)))*vec2(9.0,15.0));
    vec2 f=fract(p*vec2(9.0,15.0));
    float boundary=1.0-step(.06,min(min(f.x,1.0-f.x),min(f.y,1.0-f.y)));
    structure=hash2(tile)*.74+boundary*.48;
    activity=step(.23+u_quiet*.52,hash2(tile*vec2(.7,1.1)+4.0));
  }else if(family<4.0) {
    // Phantom columns: off-register stacks of surgical vertical cuts.
    float line=floor(p.x*24.0);
    float offset=(hash1(line+11.0)-.5)*(.12+.06*sin(angle));
    tile=floor(vec2(p.x*24.0,(p.y+offset)*8.0));
    float seams=step(.88,fract(p.x*24.0+sin(p.y*17.0)*.5));
    structure=hash2(tile)*.65+seams*.46;
    activity=step(.25+u_quiet*.48,hash1(line*.31+7.0));
  }else if(family<5.0) {
    // Spectral fault ribbons: slanted interference sheets without obvious fractal shapes.
    float diagonal=p.x*.52 + p.y*.89 + sin(p.x*14.0+angle)*.025;
    float ribbon=fract(diagonal*(19.0+floor(hash1(21.0)*26.0)));
    tile=floor(vec2(diagonal*33.0, p.x*8.0));
    structure=hash2(tile)*.48 + step(.65,ribbon)*.65;
    activity=step(.16+u_quiet*.60,hash1(floor(diagonal*12.0)+3.0));
  }else if(family<6.0) {
    // Binary archipelago: big quiet zones broken by tiny invasive microblocks.
    tile=floor(p*vec2(17.0,24.0));
    vec2 macro=floor(p*vec2(5.0,7.0));
    float seed=hash2(macro);
    structure=hash2(tile)*.85+step(.84,grain)*.4;
    activity=step(.32+u_quiet*.50,seed);
  }else if(family<7.0) {
    // Radial synchronization error: ripple sectors broken by angular packet gates.
    vec2 q=(p-.5)*vec2(1.0,u_resolution.y/max(1.0,u_resolution.x));
    float sector=atan(q.y,q.x);
    float rings=length(q)*(43.0+floor(hash1(4.0)*75.0));
    float tear=sin(angle+sector*5.0)*.42;
    structure=step(.43,fract(rings+tear))*.82+grain*.18;
    activity=step(.16+u_quiet*.45,hash1(floor(sector*8.0)+41.0));
  }else {
    // Checksum weave: independent horizontal and vertical bit rails.
    vec2 g=floor(p*vec2(61.0,37.0));
    float a=hash1(g.x+31.0),b=hash1(g.y+74.0);
    structure=step(.48,fract(a+b+grain*.21))*.87;
    activity=step(.20+u_quiet*.56,hash2(floor(p*vec2(7.0,8.0))));
  }
  // Spare spatial balance: structured blank areas are intentional, not a black void.
  float focus=hash2(floor(p*vec2(3.0,4.0))+vec2(71.0,17.0));
  activity*=step(u_quiet*.42,focus);
  float value=clamp(structure * (.52+.46*u_density)+grain*.11,0.0,1.0);
  return vec2(value,activity);
}
float signalAtTime(vec2 uv,float phase) {
  vec2 s=patternAt(uv,phase);
  return mix(.18,s.x,s.y);
}
float signalAt(vec2 uv) {return signalAtTime(uv,u_phase);}
struct Layer {
  vec3 color;
  float alpha;
  float mono;
};
vec3 sourceAtTime(vec2 uv,float atPhase) {
  vec2 p=patternAt(uv,atPhase);
  float band=hash2(floor(uv*vec2(8.0,11.0)));
  float glitch=hash2(floor(uv*vec2(29.0,23.0))+floor(atPhase*9.0));
  float index=fract(p.x*.77 + band*.41 + glitch*.15);
  vec3 color=pal(index);
  vec3 quiet=pal(hash1(98.0)*.99);
  float signal=clamp(p.y*(.64+.35*u_density),0.0,1.0);
  return clamp(mix(quiet,color,signal),0.0,1.0);
}
vec3 sourceAt(vec2 uv) {return sourceAtTime(uv,u_phase);}

vec3 asBW(float value, vec2 uv) {
  float d = hash2(floor(uv * u_resolution)) - .5;
  return vec3(step(.5, value + d * .12));
}
Layer scanTear(vec2 uv, float strength) {
  float bands = 12.0 + floor((8.0 + strength * 92.0) * mix(.35, 2.5, u_scale[0]));
  float band = floor(uv.y * bands);
  float beat = floor(u_phase * floor((10.0 + 12.0 * strength)*mix(.35, 2.5, u_rate[0])));
  float h = hashEffect(vec2(band, beat), 0);
  float on = step(.72 - strength * .52, h);
  float shift = (hashEffect(vec2(band + 31.0, beat), 0) - .5) * (.02 + strength * .59);
  vec2 sampleUV = fract(uv + vec2(shift, 0.0));
  float hard = step(.15, fract(uv.y * bands)) * step(.14, 1.0 - fract(uv.y * bands));
  float a = on * hard * (.28 + .72 * strength);
  vec3 c = mix(sourceAt(sampleUV), pal(hashEffect(vec2(band + beat + 3.0, 1.0), 0)),
               .25 + strength * .2);
  float edge = step(.91, fract(uv.y * bands));
  c = mix(c, vec3(1.), edge * .4);
  return Layer(c, a, signalAt(sampleUV));
}
Layer packetGraveyard(vec2 uv, float strength) {
  vec2 tiles = vec2(4.0 + floor(12.0 * strength), 5.0 + floor(17.0 * strength)) * mix(.4, 2.4, u_scale[1]);
  vec2 grid = floor(uv * tiles);
  vec2 sub = fract(uv * tiles);
  float beat = floor(u_phase * floor((4.0 + strength * 9.0) * mix(.6, 2.8, u_rate[1])));
  float h = hashEffect(grid + vec2(beat * 7.1, -beat * 5.3), 1);
  float on = step(.77 - .48 * strength, h);
  vec2 offset = (vec2(hashEffect(grid + 24.0, 1), hashEffect(grid - 24.0, 1)) - .5) * strength * .5;
  vec3 c = sourceAt(fract(uv + offset));
  c = mix(c, pal(h * 9.7 + beat * .12), step(.86, h) * .86);
  c = mix(c, vec3(0.0), step(.93, h) * .76);
  float border = step(.032, sub.x) * step(.03, sub.y);
  return Layer(c, on * border * (.4 + .59 * strength), signalAt(fract(uv + offset)));
}
Layer bitplaneSabotage(vec2 uv, float strength) {
  vec2 cell = floor(uv * (vec2(32.0, 48.0) + vec2(90.0 * strength)) * mix(.45, 2.4, u_scale[2]));
  float beat = floor(u_phase * floor(mix(6.0, 45.0, u_rate[2])));
  float h = hashEffect(floor(cell / (2.0 + floor(strength * 7.0))) + beat * .37, 2);
  float g = hashEffect(cell + beat * 1.13, 2);
  float on = step(.76 - .43 * strength, h);
  vec3 base = sourceAt(uv);
  float lum = signalAt(uv);
  int px = int(floor(lum * 255.0));
  int bit = 1 << int(floor(g * 8.0));
  int flipped = px ^ bit;
  float damaged = float(flipped) / 255.0;
  float p = step(.5, damaged);
  vec3 c = mix(vec3(damaged), pal(damaged * .95 + g * .3), .8);
  c = mix(c, vec3(p), step(.91, h) * .55);
  return Layer(c, on * (.24 + .75 * strength), damaged);
}
// 4 — DITHER RAZOR: spatially sampled Bayer-order threshold interference.
// Deliberately hard binary output (not a gray wash or a noise overlay).
Layer ditherRazor(vec2 uv, float strength) {
  float density = (28.0 + floor(strength * 180.0)) * mix(.3, 2.5, u_scale[4]);
  vec2 pixel = floor(uv * vec2(density, density * u_resolution.y / max(u_resolution.x, 1.0)));
  vec2 mod4 = mod(pixel, 4.0);
  float bayer = mod4.x * 0.0;
  // Bayer 4x4: column / row bit interleave.
  float x = mod4.x;
  float y = mod4.y;
  bayer = (mod(x, 2.0) * 8.0 + mod(y, 2.0) * 4.0
      + floor(x / 2.0) * 2.0 + floor(y / 2.0)) / 16.0;
  float phase = floor(u_phase * floor(mix(4.0, 36.0, u_rate[4])));
  float value = signalAt(uv + vec2(.012 * sin(TAU*u_phase), 0.0));
  float binary = step(bayer, value * (0.6 + 0.6 * strength));
  float zone = hashEffect(floor(uv * vec2(10.0, 14.0)) + vec2(phase*.17, 0.0), 4);
  float enabled = step(.72 - strength*.50, zone);
  vec3 color = mix(pal(.16), pal(.66), binary);
  return Layer(color, enabled * (.42 + .57 * strength), binary);
}

// 5 — INTERFERENCE RADIO: superposed scan carriers, spatial phase faults
// and beating. No image analysis or inherited reference art.
Layer interferenceRadio(vec2 uv, float strength) {
  float t = TAU * u_phase * floor(mix(1.0, 7.0, u_rate[5]));
  vec2 grid = floor(uv * vec2(8.0, 22.0));
  float zone = hashEffect(grid + vec2(floor(u_phase*12.0), 0.0), 5);
  float y = uv.y;
  float waveA = sin(y * (430.0 + strength*750.0) * mix(.25, 2.8, u_scale[5]) + sin(uv.x*27.0+t)*4.0);
  float waveB = sin((y + uv.x * .07) * (444.0 + strength*740.0) * mix(.25, 2.8, u_scale[5]) - t*2.0);
  float beat = waveA * waveB;
  float scratches = step(.73, fract(y*(67.0+floor(strength*134.0)) + sin(uv.x*37.0+t)*.5));
  float grit = hashEffect(floor(uv*u_resolution*.42) + floor(u_phase*20.0), 5);
  float value = clamp(.5 + beat*.49 + (grit-.5)*.2 + scratches*.28, 0.0, 1.0);
  vec3 color = mix(pal(value), pal(zone*.77 + .2), scratches*.4);
  float gate = step(.64 - strength*.36, zone);
  return Layer(color, gate * (.25 + strength*.73), value);
}

// 6 — GHOST CACHE: mathematically replay earlier procedural source states,
// with distinct deterministic time offsets, spatial slips and echo weights.
Layer ghostCache(vec2 uv, float strength) {
  float t = fract(u_phase * floor(mix(1.0, 5.0, u_rate[6])));
  float drift = (.009 + .09*strength)*mix(.25,2.6,u_scale[6]);
  vec2 slip = vec2(sin(TAU*t*2.0), cos(TAU*t))*drift;
  vec3 a = sourceAtTime(fract(uv+slip), fract(t-.11));
  vec3 b = sourceAtTime(fract(uv-slip*.8), fract(t-.28));
  vec3 c = sourceAtTime(fract(uv+slip*1.7), fract(t-.44));
  float mA = signalAt(uv+slip);
  float mB = signalAt(uv-slip*.8);
  float mC = signalAt(uv+slip*1.7);
  float zone = hashEffect(floor(uv * vec2(9.0, 13.0)) + vec2(floor(t*6.0), 2.0), 6);
  float v = clamp(mA*.52 + mB*.30 + mC*.18, 0.0, 1.0);
  vec3 color = a*.5 + b*.32 + c*.18;
  return Layer(color, step(.74 - strength*.42, zone)*(.24 + strength*.73), v);
}

// 7 — LUMA REORDER: actually sorts six source samples by signal luminance
// within each local scanline fragment (not a fake displacement named sorting).
Layer lumaReorder(vec2 uv, float strength) {
  float span = (.035 + strength*.23)*mix(.35, 2.2, u_scale[7]);
  float seg = floor(uv.x / span);
  float row = floor(uv.y * (11.0 + strength*48.0));
  float phase = floor(u_phase * floor((4.0 + strength*10.0)*mix(.45, 2.3, u_rate[7])));
  float zone = hashEffect(vec2(seg + phase*.43, row), 7);
  float gate = step(.73 - strength*.42, zone);
  if(gate < .5) return Layer(vec3(0.0), 0.0, 0.0);
  float origin = seg * span;
  vec3 cols[6];
  float keys[6];
  for(int i=0;i<6;i++) {
    vec2 at = vec2(fract(origin + span*(float(i)+.5)/6.0), uv.y);
    cols[i] = sourceAt(at);
    keys[i] = signalAt(at);
  }
  // Stable insertion-sort by palette-INDEPENDENT signal keys.
  for(int i=1;i<6;i++) {
    float key=keys[i];
    vec3 color=cols[i];
    int j=i-1;
    for(int k=0;k<5;k++) {
      if(j<0 || keys[j]<=key) break;
      keys[j+1] = keys[j];
      cols[j+1] = cols[j];
      j--;
    }
    keys[j+1] = key;
    cols[j+1] = color;
  }
  int ix = clamp(int(floor(fract(uv.x/span)*6.0)), 0, 5);
  return Layer(cols[ix], gate * (.35 + strength*.64), keys[ix]);
}


// Shared spatial infection field from user-painted corruption scars. When on,
// existing glitch processes intensify in those same regions. Each pass still
// follows its own monochrome policy. This is field coupling, not a claim of
// autonomous self-propagating data corruption.
float infectionField(vec2 uv) {
  float field=0.0;
  vec2 aspect=vec2(1.0,u_resolution.y/max(1.0,u_resolution.x));
  float ripple=sin(TAU*u_phase);
  for(int i=0;i<16;i++){
    if(i>=u_scarCount)break;
    vec4 mark=u_scars[i];
    float d=length((uv-mark.xy)*aspect);
    float radius=mark.z*(1.25+u_infection*1.8)+.025;
    float wave=.94+.1*ripple;
    float contribution=1.0-smoothstep(radius*.25,radius*wave,d);
    field=max(field,contribution);
  }
  return field;
}

vec3 composite(vec3 original, Layer effect, float bw, vec2 uv, float infection) {
  vec3 c = bw > .5 ? asBW(effect.mono, uv) : effect.color;
  // Monochrome contributions are solid pixels in their explicitly affected regions;
  // this prevents the underlying colored buffer from bleeding through a B&W layer.
  float propagated = clamp(effect.alpha + infection*u_infection*(.12+.38*effect.alpha),0.0,1.0);
  float alpha = bw > .5 ? step(.22, propagated) : propagated;
  return mix(original, c, alpha);
}

vec3 scarOverlay(vec3 color,vec2 uv) {
  // Bounded 16-mark local corruption. Deterministic from the saved scar recipe.
  float peak=0.0;
  vec4 chosen=vec4(0.0);
  for(int i=0;i<16;i++){
    if(i>=u_scarCount)break;
    vec4 mark=u_scars[i];
    float radius=max(.005,mark.z);
    vec2 diff=(uv-mark.xy)*vec2(1.0,u_resolution.y/max(1.0,u_resolution.x));
    float distance=length(diff)/radius;
    float jitter=sin(TAU*u_phase*2.0 + float(i)*1.27 + atan(diff.y,diff.x)*6.0)*.035;
    float influence=1.0-smoothstep(.66,1.0,distance+jitter);
    if(influence>peak){peak=influence;chosen=mark;}
  }
  if(peak<=.001)return color;
  float mode=mod(chosen.w,4.0);
  vec2 local=(uv-chosen.xy)*vec2(1.0,u_resolution.y/max(1.0,u_resolution.x));
  float pulse=sin(TAU*u_phase);
  float noise=hash2(floor(uv*u_resolution*.31)+floor(u_phase*17.0));
  float binary=0.0;
  vec3 damaged=vec3(0.0);
  if(mode<.5) {
    // Razor: invasive, high-contrast horizontal signal wounds.
    binary=step(.53,fract(local.y*(270.0+70.0*pulse)+noise*.21));
    damaged=mix(pal(.05),pal(.6),binary);
  }else if(mode<1.5){
    // Bit rot: quantized lesions with a jittered pixel grid.
    vec2 block=floor(local*(160.0+100.0*pulse));
    binary=step(.50,hash2(block+floor(u_phase*11.0)));
    damaged=mix(pal(.2),pal(.84),binary);
  }else if(mode<2.5){
    // Phase burn: expanding concentric packet rings that fold inward.
    float radius=length(local);
    binary=step(.5,fract(radius*125.0+sin(TAU*u_phase)*.9+noise*.09));
    damaged=mix(pal(.35),pal(.7),binary);
  }else{
    // Channel bruise: subpixel color misregistration inside the scar area.
    float a=signalAt(fract(uv+vec2(.033,0.0)));
    float b=signalAt(fract(uv-vec2(.015,.03)));
    float c=signalAt(fract(uv+vec2(0.0,-.025)));
    damaged=mix(vec3(a,b,c),pal(noise),.32);
    binary=step(.5,(a+b+c)/3.0);
  }
  bool monochrome=chosen.w>=4.0;
  if(monochrome)damaged=vec3(binary);
  // Protected monochrome marks never receive translucent chromatic fringing.
  float alpha=monochrome?step(.12,peak):peak*.94;
  return mix(color,damaged,alpha);
}

// Color processing is deliberately deferred until AFTER base glitches.
// An alpha-channel bitfield is handed to the chroma-post shader:
//   bit0 = this pixel belongs to chosen chromatic target(s)
//   bit1 = this pixel's visible content is protected monochrome
// Damage relay: previous glitches alter later glitches' coverage at each pixel.
// The interaction is deterministic and circular in time; it is NOT a solver
// or an autonomous infection simulation.
vec3 compositeRouted(vec3 prior,Layer effect,int index,vec2 uv,float infection,
                     inout float routeMask,inout float monoMask,inout float relay) {
  float spread=relay*u_crossTalk*.54*effect.alpha;
  float propagated=clamp(effect.alpha+
    infection*u_infection*(.12+.38*effect.alpha)+spread,0.0,1.0);
  float alpha=u_bw[index]>.5?step(.22,propagated):propagated;
  float coverage=step(.23,alpha);
  if(u_chromaMode==1)routeMask=mix(routeMask,0.0,coverage);
  if(u_chromaMode==2)routeMask=mix(routeMask,u_chromaTargets[index],coverage);
  monoMask=mix(monoMask,step(.5,u_bw[index]),coverage);
  relay=clamp(relay*.69+alpha*.54,0.0,1.0);
  vec3 damage=u_bw[index]>.5?asBW(effect.mono,uv):effect.color;
  return mix(prior,damage,alpha);
}
float protectedScarAt(vec2 uv){
  float best=0.0;
  float protectedMask=0.0;
  for(int i=0;i<16;i++){
    if(i>=u_scarCount)break;
    vec4 mark=u_scars[i];
    vec2 diff=(uv-mark.xy)*vec2(1.0,u_resolution.y/max(u_resolution.x,1.0));
    float distance=length(diff)/max(.005,mark.z);
    float jitter=sin(TAU*u_phase*2.0+float(i)*1.27+atan(diff.y,diff.x)*6.0)*.035;
    float influence=1.0-smoothstep(.66,1.0,distance+jitter);
    if(influence>best){
      best=influence;
      protectedMask=step(4.0,mark.w);
    }
  }
  return best>.13?protectedMask:0.0;
}
void main() {
  vec2 uv=v_uv;
  vec3 c=sourceAt(uv);
  float routeMask=u_chromaMode==2?0.0:1.0;
  float monoMask=0.0;
  float relay=0.0;
  float coupled=(u_infection>.001&&u_scarCount>0)?infectionField(uv):0.0;
  if(u_enabled[0]>.5)c=compositeRouted(c,scanTear(uv,u_strength[0]),0,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[1]>.5)c=compositeRouted(c,packetGraveyard(uv,u_strength[1]),1,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[2]>.5)c=compositeRouted(c,bitplaneSabotage(uv,u_strength[2]),2,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[4]>.5)c=compositeRouted(c,ditherRazor(uv,u_strength[4]),4,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[5]>.5)c=compositeRouted(c,interferenceRadio(uv,u_strength[5]),5,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[6]>.5)c=compositeRouted(c,ghostCache(uv,u_strength[6]),6,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[7]>.5)c=compositeRouted(c,lumaReorder(uv,u_strength[7]),7,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[12]>.5)c=compositeRouted(c,jpegPhantom(uv,u_strength[12]),12,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[13]>.5)c=compositeRouted(c,gopDebt(uv,u_strength[13]),13,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[14]>.5)c=compositeRouted(c,xorWorm(uv,u_strength[14]),14,uv,coupled,routeMask,monoMask,relay);
  if(u_enabled[15]>.5)c=compositeRouted(c,syncCollapse(uv,u_strength[15]),15,uv,coupled,routeMask,monoMask,relay);
  c=scarOverlay(c,uv);
  monoMask=max(monoMask,protectedScarAt(uv));
  if(u_allBW>.5){
    c=vec3(step(.5,dot(c,vec3(.2126,.7152,.0722))));
    monoMask=1.0;
  }
  float packedAlpha=(step(.5,routeMask)+step(.5,monoMask)*2.0)/3.0;
  fragColor=vec4(clamp(c,0.0,1.0),packedAlpha);
}
`;

function shader(gl, kind, code) {
  const compiled = gl.createShader(kind);
  if (!compiled) throw new Error("Could not create WebGL shader");
  gl.shaderSource(compiled, code);
  gl.compileShader(compiled);
  if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(compiled);
    gl.deleteShader(compiled);
    throw new Error("Shader compilation error: " + info);
  }
  return compiled;
}
function program(gl) {
  const vs = shader(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const p = gl.createProgram();
  if (!p) throw new Error("Could not create WebGL program");
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Shader link error: " + gl.getProgramInfoLog(p));
  }
  return p;
}
function colorToFloats(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i+2), 16) / 255);
}

export class SignalRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false, alpha: false, depth: false, stencil: false,
      preserveDrawingBuffer: true, premultipliedAlpha: false,
    });
    if (!gl) throw new Error("This browser does not support WebGL2.");
    this.gl = gl;
    this.program = program(gl);
    this.chroma = new ChromaticPipeline(gl,VERTEX);
    gl.useProgram(this.program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const attrib = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(attrib);
    gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = {};
    for (const name of ["u_resolution","u_seed","u_phase","u_variant","u_density","u_quiet","u_chromaPunch","u_infection","u_crossTalk","u_chromaMode","u_chromaTargets[0]","u_scarCount","u_scars[0]","u_allBW","u_enabled[0]","u_bw[0]","u_strength[0]","u_effectSeeds[0]","u_scale[0]","u_rate[0]","u_palette[0]"]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
  }
  resize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.chroma.resize(w,h);
    this.gl.viewport(0, 0, w, h);
  }
  render(recipe, phase) {
    const gl = this.gl;
    gl.useProgram(this.program);
    this.chroma.beginBase();
    const set = this.uniforms;
    gl.uniform2f(set.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(set.u_seed, (recipe.seed % 10000) / 17.0);
    gl.uniform1f(set.u_phase, phase);
    gl.uniform1f(set.u_variant, recipe.variant);
    gl.uniform1f(set.u_density, recipe.density);
    gl.uniform1f(set.u_quiet, recipe.quiet ?? .24);
    gl.uniform1f(set.u_chromaPunch, recipe.chromaPunch ?? 1.25);
    gl.uniform1f(set.u_infection, recipe.infection ?? 0);
    gl.uniform1f(set.u_crossTalk, recipe.crossTalk ?? 0);
    const routing=recipe.chromaRouting||{mode:"all",targets:[]};
    const mode=routing.mode==="source"?1:routing.mode==="selected"?2:0;
    gl.uniform1i(set.u_chromaMode,mode);
    const targetBits=new Float32Array(16);
    for(const target of routing.targets||[]){
      if(Number.isInteger(target)&&target>=0&&target<16)targetBits[target]=1;
    }
    gl.uniform1fv(set["u_chromaTargets[0]"],targetBits);
    const marks=Array.isArray(recipe.scars)?recipe.scars.slice(-16):[];
    const scarData=new Float32Array(64);
    for(let i=0;i<marks.length;i++){
      const m=marks[i];
      scarData.set([m.x,m.y,m.size,m.mode+(m.keepBW?4:0)],i*4);
    }
    gl.uniform1i(set.u_scarCount,marks.length);
    gl.uniform4fv(set["u_scars[0]"],scarData);
    gl.uniform1f(set.u_allBW, recipe.paletteName === 'TRUE B&W' ? 1 : 0);
    gl.uniform1fv(set["u_enabled[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => e.enabled ? 1 : 0)));
    gl.uniform1fv(set["u_bw[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => e.keepBW ? 1 : 0)));
    gl.uniform1fv(set["u_strength[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => e.intensity)));
    gl.uniform1fv(set["u_effectSeeds[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => (e.seed % 10000) / 17)));
    gl.uniform1fv(set["u_scale[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => e.scale ?? .5)));
    gl.uniform1fv(set["u_rate[0]"], new Float32Array(recipe.effects.slice(0,16).map(e => e.rate ?? .5)));
    gl.uniform3fv(set["u_palette[0]"], new Float32Array(recipe.colors.flatMap(colorToFloats)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.chroma.finish(recipe,phase);
  }
}
