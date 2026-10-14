"use strict";
/* Load last good Horae build, patch moon panel, then run */
(async function(){
  const GOOD = "https://raw.githubusercontent.com/yilan-huang/sun-clock/5fac0ddff3ecff40fa0c99ece62378332cb8da3c/index.html";
  let html;
  try {
    const r = await fetch(GOOD, {cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    html = await r.text();
  } catch(e) {
    console.error(e);
    document.body.insertAdjacentHTML("afterbegin",
      '<p style="padding:24px;text-align:center;color:#ecebf5;font-family:system-ui">Could not load clock. Please refresh.</p>');
    return;
  }
  const m = html.match(/<script>([\s\S]*?)<\/script>/i);
  if(!m){ console.error("no script block"); return; }
  let code = m[1];

  // 1) Add nextMoonset i18n keys
  code = code.replace(
    "nextMoonrise: 'next moonrise',\n    toFullMoon:",
    "nextMoonrise: 'next moonrise',\n    nextMoonset: 'next moonset',\n    toFullMoon:"
  );
  code = code.replace(
    "nextMoonrise: '\u4e0b\u6b21\u6708\u51fa',\n    toFullMoon:",
    "nextMoonrise: '\u4e0b\u6b21\u6708\u51fa',\n    nextMoonset: '\u4e0b\u6b21\u6708\u843d',\n    toFullMoon:"
  );

  // 2) Insert nextMoonEvents after getMoonTimes closing
  const marker = "const r={}; if(rise!==undefined)r.rise=hoursLater(t,rise); if(set!==undefined)r.set=hoursLater(t,set);\n  return r;\n}";
  const insert = marker + `
function nextMoonEvents(now, lat, lng){
  let rise=null, set=null;
  for(let dOff=0; dOff<4; dOff++){
    const day = new Date(now.valueOf() + dOff*dayMs);
    const tt = getMoonTimes(day, lat, lng);
    if(!rise && tt.rise && tt.rise > now) rise = tt.rise;
    if(!set  && tt.set  && tt.set  > now) set  = tt.set;
    if(rise && set) break;
  }
  return { rise, set };
}`;
  if(code.indexOf(marker)===-1){ console.error("getMoonTimes marker missing"); }
  else code = code.replace(marker, insert);

  // 3) Replace the moonrise-only block inside renderMoon
  const oldBlock = `  // next moonrise: scan today, then forward up to 2 days
  let rise=null;
  for(let dOff=0; dOff<3 && !rise; dOff++){
    const r = getMoonTimes(new Date(now.valueOf()+dOff*dayMs), LOC.lat, LOC.lng).rise;
    if(r && r>now) rise=r;
  }
  document.getElementById('moonRise').textContent = rise ? (t('in')+fmtDur(rise-now)+(LANG==='zh'?'\u540e':'')) : '\u2014';`;

  const newBlock = `  // Moon up \u2192 time until set; moon down \u2192 time until rise
  const up = getMoonPosition(now, LOC.lat, LOC.lng).altitude > 0;
  const ev = nextMoonEvents(now, LOC.lat, LOC.lng);
  const event = up ? ev.set : ev.rise;
  const labelEl = document.querySelector('.moon-detail .k');
  if(labelEl) labelEl.textContent = up ? t('nextMoonset') : t('nextMoonrise');
  document.getElementById('moonRise').textContent = event
    ? (t('in')+fmtDur(event-now)+(LANG==='zh'?'\u540e':''))
    : '\u2014';`;

  if(code.indexOf(oldBlock)===-1){
    console.error("renderMoon block missing \u2014 moon fix not applied");
  } else {
    code = code.replace(oldBlock, newBlock);
  }

  // Don't force static label for rise/set (renderMoon owns it)
  code = code.replace(
    "if(ks[0]) ks[0].textContent = t('nextMoonrise');\n  if(ks[1]) ks[1].textContent = t('toFullMoon');",
    "if(ks[1]) ks[1].textContent = t('toFullMoon');"
  );

  (0, eval)(code);
})();
