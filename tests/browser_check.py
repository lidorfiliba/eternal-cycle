# Drives the real client in a headless browser, in local mode and against an in-page stand-in for the server.
# Usage: python3 tests/browser_check.py   (needs playwright + Chrome; not part of `npm test`)
import asyncio, http.server, threading, functools, os, sys
from playwright.async_api import async_playwright
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','web')
MOCK='''window.EC_CONFIG={url:"http://mock.invalid",anon:"x"};
window.EC_SERVER={db:null,calls:[]};
window.EC_MOCK=async(kind,args)=>{const G=await import('./core.js');await new Promise(r=>setTimeout(r,60));const sv=window.EC_SERVER;sv.calls.push(kind);
  if(kind==='mget')return {result:{ok:true},market:[]};
  if(kind==='beat')return {beat:{peers:[{k:'abc123',s:{n:'שחקן אחר',c:'storm',l:44,r:2,w:[5,3,11,0]},x:520,f:-1,a:true,g:'AB'}],chat:(args.s?[]:[{i:1,c:'w',n:'דנה',g:'AB',m:'מישהו בא לבוס?',me:false}]),online:7}};
  if(kind==='say')return {result:{ok:true}};
  if(kind==='gget')return {result:{ok:true},guild:{mine:null,top:[{name:'נשרים',tag:'NS',lvl:3,n:4,siege:120,castle:true}],holder:{name:'נשרים',tag:'NS'}}};
  if(kind[0]==='p'&&kind!=='pt')return {result:{ok:true},party:{code:kind==='pleave'?'':'AB12CD',members:[{n:'בודק',c:'blade',l:3,r:0,zone:0,active:true,me:true,leader:true},{n:'חבר',c:'storm',l:9,r:1,zone:0,active:true,me:false,leader:false}]}};
  if(!sv.db){if(kind!=='create')return {result:{ok:false,msg:'new'},state:null};const A=G.newAccount();const r=G.apply(A,'create',args,{});if(r.ok)sv.db=JSON.stringify(A);return {result:r,state:JSON.parse(sv.db)};}
  const A=G.adopt(JSON.parse(sv.db));const r=G.apply(A,kind,args,{players:[]});if(r.ok)sv.db=JSON.stringify(A);const out={result:r,state:JSON.parse(sv.db)};if(kind==='opps')out.players=[];return out;};
'''
async def run(pg,online):
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/config.js',lambda r:r.fulfill(body=MOCK if online else 'window.EC_CONFIG={};',content_type='application/javascript'))
    await pg.goto('http://127.0.0.1:8765/index.html');await pg.wait_for_timeout(900)
    await pg.fill('#nm','בודק');await pg.click('[data-act=create]');await pg.wait_for_timeout(600)
    out={'mode':'online-mock' if online else 'local','net':await pg.inner_text('#net'),'created':await pg.evaluate("()=>!EC.demo&&EC.S.name")}
    box=await pg.eval_on_selector('#mvR','e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}')
    await pg.mouse.move(box[0],box[1]);await pg.mouse.down();await pg.wait_for_timeout(6500);await pg.mouse.up()
    await pg.wait_for_timeout(16000)
    out['zone']=await pg.evaluate("()=>EC.SC.zi")
    if online: await pg.screenshot(path='/tmp/field.png')
    if online:
        await pg.evaluate("()=>EC.flushTick()");await pg.wait_for_timeout(300)
        out['server']=await pg.evaluate("()=>{const d=JSON.parse(EC_SERVER.db);return {kills:d.kills,lvl:d.chars[0].lvl,zone:d.chars[0].zone,calls:EC_SERVER.calls.length}}")
        out['client']=await pg.evaluate("()=>({kills:EC.A.kills,lvl:EC.S.lvl})")
        out['forged']=await pg.evaluate("async()=>{const r=await EC.send('tick',{z:0,kills:5000,boss:true});const d=JSON.parse(EC_SERVER.db);return {claimed:r.claimed,granted:r.kills,denied:!!r.rep.bossDenied,open:d.open}}")
        out['forgedTravel']=await pg.evaluate("async()=>(await EC.send('travel',{z:7})).ok")
        out['localEdit']=await pg.evaluate("async()=>{EC.A.gold=9e9;EC.S.lvl=400;const r=await EC.send('reset',{});return {ok:r.ok,gold:EC.A.gold,lvl:EC.S.lvl}}")
    else:
        out['local']=await pg.evaluate("()=>({kills:EC.A.kills,lvl:EC.S.lvl,gold:EC.A.gold})")
    await pg.click('[data-tab=gear]');await pg.click('[data-act=openBox][data-k=""]');await pg.wait_for_timeout(400)
    out['boxesLeft']=await pg.evaluate("()=>EC.A.boxes")
    for t in ['zones','shop','pass','arena','chat','char']:
        await pg.click(f'#tabs [data-tab={t}]');await pg.wait_for_timeout(250)
        if online and t in ('arena','chat'): await pg.screenshot(path=f'/tmp/{t}.png')
    out['chatBar']=await pg.inner_text('#chatBar') if online else ''
    out['opps']=await pg.evaluate("()=>(EC.A.opps||[]).length")
    await pg.click('[data-tab=arena]');await pg.wait_for_timeout(300);await pg.click('[data-act=fight]');await pg.wait_for_timeout(1200)
    out['duel']=await pg.evaluate("()=>[EC.SC.mode,EC.A.tickets]")
    await pg.click('[data-tab=pass]');await pg.wait_for_timeout(1300)
    out['events']=await pg.evaluate("()=>[document.querySelectorAll('#panel .card').length,document.getElementById('evChip').textContent]")
    out['errors']=errs
    return out
async def main():
    h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=ROOT)
    class Q(h.func):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Q,directory=ROOT));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'),args=['--no-sandbox'])
        for online in (False,True):
            ctx=await b.new_context(viewport={'width':390,'height':800});pg=await ctx.new_page()
            print(await run(pg,online));
            if online: await pg.screenshot(path='/tmp/online.png')
            await ctx.close()
        await b.close()
    srv.shutdown()
asyncio.run(main())
