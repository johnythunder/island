/* dice.js — два ВЕКТОРНІ ізометричні кубики ЗАВЖДИ на столі. Грань = випале число.
   Активний гравець клікає по них (кидок). Перекидаються (цикл), зупиняються на реальних значеннях. */
IR.dice = {
  wordEl:null, tableEl:null, tdice:null, _tt:null, _ft:null,
  PIPS:{1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],
        5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]},
  svg(v){ const C=[36,26],SX=13.2,SY=7.15;
    const p=(this.PIPS[v]||[]).map(a=>'<ellipse class="pipT" cx="'+(C[0]+a[0]*SX)+'" cy="'+(C[1]+a[1]*SY)+'" rx="3.1" ry="2"/>').join('');
    return '<svg viewBox="0 0 72 66"><polygon class="dl" points="12,26 36,39 36,59 12,46"/>'+
      '<polygon class="dr" points="36,39 60,26 60,46 36,59"/><polygon class="dtop" points="36,13 60,26 36,39 12,26"/>'+
      '<polygon class="edge" points="36,13 60,26 36,39 12,26"/><line class="edge" x1="36" y1="39" x2="36" y2="59"/>'+p+'</svg>'; },
  rand(){ return 1+Math.floor(Math.random()*6); },
  mount(){ this.wordEl=document.getElementById('dieWord'); },
  tableMount(){ if(this.tableEl) return;
    const host=document.getElementById('boardBox')||document.getElementById('stage'); if(!host) return;
    const w=document.createElement('div'); w.id='tableDice'; w.className='tableDice';
    w.innerHTML='<div class="tdie"></div><div class="tdie"></div>'; host.appendChild(w);
    this.tableEl=w; this.tdice=Array.prototype.slice.call(w.querySelectorAll('.tdie'));
    this.tdice.forEach(d=>d.onclick=()=>{ if(w.classList.contains('live') && IR.online) IR.online.rollClick(); });
    this.face(0,this.rand()); this.face(1,this.rand()); },
  face(idx,v){ const d=this.tdice&&this.tdice[idx]; if(d) d.innerHTML=this.svg(v); },
  tableRoll(v1,v2){ if(!this.tdice) return; clearInterval(this._tt); let n=0;
    this._tt=setInterval(()=>{ this.face(0,this.rand()); this.face(1,this.rand());
      if(++n>9){ clearInterval(this._tt); this.face(0,v1); this.face(1,v2); } }, 70);
    this.tableEl.classList.add('rolling'); clearTimeout(this._rt);
    this._rt=setTimeout(()=>this.tableEl.classList.remove('rolling'),780); },
  setLive(on){ if(this.tableEl) this.tableEl.classList.toggle('live', !!on); },
  tableShow(on){ if(this.tableEl) this.tableEl.style.display=on?'flex':'none'; },
  flash(sum){ if(!this.wordEl) return; const d=IR.board.data;
    this.wordEl.style.left=d.x+'%'; this.wordEl.style.top=(d.y-6)+'%';
    this.wordEl.textContent=IR.numWord(sum); this.wordEl.classList.add('show');
    clearTimeout(this._ft); this._ft=setTimeout(()=>this.wordEl.classList.remove('show'),1500); }
};