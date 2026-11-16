import {phaseAtFrame} from "./loop-timing.js";

// GLITCH ART ENGINE — original GIF89a encoder.
// Palette-aware global 256-color GIF palette follows the artist's five colors.
// An RGB332 fallback remains for regression tests, not normal exports.

function pushShort(out,n){out.push(n&255,(n>>>8)&255)}
// Two palette paths: old RGB332 remains a valid independent test/reference
// mode, but real exports use exact recipe colors and their useful mixtures.
// A 5-bit-per-channel LUT quantizes pixels with just one lookup per pixel.
function encodePalette(colors){
  const pal=new Uint8Array(768);
  if(!Array.isArray(colors)||colors.length!==5){
    for(let i=0;i<256;i++){
      pal[i*3]=Math.round(((i>>5)&7)*255/7);
      pal[i*3+1]=Math.round(((i>>2)&7)*255/7);
      pal[i*3+2]=Math.round((i&3)*255/3);
    }
    return pal;
  }
  const src=colors.map(hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)));
  const entries=[];
  const add=v=>{if(entries.length<256)entries.push(v.map(x=>Math.round(Math.max(0,Math.min(255,x)))))};
  // The exact endpoints guarantee protected B&W does not become colorful.
  add([0,0,0]);add([255,255,255]);
  for(let i=1;i<31;i++){let gray=i*255/31;add([gray,gray,gray])}
  for(const c of src)add(c);
  for(const c of src){
    // Preserve the recognisable original neon while adding shadows/highlights.
    for(let j=0;j<18;j++){
      const t=(j+1)/19;
      const towardWhite=j>=9;
      const amount=towardWhite?(t-.47)*1.55:t*.95;
      add(c.map(x=>towardWhite?x*(1-amount)+255*amount:x*(1-amount)));
    }
  }
  for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){
    for(let k=1;k<=12;k++){
      const t=k/13;
      add(src[i].map((x,c)=>x*(1-t)+src[j][c]*t));
    }
  }
  // Remaining entries are high-chroma anchors rather than accidental black.
  const punch=[[255,0,255],[0,255,255],[0,255,0],[255,255,0],
    [255,0,0],[0,0,255],[255,127,0],[255,0,127],[127,0,255]];
  for(let k=0;entries.length<256;k++)add(punch[k%punch.length]);
  entries.forEach((c,i)=>pal.set(c,i*3));
  return pal;
}
function makeQuantizer(pal){
  const lut=new Uint8Array(32*32*32);
  for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++){
    const red=r*255/31,green=g*255/31,blue=b*255/31;
    let best=0,score=Infinity;
    for(let i=0;i<256;i++){
      const j=i*3,dr=red-pal[j],dg=green-pal[j+1],db=blue-pal[j+2];
      const d=3*dr*dr+5*dg*dg+2*db*db;
      if(d<score){score=d;best=i}
    }
    lut[(r<<10)|(g<<5)|b]=best;
  }
  return lut;
}
function quantizeRGBA(rgba,w,h,lookup){
  const indices=new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    const from=(h-1-y)*w*4,to=y*w;
    for(let x=0;x<w;x++){
      const k=from+x*4,r=rgba[k],g=rgba[k+1],b=rgba[k+2];
      indices[to+x]=lookup?
        lookup[((r>>>3)<<10)|((g>>>3)<<5)|(b>>>3)]:
        (r&0xE0)|((g&0xE0)>>>3)|(b>>>6);
    }
  }
  return indices;
}
function lzwCompress(indices) {
  // GIF LZW is LSB-first, with a clear code and dynamic 9-12-bit dictionary.
  const MIN=8,CLEAR=1<<MIN,END=CLEAR+1;
  const out=[];
  let bits=0,buffer=0,codeSize=9,nextCode=258;
  let dictionary=new Map();
  function write(code){
    buffer |= code << bits;
    bits += codeSize;
    while(bits>=8){
      out.push(buffer & 255);
      buffer >>>= 8;
      bits -= 8;
    }
  }
  function reset() {
    dictionary=new Map();
    codeSize=9;
    nextCode=258;
  }
  write(CLEAR);
  if(indices.length===0){write(END);if(bits)out.push(buffer&255);return Uint8Array.from(out)}
  let prefix=indices[0];
  for(let i=1;i<indices.length;i++){
    const k=indices[i];
    const lookup=prefix*256+k;
    const existing=dictionary.get(lookup);
    if(existing!==undefined){
      prefix=existing;
      continue;
    }
    write(prefix);
    if(nextCode<4096){
      dictionary.set(lookup,nextCode++);
      // Decoder is one dictionary insertion behind the compressor, so
      // increase the code width AFTER passing the size boundary.
      if(nextCode > (1<<codeSize) && codeSize<12)codeSize++;
    } else {
      write(CLEAR);
      reset();
    }
    prefix=k;
  }
  write(prefix);
  write(END);
  if(bits>0)out.push(buffer&255);
  return Uint8Array.from(out);
}
// Build all GIF data subblocks into one allocation per frame, not hundreds
// of thousands of tiny chunks. Blob(parts) avoids a second giant full-file copy.
function subBlocks(bytes){
  const extra=Math.ceil(bytes.length/255)+1;
  const packed=new Uint8Array(bytes.length+extra);
  let a=0,b=0;
  while(a<bytes.length){
    const count=Math.min(255,bytes.length-a);
    packed[b++]=count;
    packed.set(bytes.subarray(a,a+count),b);
    a+=count;b+=count;
  }
  packed[b]=0;
  return packed;
}
export class GifEncoder {
  constructor(width,height,fps,colors=null) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width>65535||height>65535)
      throw Error("Invalid GIF dimensions");
    this.width=width;this.height=height;
    this.delay=Math.max(1,Math.round(100/fps));
    this.chunks=[];
    this.frames=0;
    this.chunks.push(Uint8Array.from("GIF89a",c=>c.charCodeAt(0)));
    const screen=[width&255,width>>>8,height&255,height>>>8,0xF7,0,0];
    this.palette=encodePalette(colors);
    this.lookup=colors?makeQuantizer(this.palette):null;
    this.chunks.push(Uint8Array.from(screen),this.palette);
    this.chunks.push(Uint8Array.of(0x21,0xFF,11,...[..."NETSCAPE2.0"].map(c=>c.charCodeAt(0)),3,1,0,0,0));
  }
  addRGBA(rgba, delayCentis=this.delay){
    if(rgba.length!==this.width*this.height*4)throw Error("GIF frame pixel length mismatch");
    const indices=quantizeRGBA(rgba,this.width,this.height,this.lookup);
    const payload=lzwCompress(indices);
    const delay=Math.max(1,Math.round(delayCentis));
    this.chunks.push(Uint8Array.of(0x21,0xF9,4,4,delay&255,(delay>>>8)&255,0,0));
    this.chunks.push(Uint8Array.of(0x2C,0,0,0,0,
      this.width&255,this.width>>>8,this.height&255,this.height>>>8,0,8));
    this.chunks.push(subBlocks(payload));
    this.frames++;
  }
  finish(){
    if(!this.frames)throw Error("No frames were rendered");
    this.chunks.push(Uint8Array.of(0x3B));
    return new Blob(this.chunks,{type:"image/gif"});
  }
}
export async function renderGif({renderer,recipe,width,height,fps,onProgress,signal}) {
  // High resolution 10s loops are permitted with an explicit pixel-work cap.
  // 1080x1920 at 12fps for 10 seconds = 249m processed pixels.
  const maxPixels=260_000_000;
  const frameCount=Math.round(recipe.duration*fps);
  if(frameCount<1||frameCount>200)throw Error("Choose fewer GIF frames");
  if(width*height*frameCount>maxPixels)throw Error("GIF too large for the memory budget: lower resolution or FPS");
  const gl=renderer.gl;
  const maxSize=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  if(width>maxSize||height>maxSize)throw Error("Device cannot render this GIF resolution");
  const oldW=renderer.canvas.width,oldH=renderer.canvas.height;
  const rgba=new Uint8Array(width*height*4);
  const encoder=new GifEncoder(width,height,fps,recipe.colors);
  try{
    renderer.resize(width,height);
    for(let i=0;i<frameCount;i++){
      if(signal?.aborted)throw new DOMException("Export canceled","AbortError");
      renderer.render(recipe,phaseAtFrame(i,fps,recipe.duration));
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      encoder.addRGBA(rgba,Math.round((i+1)*100/fps)-Math.round(i*100/fps));
      onProgress?.((i+1)/frameCount,i+1,frameCount);
      if(i%2===1)await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(signal?.aborted)throw new DOMException("Export canceled","AbortError");
    return encoder.finish();
  }finally{
    renderer.resize(oldW,oldH);
  }
}
