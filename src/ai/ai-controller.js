import {aimError,newMatchSeed} from './ai-rng.js';
import {stateKey} from './ai-simulate.js';
import {SEARCH_TIMEOUT_MS} from './ai-config.js';
// Controller owns asynchronous lifetime only; it never evaluates or edits game rules.
export class AIController {
  constructor({getState,isBlocked,execute,onCue=()=>{},onChange=()=>{},workerFactory=()=>new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'})}) {
    Object.assign(this,{getState,isBlocked,execute,onCue,onChange,workerFactory});this.generation=0;this.requestId=0;this.session={mode:'local-pvp'};this.worker=null;this.pending=null;this.cue=null;this.thinking=false;
  }
  start({mode,difficulty='normal',matchSeed=newMatchSeed()}) {
    this.stop();this.session={mode,difficulty,matchSeed,aiOwner:2,humanOwner:1,decisionIndex:0,segmentIndex:0,strategy:null};
  }
  stop() {
    this.session={mode:'local-pvp'};this.generation++;this.worker?.terminate();this.worker=null;this.pending=null;this.cue=null;this.thinking=false;this.onCue(null);this.onChange();
  }
  get active(){const s=this.getState();return this.session.mode==='pve'&&s.current===this.session.aiOwner&&!s.winner;}
  pauseCue(){if(this.cue){this.cue.paused=true;this.onCue(null);}}
  cancelRequest(){this.worker?.terminate();this.worker=null;this.pending=null;this.cue=null;this.thinking=false;this.onCue(null);}
  tick(time) {
    if(!this.active){if(this.worker||this.pending||this.cue){this.cancelRequest();this.onChange();}return;}
    const s=this.getState();
    if(this.worker&&time-this.startedAt>SEARCH_TIMEOUT_MS+2500) {
      this.worker.terminate();this.worker=null;this.thinking=false;this.pending={decision:{type:'end'},key:this.key};this.onChange();
    }
    if(this.isBlocked(time)){this.pauseCue();return;}
    if(!['IDLE','MOVE_AIM','MISSILE_AIM','MOVE_RELAY_AIM','MISSILE_RELAY_AIM'].includes(s.phase))return;
    if(this.cue) {
      if(stateKey(s)!==this.cue.key){this.cancelRequest();this.onChange();return;}
      if(this.cue.paused){this.cue.paused=false;this.cue.until=time+260;this.onCue(this.cue.decision);this.onChange();return;}
      if(time<this.cue.until)return;
      const decision=this.cue.decision;this.cue=null;this.onCue(null);this.perform(decision);return;
    }
    if(this.pending) {
      const reply=this.pending;this.pending=null;
      if(stateKey(s)!==reply.key){this.onChange();return;}
      this.session.strategy=reply.strategy||this.session.strategy;
      if(reply.decision.type==='launch') {
        const decision=aimError(reply.decision,{...this.session,turnIndex:s.turnIndex});
        this.onCue(decision);this.cue={decision,until:time+260,key:stateKey(s)};this.onChange();
      } else this.perform(reply.decision);
      return;
    }
    if(this.worker)return;
    this.key=stateKey(s);this.startedAt=time;this.thinking=true;
    const generation=this.generation,requestId=++this.requestId,key=this.key;
    try {
      const worker=this.workerFactory();this.worker=worker;
      const accept=result=>{
        if(this.generation!==generation||this.requestId!==requestId||this.worker!==worker)return;
        worker.terminate();this.worker=null;this.thinking=false;
        this.pending={...result,key,decision:result.error?{type:'end'}:result.decision||{type:'end'}};this.onChange();
      };
      worker.onmessage=({data})=>{if(data.generation===generation&&data.requestId===requestId)accept(data);};
      worker.onerror=event=>{event.preventDefault?.();accept({error:'worker failure'});};
      worker.postMessage({generation,requestId,state:structuredClone(s),session:{...this.session}});
    } catch {this.worker?.terminate();this.worker=null;this.thinking=false;this.pending={key,decision:{type:'end'}};}
    this.onChange();
  }
  perform(decision) {
    this.session.decisionIndex++;if(decision.type==='launch')this.session.segmentIndex++;
    // One failed decision gets a legal fallback; stale/illegal actions never retry forever.
    if(!this.execute(decision))this.execute({type:'end'});
    this.onChange();
  }
}
