import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {RelayHUD} from '../src/relay-hud.js';
import * as E from '../src/engine.js';
function fixture(){
  const window=new Window();
  window.document.body.innerHTML='<div id="relay-hud"><div id="relay-track"></div><span id="relay-count"></span><span id="relay-skill"></span></div>';
  const element=window.document.querySelector('#relay-hud');
  const state=E.createGame(14),tower=state.towers.find(t=>t.owner===1);
  state.phase='MISSILE_RELAY_AIM';state.visitedRelayTowerIds.add(tower.id);
  return {window,element,state,tower,hud:new RelayHUD(element)};
}
test('five history nodes retain earned overload progress through missile settlement and fade',()=>{
  const {element,state,tower,hud}=fixture();tower.state='overloaded';
  hud.sync(state,100,'en',{1:'red',2:'blue'});
  assert.equal(element.querySelectorAll('.relay-node').length,5);
  assert.equal(element.querySelectorAll('.lit').length,1);
  state.phase='IDLE';hud.sync(state,200,'en',{1:'red',2:'blue'});
  assert.equal(element.hidden,false);
  assert.equal(element.querySelectorAll('.lit').length,1);
  hud.sync(state,5000,'en',{1:'red',2:'blue'});
  assert.equal(element.hidden,true);
  assert.equal(element.querySelectorAll('.lit').length,0);
});
test('shield and overload pulse target the newest earned node at partial progress',()=>{
  const {element,state,tower,hud}=fixture();
  state.towers.push({...tower,id:++state.nextId,pos:{x:3,y:3}});
  state.relayFeedback={type:'shielded',towerId:tower.id,turn:state.turnIndex,count:1};
  hud.sync(state,100,'en',{1:'red',2:'blue'});
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  for(const type of ['shielded','overload']) {
    const selector=css.match(new RegExp(`#relay-hud\\.${type}[^\\{]+`))[0].trim();
    element.classList.remove('shielded','overload');element.classList.add(type);
    const targets=element.ownerDocument.querySelectorAll(selector);
    assert.equal(targets.length,1);
    assert.equal(targets[0],element.querySelector('.lit'));
  }
});
