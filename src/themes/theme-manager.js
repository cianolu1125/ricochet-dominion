import {getTheme} from './theme-registry.js';
export class ThemeManager {
 constructor(storage){
  if(storage===undefined){try{storage=globalThis.localStorage}catch{storage=null}}
  this.storage=storage;this.pending=null;this.listeners=new Set();
  let id;try{id=storage?.getItem('ricochet-theme')}catch{}
  this.current=getTheme(id);
 }
 request(id,safe=true){this.pending=getTheme(id).id;return this.flush(safe)}
 flush(safe){
  if(!safe||this.pending===null)return false;
  const next=getTheme(this.pending);this.pending=null;
  try{this.storage?.setItem('ricochet-theme',next.id)}catch{}
  if(next===this.current)return false;
  this.current=next;for(const fn of this.listeners)fn(next);return true;
 }
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn)}
 apply(document){
  const root=document.documentElement;root.dataset.theme=this.current.id;
  for(const [key,value] of Object.entries(this.current.colors))root.style.setProperty('--theme-'+key,value);
  if(this.current.id==='original'){root.style.removeProperty('--red');root.style.removeProperty('--blue')}
  else{root.style.setProperty('--red',this.current.colors.red);root.style.setProperty('--blue',this.current.colors.blue)}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',this.current.colors.bg);
 }
}
export const themeManager=new ThemeManager();
export const currentTheme=()=>themeManager.current;
