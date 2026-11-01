import json,sys
def apply(n, fixes):
    p=f"scripts/pg/{n:02d}.json"
    d=json.load(open(p,encoding="utf-8"))
    for i,(a,w) in fixes.items():
        q=d["questions"][i]
        if a: q["a"]=a
        if w: q["w"]=w
        assert len(q["w"])==4 and len({q["a"],*q["w"]})==5,(n,i)
    json.dump(d,open(p,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
