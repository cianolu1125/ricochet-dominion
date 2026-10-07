import {themes} from './theme-registry.js';
import {currentTheme} from './theme-manager.js';
export const themeLabel=language=>language==='en'?'Visual Theme':'视觉主题';
export function themeCards(language,pending){
 const en=language==='en',selected=currentTheme().id;
 return `<p class="eyebrow">${en?'PRESENTATION':'视觉 · 动效 · 声音'}</p><h2 id="panel-title">${themeLabel(language)}</h2><div class="theme-list">${Object.values(themes).map(theme=>`<button class="theme-card ${theme.id===selected?'selected':''}" data-panel="theme-${theme.id}" data-preview="${theme.id}" aria-pressed="${theme.id===selected}" style="--card-red:${theme.colors.red};--card-blue:${theme.colors.blue};--card-accent:${theme.colors.accent};--card-bg:${theme.colors.bg}"><span class="theme-emblem" aria-hidden="true"><i></i><b></b><i></i></span><span class="theme-copy"><strong>${en?theme.meta.en:theme.meta.zh}</strong><span class="theme-tag">${theme.meta.tag}</span><small>${theme.meta.description[en?1:0]}</small></span><span class="theme-check" aria-hidden="true">${theme.id===selected?'✓':'○'}</span></button>`).join('')}</div><p class="theme-note" role="status">${pending?(en?'Theme changes when the current effect finishes.':'当前演出结束后应用主题。'):(en?'Changes appearance and sound. Your match continues.':'切换界面、动效与声音，保留当前对局。')}</p><button class="settings-entry" data-panel="theme-back">${en?'Back':'返回'}</button>`;
}
export function flavor(action,language){
 const id=currentTheme().id;if(id==='original')return '';
 const words={coven:{move:['踏影','Shadowstep'],action:['施术','Ritual'],missile:['施放','Invoke'],tower:['立坛','Anchor'],dismantle:['破仪','Unbind']},tang:{move:['移阵','Advance'],action:['下令','Command'],missile:['放矢','Loose'],tower:['立寨','Fortify'],dismantle:['拔寨','Breach']}};
 const label=words[id]?.[action]?.[language==='en'?1:0];return label?`<small class="action-flavor">${label}</small>`:'';
}
