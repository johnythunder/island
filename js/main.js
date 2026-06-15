/* main.js — старт: транспорт, мова, розкладка, екрани (вхід → лобі → кімната → гра). */
(function(){
  IR.i18n.init();
  IR.net.init();
  IR.daynight.init();
  IR.board.init();
  if(window.IR && IR.LAYOUT){
    Object.assign(IR.board.data, IR.LAYOUT.board||{});
    if(IR.LAYOUT.seats) IR.cards.SEATS = IR.LAYOUT.seats;
    IR.board.apply();
  }
  IR.cards.init();
  IR.interaction.init();
  IR.table.init();
  IR.dice.mount();
  IR.menu.init();
  IR.auth.init();
  IR.lobby.init();
  IR.room.init();
  IR.online.init();
  IR.chat.init();
  IR.cells = IR.DEFAULT_CELLS;
  IR.i18n.apply();
  IR.auth.boot();
  ['vidDay','vidNight'].forEach(id=>{const v=document.getElementById(id);if(v)v.play().catch(()=>{});});
})();