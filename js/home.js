// The Vellum home page: choose what you want to do.
App.home = { show() { $('home').hidden = false; }, hide() { $('home').hidden = true; } };
$('homeEdit').onclick = () => App.home.hide();
$('homeSign').onclick = () => { App.home.hide(); App.cloud.openDashboard(); };
$('homeBtn').onclick = () => { $('menu').hidden = true; App.home.show(); };
$('spBack').onclick = () => { $('sendPanel').hidden = true; document.body.classList.remove('noscroll'); App.home.show(); };
