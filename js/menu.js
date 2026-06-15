/* menu.js — екрани: режим → кількість гравців → кімната. (Палубу з вибором колод приберено:
   колоди призначаються в кімнаті; власний вибір колоди гравцем повернемо окремим блоком.) */
IR.menu = {
  SCR:['scrAuth','scrHome','scrMode','scrPlayers','scrRoom','scrInfo'],
  go(id){ this.SCR.forEach(s=>{const e=document.getElementById(s); if(e) e.classList.toggle('show',s===id);});
    const inGame=(id===null);
    document.body.classList.toggle('ingame', inGame);
    if(!inGame) document.body.classList.remove('panelOpen');
    IR.board.el.style.display=inGame?'block':'none';
    document.getElementById('sandDecks').style.display=inGame?'block':'none';
    document.getElementById('eventCard').style.display=inGame?'block':'none';
    if(!inGame){['chooser','playPile'].forEach(x=>{const e=document.getElementById(x);if(e)e.classList.remove('show');});
      ['scoreBox','revealBox'].forEach(x=>{const e=document.getElementById(x);if(e)e.style.display='none';});
      if(IR.chat) IR.chat.stop();} },
  info(title,html){ document.getElementById('infoBox').innerHTML='<h3>'+title+'</h3>'+html; this.go('scrInfo'); },
  init(){
    document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>this.go(b.dataset.back));
    const pt=document.getElementById('panelToggle'); if(pt) pt.onclick=()=>document.body.classList.toggle('panelOpen');
    document.getElementById('modeGame').onclick=()=>{IR.cfg.mode='game';this.buildPlayers();this.go('scrPlayers');};
    document.getElementById('modeTest').onclick=()=>{IR.cfg.mode='test';this.buildPlayers();this.go('scrPlayers');};
    document.getElementById('plNext').onclick=()=>{ IR.room.create(IR.cfg.humans, IR.cfg.mode); };
    this.buildPlayers();
  },
  buildPlayers(){ const cfg=IR.cfg,title=document.getElementById('plTitle'),box=document.getElementById('plCount'),wm=document.getElementById('plWidmo');
    box.innerHTML='';
    if(cfg.mode==='game'){ title.textContent=IR.t('howManyPlayers');
      for(let i=2;i<=6;i++){const b=document.createElement('button');b.textContent=i;if(cfg.humans===i)b.className='on';
        b.onclick=()=>{cfg.humans=i;this.buildPlayers();};box.appendChild(b);}
      cfg.widmos=(cfg.humans===2)?1:0;
      wm.innerHTML=(cfg.humans===2)?IR.t('widmoTwo'):IR.t('widmoThreePlus');
    } else { title.textContent=IR.t('testTitle');cfg.humans=1;cfg.widmos=2;
      box.innerHTML='<div class="hint" style="font-size:15px;margin:6px 0">'+IR.t('testYouPlus2')+'</div>';
      wm.innerHTML=IR.t('testDesc'); }
  }
};
