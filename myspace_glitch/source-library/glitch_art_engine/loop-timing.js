// GLITCH ART ENGINE timing contract. Seconds and frames are integers whenever
// possible. Phase is evaluated directly, with no accumulated per-frame drift.
// A cycle has frames 0..N-1. Its next frame is frame 0 of the same cycle.
export const LOOP_MIN=1, LOOP_MAX=10, MP4_MAX_SECONDS=30;
export function loopSeconds(value){
  const n=Number(value);
  return Number.isInteger(n)&&n>=LOOP_MIN&&n<=LOOP_MAX?n:3;
}
export function phaseAtFrame(frame,fps,periodSeconds){
  if(!Number.isInteger(fps)||fps<1||fps>60)throw Error("Invalid frame rate");
  const count=loopSeconds(periodSeconds)*fps;
  const position=((frame%count)+count)%count;
  return position/count;
}
export function phaseAtSeconds(t,periodSeconds){
  const period=loopSeconds(periodSeconds);
  return ((t%period)+period)%period/period;
}
export function clipSeconds(periodSeconds,repeats){
  const period=loopSeconds(periodSeconds);
  if(!Number.isInteger(repeats)||repeats<1||repeats>Math.floor(MP4_MAX_SECONDS/period))
    throw Error("MP4 must contain whole loop cycles and last at most 30 seconds");
  return period*repeats;
}
export function repeatOptions(periodSeconds){
  const period=loopSeconds(periodSeconds);
  return Array.from({length:Math.floor(MP4_MAX_SECONDS/period)},(_,i)=>({
    repeats:i+1,seconds:(i+1)*period
  }));
}
export function exportDimensions(width,aspect) {
  if(!Number.isInteger(width)||width<64||width>2160)throw Error("Invalid export width");
  return {width,height:aspect==="9:16"?Math.round(width*16/9):width};
}
