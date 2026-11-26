import * as G from '../web/core.js';
function run(cls,rate,resets=2,log=false){
  let now=1.8e12;let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  G.setEnv(rnd,()=>now);const A=G.newAccount();G.apply(A,'create',{name:'s',cls},{});
  const out=[];let t0=now,guard=0;
  while(out.length<resets&&guard++<200000){
    const S=A.chars[A.cur];
    // best zone/floor
    let bz=0,bf=0;for(let z=0;z<G.ZONES.length;z++)for(let f=0;f<G.FLOORS;f++)if(G.canFloor(S,z,f)){ // prefer highest xp per second
      bz=z;bf=f;}
    if(S.zone!==bz||(S.floor|0)!==bf)G.apply(A,'travel',{z:bz,f:bf},{});
    const kps=G.maxKps(S,bz)*rate;now+=8000;
    let boss=false;if(A.bossAt&&A.bossAt.z===bz){const c=G.calc(S),need=G.zs(bz,bf).hp*30/(c.dps*2.8*rate);if((now-A.bossAt.t)/1000>=need)boss=true;}
    const r=G.apply(A,'tick',{z:bz,f:bf,kills:Math.floor(kps*8),boss,casts:1},{});
    if(log&&guard%225===0)console.log(cls,'t',((now-t0)/60000).toFixed(0),'lvl',S.lvl,'z',bz,bf,'kps',kps.toFixed(2),'open',A.open,'gold',A.gold);
    for(let i=0;i<3;i++){ // spend: upgrade weapon when affordable, open boxes
      if(A.boxes>0)G.apply(A,'openBox',{k:''},{});
      const w=S.eq.w;if(w)G.apply(A,'upgrade',{id:w.id},{});}
    G.apply(A,'claimQuest',{},{});
    if(S.lvl>=G.CAP){const rr=G.apply(A,'reset',{},{});if(rr.ok){out.push(((now-t0)/60000).toFixed(0));t0=now;}}
  }
  return out;
}
for(const c of ['blade','storm','hunter'])console.log(c,'cap-rate',run(c,1,3).join(' / '),'| 60% rate',run(c,.6,2).join(' / '));
if(process.argv[2])run(process.argv[2],.6,1,true);
{ // milestones at a realistic pace
  for(const c of ['blade','storm','hunter']){let now=1.8e12,seed=7;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};G.setEnv(rnd,()=>now);const A=G.newAccount();G.apply(A,'create',{name:'s',cls:c},{});
  const marks=[20,60,110,180,260,400],got=[];let t0=now,g=0,res=[];
  while(res.length<3&&g++<400000){const S=A.chars[0];let bz=0,bf=0;for(let z=0;z<G.ZONES.length;z++)for(let f=0;f<G.FLOORS;f++)if(G.canFloor(S,z,f)){bz=z;bf=f;}
    if(S.zone!==bz||(S.floor|0)!==bf)G.apply(A,'travel',{z:bz,f:bf},{});const kps=Math.min(G.maxKps(S,bz)*.7,.55);now+=8000;
    let boss=false;if(A.bossAt&&A.bossAt.z===bz&&(now-A.bossAt.t)/1000>=G.zs(bz,bf).hp*30/(G.calc(S).dps*1.4))boss=true;
    G.apply(A,'tick',{z:bz,f:bf,kills:Math.floor(kps*8+rnd()),boss,casts:1},{});if(A.boxes>0)G.apply(A,'openBox',{k:''},{});if(S.eq.w)G.apply(A,'upgrade',{id:S.eq.w.id},{});G.apply(A,'claimQuest',{},{});
    while(marks.length&&S.lvl>=marks[0]){got.push(marks.shift()+':'+((now-t0)/60000).toFixed(0));}
    if(S.lvl>=G.CAP&&G.apply(A,'reset',{},{}).ok){res.push(((now-t0)/60000).toFixed(0));t0=now;}}
  console.log(c,'real pace (max .55 kills/s) milestones',got.join(' '),'| resets',res.join(' / '));}
}
