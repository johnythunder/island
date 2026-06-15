/* interaction.js — каруселя ВЛАСНОЇ колоди гравця. Режим 'view' (гортати для ознайомлення)
   і 'pick' (клік центральну = вибір). Стартує з нейтральних. Перемальовується при зміні мови (relang). */
IR.interaction = {
  pile:[], pileEl:null, chooserEl:null, _wheel:null, _ctx:null, _sig:null,
  init(){ this.pileEl=document.getElementById('playPile'); this.chooserEl=document.getElementById('chooser'); },
  reset(){ this.pile=[]; this.renderPile(); },
  close(){ const ch=this.chooserEl; if(!ch) return;
    if(this._wheel){ ch.removeEventListener('wheel', this._wheel); this._wheel=null; }
    ch.classList.remove('show'); ch.innerHTML=''; this._ctx=null; this._sig=null; },

  neutralStart(avail){ for(let i=0;i<avail.length;i++) if(IR.REACTIONS[avail[i]].g==='neu') return i; return 0; },

  /* part:{color,name}, mode:'view'|'pick', avail:[idx], onPick:fn(idx)|null */
  showDeck(part, mode, avail, onPick){
    const sig=mode+'|'+avail.join(',');
    if(sig===this._sig && this._ctx){ this._ctx.onPick=onPick; this._ctx.part=part; return; } // без зайвого перемалювання
    let pos = this._ctx ? Math.min(this._ctx.pos, Math.max(avail.length-1,0)) : this.neutralStart(avail);
    if(!this._ctx) pos=this.neutralStart(avail);
    this._ctx={part, mode, avail, onPick, pos}; this._sig=sig; this._draw();
  },
  relang(){ if(this._ctx && this.chooserEl && this.chooserEl.classList.contains('show')) this._draw(); },

  _draw(){ const ch=this.chooserEl, ctx=this._ctx; if(!ch||!ctx) return;
    if(this._wheel){ ch.removeEventListener('wheel', this._wheel); this._wheel=null; }
    const list=ctx.avail; if(!list.length){ ch.classList.remove('show'); ch.innerHTML=''; return; }
    if(ctx.pos>=list.length) ctx.pos=0;
    const pick=ctx.mode==='pick';
    const ai=list[ctx.pos], aL=list[(ctx.pos+list.length-1)%list.length], aR=list[(ctx.pos+1)%list.length];
    const c=IR.REACTIONS[ai];
    const title = pick ? IR.t('yourReaction',{name:ctx.part.name}) : IR.t('yourDeck');
    ch.className='chooser show'+(pick?' picking':' viewing');
    ch.innerHTML=
      '<div class="chTitle" style="border-color:'+ctx.part.color+'"><span class="pill" style="background:'+ctx.part.color+'"></span>'+title+'</div>'+
      '<div class="curReact" style="color:'+IR.RGROUP[c.g]+'">'+IR.rname(c)+'</div>'+
      '<div class="carWrap"><button class="carNav" data-d="-1">‹</button>'+
        '<div class="carCard side">'+IR.cards.reactionFace(IR.REACTIONS[aL])+'</div>'+
        '<div class="carCard center'+(pick?' pickable':'')+'" id="carPick">'+IR.cards.reactionFace(c)+'</div>'+
        '<div class="carCard side">'+IR.cards.reactionFace(IR.REACTIONS[aR])+'</div>'+
        '<button class="carNav" data-d="1">›</button></div>'+
      '<div class="carHint">'+IR.t('cardsLeft')+' '+list.length+' • '+(pick?IR.t('carHint'):IR.t('viewHint'))+'</div>';
    ch.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{ ctx.pos=(ctx.pos+(+el.dataset.d)+list.length)%list.length; this._draw(); });
    const center=document.getElementById('carPick');
    if(pick) center.onclick=()=>{ const chosen=list[ctx.pos], fn=ctx.onPick; this.close(); if(fn) fn(chosen); };
    const onWheel=e=>{ e.preventDefault(); ctx.pos=(ctx.pos+(e.deltaY>0?1:-1)+list.length)%list.length; this._draw(); };
    this._wheel=onWheel; ch.addEventListener('wheel', onWheel, {passive:false});
  },

  renderPile(){ if(!this.pileEl) return; const n=this.pile.length;
    if(!n){ this.pileEl.classList.remove('show'); this.pileEl.innerHTML=''; return; }
    const last=this.pile[n-1]; this.pileEl.classList.add('show');
    this.pileEl.innerHTML='<div class="pileCount">'+IR.t('playedWord')+' '+n+'/24</div>'+
      '<div class="pileStack"><div class="pCard pEvent"><b>'+IR.util.pad(last.sit)+'</b><span>'+IR.sit(last.sit)+'</span></div>'+
      '<div class="pCard pBack"></div><div class="pCard pBack pBack2"></div></div>'; }
};