# Lists every Hebrew phrase that appears in the game's source, the way the translator splits text at run time:
# a phrase is a stretch of Hebrew words; digits, Latin text, tags and sentence punctuation end it.
import re,sys,json
FILES=['web/core.js','web/game.js','web/index.html','supabase/functions/act/handler.js','server/live.mjs']
RUN=re.compile(r"[֐-׿][֐-׿ \"'׳״\-]*[֐-׿]|[֐-׿]")
out={}
for f in FILES:
    for m in RUN.finditer(open(f,encoding='utf8').read()):
        k=re.sub(r'\s+',' ',m.group(0)).strip(" '\"-")
        if k: out[k]=out.get(k,0)+1
if __name__=='__main__':
    ks=sorted(out,key=lambda k:(-len(k.split()),k))
    json.dump(ks,open('/tmp/he_runs.json','w'),ensure_ascii=False,indent=0)
    print(len(ks),sum(len(k.split()) for k in ks))
