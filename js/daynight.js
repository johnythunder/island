/* daynight.js — ручний перемикач день/ніч (зберігається в акаунт, якщо залогінений) */
IR.daynight = {
  init(){
    const d=document.getElementById('tDay'), n=document.getElementById('tNight');
    const upd=()=>{const isN=document.body.classList.contains('night');d.classList.toggle('on',!isN);n.classList.toggle('on',isN);};
    d.onclick=()=>{document.body.classList.remove('night');upd(); if(IR.net&&IR.net.me)IR.net.savePrefs({night:false});};
    n.onclick=()=>{document.body.classList.add('night');upd(); if(IR.net&&IR.net.me)IR.net.savePrefs({night:true});};
    upd();
  }
};