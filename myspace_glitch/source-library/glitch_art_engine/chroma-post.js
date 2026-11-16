// GLITCH ART ENGINE — chromatic post-processing.
// The input is the ACTUAL already-glitched frame, never newly generated source art.
// Shared RGB textures allow prism/bleed/channel surgery to deform prior glitches.
// Offscreen alpha encodes two bits: selected-region routing, protected B&W.
const POST_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform float u_phase;
uniform float u_seed;
uniform float u_strength;
uniform float u_scale;
uniform float u_rate;
uniform float u_bw;
uniform float u_neon;
uniform float u_allBW;
uniform int u_mode;

const float TAU=6.28318530718;
vec2 sampleUV(vec2 uv){return clamp(uv,vec2(.00001),vec2(.99999));}
vec3 imageAt(vec2 uv){return texture(u_input,sampleUV(uv)).rgb;}
float noiseAt(vec2 uv){
  return fract(sin(dot(uv,vec2(127.1,311.7))+u_seed*1.773)*43758.5453);
}
void main(){
  vec4 pixel=texture(u_input,v_uv);
  vec3 original=pixel.rgb;
  int pack=int(floor(pixel.a*3.0+0.5));
  float selected=float(pack%2);
  float protectedBW=float(pack/2);
  // Mode zero: final display/PNG/GIF/MP4 composition.
  if(u_mode==0){
    float lum=dot(original,vec3(.2126,.7152,.0722));
    vec3 color=mix(vec3(lum),original,u_neon);
    color=mix(color,original,protectedBW);
    if(u_allBW>.5)color=vec3(step(.5,lum));
    fragColor=vec4(clamp(color,0.0,1.0),1.0);
    return;
  }
  if(selected<.5 || protectedBW>.5 || u_allBW>.5){
    fragColor=pixel;
    return;
  }
  float phase=TAU*u_phase;
  float stepRate=floor(mix(3.0,24.0,u_rate));
  float beat=floor(u_phase*stepRate);
  float strength=u_strength;
  float gate=1.0;
  vec3 damaged=original;
  if(u_mode==3){
    // CHROMATIC MUTINY: per-band RGB component displacement on damaged output.
    float row=floor(v_uv.y*(11.0+u_scale*72.0));
    float seed=noiseAt(vec2(row,beat));
    gate=step(.35-strength*.2,seed);
    float d=(.002+strength*.075)*(seed*.65+.45);
    vec2 delta=vec2(d*(.7+sin(phase+row)*.3),d*.12);
    vec3 a=imageAt(v_uv+delta);
    vec3 b=imageAt(v_uv-delta*.29);
    vec3 c=imageAt(v_uv-delta);
    damaged=vec3(a.r,b.g,c.b);
  }else if(u_mode==8){
    // PRISM FRACTURE: truly radial displacement of THE COMPLETED glitch image.
    vec2 ratio=vec2(1.0,u_resolution.y/max(u_resolution.x,1.0));
    vec2 p=(v_uv-.5)*ratio;
    float rad=length(p);
    vec2 axis=p/max(.0001,rad);
    vec2 tangent=vec2(-axis.y,axis.x);
    float wander=sin(atan(p.y,p.x)*7.0+phase*floor(mix(1.0,5.0,u_rate)))*.23;
    float fracture=noiseAt(floor(v_uv*(6.0+u_scale*21.0))+vec2(beat*.13,0.0));
    vec2 offset=(axis*(1.0+wander)+tangent*(fracture-.5)*.9)
      *(.002+strength*.11)*pow(clamp(rad*1.2,0.0,1.3),1.3);
    vec3 r=imageAt(v_uv+offset*1.8);
    vec3 g=imageAt(v_uv-offset*.12);
    vec3 b=imageAt(v_uv-offset*1.8);
    damaged=vec3(r.r,g.g,b.b);
  }else if(u_mode==9){
    // CHROMA BLEED: widen color difference but preserve original luminance.
    float row=floor(v_uv.y*(7.0+u_scale*31.0));
    float slip=noiseAt(vec2(row,beat))-.5;
    float spread=(.002+strength*.063)*(1.0+abs(slip));
    vec3 smeared=vec3(0.0);
    for(int k=-2;k<=2;k++){
      float w = k == 0 ? 0.32 : (abs(k) == 1 ? 0.21 : 0.13);
      smeared+=imageAt(v_uv+vec2(float(k)*spread+slip*.025,0.0))*w;
    }
    float origY=dot(original,vec3(.2126,.7152,.0722));
    float smY=dot(smeared,vec3(.2126,.7152,.0722));
    damaged=clamp(vec3(origY)+(smeared-vec3(smY))*(1.0+strength*.9),0.0,1.0);
  }else if(u_mode==10){
    // CHANNEL SURGERY on the WHOLE previous composited layer.
    vec2 block=floor(v_uv*vec2(6.0+u_scale*27.0,9.0+u_scale*35.0));
    float seed=noiseAt(block+vec2(beat*.21,beat*.73));
    gate=step(.54-strength*.32,seed);
    float mode=floor(noiseAt(block+53.0)*6.0);
    if(mode<1.0)damaged=original.gbr;
    else if(mode<2.0)damaged=original.brg;
    else if(mode<3.0)damaged=vec3(original.r,0.0,original.b);
    else if(mode<4.0)damaged=vec3(original.b,original.r,1.0-original.g);
    else if(mode<5.0)damaged=1.0-original;
    else damaged=vec3(original.r,original.r,original.b);
  }else if(u_mode==11){
    // SOLARIZED ROT: region-specific per-channel inversion of the glitched image.
    vec2 block=floor(v_uv*(8.0+u_scale*48.0));
    float seed=noiseAt(block+vec2(beat*.31,beat*.11));
    gate=step(.56-strength*.3,seed);
    vec3 cutoff=vec3(.22,.31,.38)+seed*vec3(.34,.29,.26);
    damaged=vec3(original.r>cutoff.r?1.0-original.r:original.r,
                 original.g>cutoff.g?1.0-original.g:original.g,
                 original.b>cutoff.b?1.0-original.b:original.b);
  }
  else if(u_mode==16){
    // MIRROR SHUNT: folds local scan-segments of the *completed* glitch image.
    float strips=3.0+floor(u_scale*23.0);
    float row=floor(v_uv.y*strips);
    float rhythm=floor(u_phase*(3.0+floor(u_rate*22.0)));
    float mask=noiseAt(vec2(row,rhythm));
    gate=step(.58-strength*.38,mask);
    float center=(floor(v_uv.x* (5.0+u_scale*19.0))+.5)/(5.0+u_scale*19.0);
    float mirrorX=fract(2.0*center-v_uv.x);
    vec2 displaced=vec2(mix(v_uv.x,mirrorX,strength),v_uv.y);
    damaged=imageAt(displaced);
  }else if(u_mode==17){
    // RIBBON CLIP: independent phase-synchronized vertical/horizontal rails
    // sample *other pieces of the already-glitched image*.
    vec2 block=vec2(7.0+u_scale*31.0,12.0+u_scale*46.0);
    vec2 cell=floor(v_uv*block);
    float rhythm=floor(u_phase*(4.0+floor(u_rate*24.0)));
    float fault=noiseAt(cell+vec2(rhythm*.33,rhythm*.17));
    gate=step(.62-strength*.4,fault);
    float direction=step(.5,noiseAt(cell+17.0));
    float slippage=(fault-.5)*strength*.34;
    vec2 offset=mix(vec2(slippage,0.0),vec2(0.0,slippage),direction);
    vec2 sample=fract(v_uv+offset);
    damaged=imageAt(sample);
    float seam=step(.93,fract(dot(v_uv,block*vec2(1.0,.6))));
    damaged=mix(damaged,imageAt(v_uv-offset*.2),seam*.48);
  }else if(u_mode==18){
    // PHASE ECHO: spatial multi-exposures of existing damage. Every offset
    // follows a closed circle in time; no actual historical-frame buffer claim.
    float phi=TAU*u_phase*floor(mix(1.0,5.0,u_rate));
    float radius=(.006+u_scale*.075)*strength;
    vec2 a=vec2(cos(phi),sin(phi))*radius;
    vec2 b=vec2(cos(phi+2.0944),sin(phi+2.0944))*radius;
    vec2 c=vec2(cos(phi+4.1888),sin(phi+4.1888))*radius;
    vec3 e1=imageAt(v_uv+a);
    vec3 e2=imageAt(v_uv+b);
    vec3 e3=imageAt(v_uv+c);
    damaged=clamp(original*.20+e1*.36+e2*.27+e3*.17,0.0,1.0);
    float cells=noiseAt(floor(v_uv*vec2(8.0,11.0))+vec2(floor(u_phase*8.0),0.0));
    gate=step(.41-strength*.25,cells);
  }else if(u_mode==19){
    // CHECKSUM TILES: swap coordinates of matched neighboring tile fragments.
    // The damage reads prior glitch colors, not original unglitched source.
    vec2 tiling=vec2(6.0+u_scale*21.0,8.0+u_scale*25.0);
    vec2 cell=floor(v_uv*tiling);
    vec2 local=fract(v_uv*tiling);
    float rhythm=floor(u_phase*floor(mix(3.0,20.0,u_rate)));
    float fault=noiseAt(cell+vec2(rhythm*.17,rhythm*.27));
    gate=step(.50-strength*.31,fault);
    vec2 neighbor=vec2(step(.5,noiseAt(cell+45.0))*2.0-1.0,
      step(.5,noiseAt(cell+99.0))*2.0-1.0);
    vec2 offset=neighbor/tiling*(.3+strength*.7);
    vec2 sample=fract((cell+local)/tiling+offset);
    damaged=imageAt(sample);
  }
  float opacity=clamp(gate*(.18+.81*strength),0.0,1.0);
  vec3 color=mix(original,damaged,opacity);
  if(u_bw>.5 && opacity>.20){
    float y=dot(color,vec3(.2126,.7152,.0722));
    color=vec3(step(.5,y));
  }
  // An explicitly monochrome chromatic operation also protects its output
  // from subsequent chromatic operations and the global saturation stage.
  float updatedProtect=max(protectedBW,(u_bw>.5&&opacity>.20)?1.0:0.0);
  float updatedPack=(selected+2.0*updatedProtect)/3.0;
  fragColor=vec4(clamp(color,0.0,1.0),updatedPack);
}
`;

function compile(gl,type,code){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,code);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const error=gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw Error("Chromatic shader compilation error: "+error);
  }
  return shader;
}
function buildProgram(gl,vertex){
  const vs=compile(gl,gl.VERTEX_SHADER,vertex);
  const fs=compile(gl,gl.FRAGMENT_SHADER,POST_FRAGMENT);
  const p=gl.createProgram();
  gl.attachShader(p,vs);gl.attachShader(p,fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error("Chromatic shader link error: "+gl.getProgramInfoLog(p));
  return p;
}
export const CHROMATIC_EFFECT_INDICES=[3,8,9,10,11];
export const POST_EFFECT_INDICES=[...CHROMATIC_EFFECT_INDICES,16,17,18,19];
export const BASE_EFFECT_INDICES=[0,1,2,4,5,6,7,12,13,14,15];

export class ChromaticPipeline{
  constructor(gl,vertex){
    this.gl=gl;
    this.program=buildProgram(gl,vertex);
    this.uniforms={};
    gl.useProgram(this.program);
    for(const name of ["u_input","u_resolution","u_phase","u_seed","u_strength","u_scale","u_rate","u_bw","u_neon","u_allBW","u_mode"]){
      this.uniforms[name]=gl.getUniformLocation(this.program,name);
    }
    this.textures=[];
    this.framebuffers=[];
    for(let i=0;i<2;i++){
      const texture=gl.createTexture();
      const framebuffer=gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.textures.push(texture);
      this.framebuffers.push(framebuffer);
    }
    this.width=0;this.height=0;
  }
  resize(width,height){
    if(width===this.width&&height===this.height)return;
    const gl=this.gl;
    for(let i=0;i<2;i++){
      gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.textures[i],0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)
        throw Error("Could not allocate chromatic framebuffer at "+width+"×"+height);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.width=width;this.height=height;
  }
  beginBase(){
    const gl=this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffers[0]);
    gl.viewport(0,0,this.width,this.height);
  }
  finish(recipe,phase){
    const gl=this.gl,loc=this.uniforms;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.u_input,0);
    gl.uniform2f(loc.u_resolution,this.width,this.height);
    gl.uniform1f(loc.u_phase,phase);
    gl.uniform1f(loc.u_allBW,recipe.paletteName==="TRUE B&W"?1:0);
    let current=0;
    for(const index of POST_EFFECT_INDICES){
      const e=recipe.effects[index];
      if(!e?.enabled)continue;
      const next=1-current;
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffers[next]);
      gl.bindTexture(gl.TEXTURE_2D,this.textures[current]);
      gl.uniform1i(loc.u_mode,index);
      gl.uniform1f(loc.u_seed,(e.seed%10000)/17);
      gl.uniform1f(loc.u_strength,e.intensity);
      gl.uniform1f(loc.u_scale,e.scale??.5);
      gl.uniform1f(loc.u_rate,e.rate??.5);
      gl.uniform1f(loc.u_bw,e.keepBW?1:0);
      gl.drawArrays(gl.TRIANGLES,0,3);
      current=next;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,this.width,this.height);
    gl.bindTexture(gl.TEXTURE_2D,this.textures[current]);
    gl.uniform1i(loc.u_mode,0);
    gl.uniform1f(loc.u_neon,recipe.chromaPunch??1);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
}
