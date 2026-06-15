/* board.js — фіксована позиція/масштаб дошки (без повороту й ручного розміщення) */
IR.board = {
  el:null, overlay:null,
  data:{x:44,y:66,w:20},
  apply(){ const d=this.data,b=this.el; b.style.left=d.x+'%'; b.style.top=d.y+'%'; b.style.width=d.w+'%';
    b.style.transform='translate(-50%,-50%)'; },
  init(){ this.el=document.getElementById('boardBox'); this.overlay=document.getElementById('overlay'); this.apply(); }
};