const voices = {
  ui:[680,460,.055,.025],launch:[440,130,.14,.06],fire:[780,190,.16,.065],bounce:[520,340,.075,.045],capture:[220,580,.13,.045],carry:[830,300,.09,.05],land:[180,110,.1,.035],
  damage:[160,65,.16,.11],blast:[120,38,.28,.13],destroy:[210,45,.34,.14],siege:[180,32,.46,.19],
  build:[280,640,.26,.06],grow:[180,350,.28,.045],disconnect:[410,150,.18,.045],reconnect:[180,510,.18,.045],convert:[150,710,.48,.09],redeploy:[530,180,.4,.065],handoff:[380,510,.13,.035],complete:[320,640,.68,.07],charge:[180,750,.19,.055],
};
export class AudioDirector {
  constructor({enabled=true,volume=.65}={}){this.enabled=enabled;this.volume=volume;this.context=null;this.duckUntil=0;this.active=[];this.generation=0;}
  unlock() {
    if(!this.enabled)return;
    try {
      if(!this.context) {
        const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
        const c=this.context=new Context();
        this.bus=c.createGain();this.master=c.createGain();const limiter=c.createDynamicsCompressor();
        limiter.threshold.value=-12;limiter.knee.value=4;limiter.ratio.value=16;limiter.attack.value=.002;limiter.release.value=.07;
        this.bus.connect(limiter);const saturator=c.createWaveShaper();saturator.curve=Float32Array.from({length:1024},(_,i)=>Math.tanh((i/1023*2-1)*1.4)/Math.tanh(1.4));saturator.oversample='2x';
        limiter.connect(saturator);saturator.connect(this.master);this.master.connect(c.destination);this.master.gain.value=this.volume;
        this.noise=c.createBuffer(1,Math.ceil(c.sampleRate*.5),c.sampleRate);
        const samples=this.noise.getChannelData(0);for(let n=0;n<samples.length;n++)samples[n]=Math.random()*2-1;
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch{}
  }
  set(enabled,volume){this.enabled=enabled;this.volume=Math.max(0,Math.min(1,volume));if(this.master)this.master.gain.setTargetAtTime(enabled?this.volume:0,this.context.currentTime,.01);}
  play(e) {
    if(!this.enabled||!this.volume)return;
    if(globalThis.document?.hidden)return;
    this.unlock();const c=this.context;if(!c)return;
    if(c.state==='suspended') {
      const generation=this.generation;
      c.resume().then(()=>{if(generation===this.generation&&!globalThis.document?.hidden)this.play(e);}).catch(()=>{});
      return;
    }
    if(c.state!=='running')return;
    try {
      const recipe=voices[e.type];if(!recipe)return;
      let [start,end,duration,level]=recipe;
      if(e.type==='charge') {const n=e.charge||1;start+=n*55;end+=n*160;duration=e.maxed?.12:[.19,.25,.33][n-1];level=e.maxed?.03:.045+n*.014;}
      if(e.type==='blast'&&e.radius===2){duration=.36;level=.15;}
      const now=c.currentTime,heavy=['siege','blast','destroy','damage'].includes(e.type),major=['siege','convert','complete'].includes(e.type);
      this.active=this.active.filter(v=>v.until>now);
      if(major){this.duckUntil=now+.4;for(const v of this.active)if(v.low){v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(.5,now,.008);v.gain.gain.setTargetAtTime(1,now+.4,.05);}}
      const low=!heavy&&!major,voice=c.createGain();voice.gain.value=low&&now<this.duckUntil?.5:1;voice.connect(this.bus);const active={gain:voice,until:now+duration+.03,low,sources:[]};this.active.push(active);
      const variation=1+(Math.random()-.5)*.04;
      const tone=(a,b,at,len,gain,type='sine')=>{
        const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(a*variation,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,b*variation),at+len);
        g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+len);
        o.connect(g);g.connect(voice);active.sources.push(o);o.start(at);o.stop(at+len+.015);o.onended=()=>{o.disconnect();g.disconnect();if(at===now)voice.disconnect();};
      };
      tone(start,end,now,duration,level,heavy?'sine':'triangle');
      if(heavy) {
        // One authored composite voice, rather than stacking separate rule-event voices.
        const n=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;filter.type='lowpass';filter.frequency.setValueAtTime(e.type==='siege'?2600:1400,now);filter.frequency.exponentialRampToValueAtTime(100,now+duration);
        g.gain.setValueAtTime(level*.65,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
        n.connect(filter);filter.connect(g);g.connect(voice);active.sources.push(n);n.start(now);n.stop(now+duration);n.onended=()=>{n.disconnect();filter.disconnect();g.disconnect();};
      }else if(e.type==='charge'||['build','redeploy','convert'].includes(e.type))tone(end,end*.99,now+duration*.68,duration*.3,level*.45);
      else if(e.type==='complete'){tone(480,480,now+.2,.18,.055);tone(640,640,now+.4,.28,.055);}
    }catch{}
  }
  suspend(){
    this.generation++;
    for(const v of this.active){for(const source of v.sources){try{source.stop();}catch{}}v.gain.disconnect();}
    this.active=[];
    if(this.context?.state==='running')this.context.suspend().catch(()=>{});
  }
  resume(){if(this.enabled && this.context?.state==='suspended')this.context.resume().catch(()=>{});}
}
