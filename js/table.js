/* table.js — фінал: reveal стопки + бали (3 / 1 / 0). */
IR.table = {
  el:null,
  init(){ this.el=document.getElementById('scrTable'); },
  show(){
    const st=(window.IR && IR.game && IR.game.state)||null; if(!st||!st.stack||!st.stack.length){ return; }
    const P=st.participants, score=P.map(()=>0);
    const rows=st.stack.map(e=>{ const ra=IR.REACTIONS[e.a.r], rb=IR.REACTIONS[e.b.r];
      let pts=0; if(e.a.r===e.b.r) pts=3; else if(ra.g===rb.g) pts=1;
      score[e.a.pi]+=pts; score[e.b.pi]+=pts; return {e,ra,rb,pts}; });
    const mini=r=>'<span class="miniDot" style="background:'+IR.RGROUP[r.g]+'"></span>'+IR.rname(r);

    let left='<h3>'+IR.t('pairsTitle')+'</h3><div class="anList">';
    rows.forEach(r=>{ const A=P[r.e.a.pi], B=P[r.e.b.pi]; const cls=r.pts===3?'p3':r.pts===1?'p1':'p0';
      left+='<div class="anRow"><div class="anSit"><b>'+IR.util.pad(r.e.sit)+'</b> '+IR.sit(r.e.sit)+'</div>'+
        '<div class="anPair"><span class="anR" style="border-color:'+A.color+'">'+mini(r.ra)+' <i>'+A.short+'</i></span>'+
        '<span class="anR" style="border-color:'+B.color+'">'+mini(r.rb)+' <i>'+B.short+'</i></span></div>'+
        '<span class="pB '+cls+'">'+r.pts+'</span></div>'; });
    left+='</div>';

    const order=P.map((p,i)=>({p,s:score[i]})).sort((x,y)=>y.s-x.s);
    const max=order.length?order[0].s:0;
    let right='<h3>'+IR.t('scoreTitle')+'</h3><div class="stList">';
    order.forEach(o=>{ right+='<div class="stRow'+(o.s===max&&max>0?' win':'')+'">'+
      '<span class="pill" style="background:'+o.p.color+'"></span><span class="stName">'+o.p.name+(o.p.isWidmo?' 👻':'')+'</span>'+
      '<span class="stPts">'+o.s+'</span></div>'; });
    right+='</div><div class="stLegend">'+IR.t('legend')+'</div>';

    this.el.innerHTML='<div class="tableWrap"><div class="tCol tLeft">'+left+'</div>'+
      '<div class="tCol tRight">'+right+'<button class="mbtn" id="tClose" style="margin-top:18px">'+IR.t('toMenu')+'</button></div></div>';
    document.getElementById('tClose').onclick=()=>{ this.el.classList.remove('show'); IR.lobby.show(); };
    document.getElementById('panel').style.display='none';
    this.el.classList.add('show');
  }
};