// Tiny sound-effect helper using the Web Audio API directly — no audio files to host or download,
// which matters here since everything gets uploaded through GitHub's web UI. Each function just
// programs a couple of oscillator "beeps" and lets them fade out.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType,
  gainPeak: number,
) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak*Number(localStorage.getItem("we-fx-volume")??.6), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export const sounds = {
  diceRoll() {
    beep(180, 0, 0.08, "square", 0.05);
    beep(220, 0.07, 0.08, "square", 0.05);
    beep(260, 0.14, 0.1, "square", 0.05);
  },
  purchase() {beep(440,0,.13,"triangle",.07);beep(660,.1,.18,"triangle",.07);},
  rent() {beep(330,0,.12,"sine",.06);beep(220,.1,.18,"sine",.05);},
  cash() {
    beep(660, 0, 0.09, "sine", 0.06);
    beep(880, 0.08, 0.14, "sine", 0.06);
  },
  error() {
    beep(140, 0, 0.18, "sawtooth", 0.05);
  },
  notify() {
    beep(520, 0, 0.1, "triangle", 0.05);
  },
};

let musicTimer:ReturnType<typeof setInterval>|undefined;
let musicNodes:{osc:OscillatorNode;gain:GainNode}[]=[];
export function effectsVolume(n:number){localStorage.setItem('we-fx-volume',String(Math.max(0,Math.min(1,n))));}
export function music(enabled:boolean,volume=.15){
 if(musicTimer)clearInterval(musicTimer);musicTimer=undefined;
 for(const {osc,gain} of musicNodes){gain.disconnect();try{osc.stop()}catch{}}musicNodes=[];
 if(!enabled)return;const audio=getCtx();if(!audio)return;let step=0;
 const chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,110,130.81],[98,123.47,146.83]];
 const play=()=>{for(const {osc,gain} of musicNodes){gain.disconnect();try{osc.stop()}catch{}}musicNodes=[];for(const freq of chords[step++%4]){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;osc.connect(gain);gain.connect(audio.destination);const now=audio.currentTime;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume*.08,now+1);gain.gain.linearRampToValueAtTime(0,now+5.8);osc.start();osc.stop(now+6);musicNodes.push({osc,gain});}};
 play();musicTimer=setInterval(play,6000);
}

export function musicIsPlaying(){return musicTimer!==undefined;}
