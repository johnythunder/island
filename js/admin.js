/* admin.js — інструмент калібрування (тільки для admin.html). Координати — у % сцени #stage. */
(function(){
  const DEF=[[27,57,0],[34,46,0],[56,49,0],[61,69,0],[50,84,0],[19,68,0],[66,57,0]];
  const covers=['RedCover.png','BlueCover.png','GreenCover.png','YellowCover.png','OrangeCover.png','GreenWhiteCover.png','RedCover.png'];
  const stage=document.getElementById('stage');
  IR.board.init();
  IR.board.data = Object.assign({x:44,y:66,w:20}, (IR.LAYOUT&&IR.LAYOUT.board)||{});
  IR.board.apply();
  const seats=[]; for(let i=0;i<7;i++){ const s=(IR.LAYOUT&&IR.LAYOUT.seats&&IR.LAYOUT.seats[i])||DEF[i]; seats[i]=[s[0],s[1],s[2]||0]; }
  const decks=document.getElementById('sandDecks'), board=IR.board.el;
  const r=n=>Math.round(n*10)/10;
  const pct=e=>{ const b=stage.getBoundingClientRect();
    return [ (e.clientX-b.left)/b.width*100, (e.clientY-b.top)/b.height*100 ]; };

  function renderDecks(){ decks.innerHTML=''; seats.forEach((s,i)=>{ const el=document.createElement('div');
    el.className='sandDeck'; el.dataset.seat=i; el.style.left=s[0]+'%'; el.style.top=s[1]+'%';
    el.style.transform='translate(-50%,-50%) rotate('+(s[2]||0)+'deg)';
    el.style.backgroundImage='url(assets/cards/covers/'+covers[i]+')';
    el.innerHTML='<span class="dlab" style="background:#2a2a2a">#'+i+'</span>'; decks.appendChild(el); }); }

  function out(){ const b=IR.board.data;
    document.getElementById('out').value =
      '/* layout.js — ВШИТІ координати розкладки (згенеровано адмінкою). */\n'+
      'window.IR = window.IR || {};\n'+
      'IR.LAYOUT = {\n'+
      '  board: {x:'+r(b.x)+', y:'+r(b.y)+', w:'+r(b.w)+'},\n'+
      '  seats: [\n'+ seats.map(s=>'    ['+r(s[0])+','+r(s[1])+','+(s[2]||0)+']').join(',\n') +'\n  ]\n};\n';
  }

  let drag=null;
  board.addEventListener('mousedown',e=>{ e.preventDefault(); drag={t:'board'}; });
  board.addEventListener('wheel',e=>{ e.preventDefault();
    IR.board.data.w=Math.max(12,Math.min(40, IR.board.data.w+(e.deltaY<0?0.5:-0.5))); IR.board.apply(); out(); });
  decks.addEventListener('mousedown',e=>{ const d=e.target.closest('.sandDeck'); if(!d)return; e.preventDefault(); drag={t:'deck',i:+d.dataset.seat}; });
  window.addEventListener('mousemove',e=>{ if(!drag)return; const p=pct(e), x=p[0], y=p[1];
    if(drag.t==='board'){ IR.board.data.x=x; IR.board.data.y=y; IR.board.apply(); }
    else { seats[drag.i][0]=x; seats[drag.i][1]=y; renderDecks(); } out(); });
  window.addEventListener('mouseup',()=>{ drag=null; });

  document.getElementById('copyBtn').onclick=()=>{ const t=document.getElementById('out'); t.select(); try{document.execCommand('copy');}catch(e){} };
  document.getElementById('dlBtn').onclick=()=>{ const blob=new Blob([document.getElementById('out').value],{type:'text/javascript'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='layout.js'; a.click(); };

  renderDecks(); out();
  const v=document.getElementById('vidDay'); if(v) v.play().catch(()=>{});
})();