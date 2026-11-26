// Language. The game is written in Hebrew; in English every piece of text is translated on its way to the screen.
// Text is cut into Hebrew phrases (digits, Latin text and sentence punctuation end a phrase), and each phrase is
// looked up in en.js: whole first, then as the longest known pieces from left to right, so a sentence built in code
// around a name or a number still comes out in English. What is not known stays as it was.
import {EN} from './en.js';
const RUN=/[֐-׿][֐-׿ "'׳״\-]*[֐-׿]|[֐-׿]/g,HE=/[֐-׿]/;
const PRE={'ו':'and ','ה':'the ','ב':'in ','ל':'to ','מ':'from ','ש':'that ','כ':'as '};
let lang='he';try{lang=localStorage.getItem('eternal-cycle-lang')==='en'?'en':'he';}catch(e){}
const cache=new Map();
function phrase(r){
  let hit=cache.get(r);if(hit!==undefined)return hit;
  const lead=/^[ '"\-]*/.exec(r)[0],tail=/[ '"\-]*$/.exec(r.slice(lead.length))[0],k=r.slice(lead.length,r.length-tail.length).replace(/\s+/g,' ');
  if(EN[k]!==undefined)hit=lead+EN[k]+tail;
  else{const w=k.split(' '),out=[];let i=0;
    while(i<w.length){let n=Math.min(w.length-i,12),got=null;
      for(;n>=1;n--){const p=w.slice(i,i+n).join(' ');if(EN[p]!==undefined){got=EN[p];break;}}
      if(got===null){const x=w[i];n=1;got=x.length>2&&PRE[x[0]]&&EN[x.slice(1)]!==undefined?PRE[x[0]]+EN[x.slice(1)]:x;}
      out.push(got);i+=n;}
    hit=lead+out.join(' ')+tail;}
  cache.set(r,hit);return hit;
}
export const getLang=()=>lang;
export function tr(s){return lang==='he'||s==null||typeof s!=='string'||!HE.test(s)?s:s.replace(RUN,phrase);}
export function setLang(l){try{localStorage.setItem('eternal-cycle-lang',l==='en'?'en':'he');}catch(e){}location.reload();}
// The page: translate what is there, then everything that is added or changed. Text people typed (chat lines, names in
// inputs) is left alone: it sits in elements marked dir="auto" or in form fields.
const skip=n=>{for(let e=n.nodeType===1?n:n.parentElement;e;e=e.parentElement){if(e.dir==='auto'||e.tagName==='SCRIPT'||e.tagName==='STYLE'||e.tagName==='TEXTAREA'||e.classList.contains('notr'))return true;}return false;};
function text(n){const v=n.nodeValue;if(v&&HE.test(v)&&!skip(n)){const t=tr(v);if(t!==v)n.nodeValue=t;}}
function walk(root){
  if(root.nodeType===3){text(root);return;}if(root.nodeType!==1||skip(root))return;
  for(const a of ['placeholder','aria-label','title'])if(root.hasAttribute&&root.hasAttribute(a)){const v=root.getAttribute(a),t=tr(v);if(t!==v)root.setAttribute(a,t);}
  const it=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;
  while((n=it.nextNode())){if(n.nodeType===3)text(n);else for(const a of ['placeholder','aria-label','title'])if(n.hasAttribute(a)){const v=n.getAttribute(a),t=tr(v);if(t!==v)n.setAttribute(a,t);}}
}
export function startLang(){
  if(lang!=='en'||typeof document==='undefined')return;
  document.documentElement.lang='en';document.documentElement.dir='ltr';document.title=tr(document.title);walk(document.body);
  new MutationObserver(list=>{for(const m of list){if(m.type==='characterData')text(m.target);else if(m.type==='attributes'){const v=m.target.getAttribute(m.attributeName),t=tr(v);if(v&&t!==v)m.target.setAttribute(m.attributeName,t);}else for(const n of m.addedNodes)walk(n);}})
    .observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
}
