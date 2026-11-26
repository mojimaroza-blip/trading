const $ = (id) => document.getElementById(id);
const API_URL = "https://api.twelvedata.com/time_series";
let chart, candleSeries, candles = [], currentSymbol = "EUR/USD", currentInterval = "5min";
let fibLine, drawings = [], activeTool = "cursor", drawingStart = null, previewPoint = null, refreshTimer;
let replayMode=false, replayIndex=0, replayTimer=null;
const ACCOUNT_KEY="mojimaro_demo_account_v1";
let account=loadAccount();
const intervals = {"1min":"M1","5min":"M5","15min":"M15","30min":"M30","1h":"H1","4h":"H4","1day":"D1"};
const samplePrices = {"EUR/USD":1.0842,"GBP/USD":1.271,"USD/JPY":149.2,"AUD/USD":0.654,"XAU/USD":2360,"SPX":5200,"NDX":18200,"DJI":39000};

function initChart(){
  const el=$("chart");
  chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:"solid",color:"#0e1725"},textColor:"#8292a8"},grid:{vertLines:{color:"#172538"},horzLines:{color:"#172538"}},rightPriceScale:{borderColor:"#26364a"},timeScale:{borderColor:"#26364a",timeVisible:true,secondsVisible:false},crosshair:{mode:1},handleScroll:true,handleScale:true});
  candleSeries=chart.addCandlestickSeries({upColor:"#16c784",downColor:"#ea5b68",borderUpColor:"#16c784",borderDownColor:"#ea5b68",wickUpColor:"#16c784",wickDownColor:"#ea5b68"});
  const ro=new ResizeObserver(()=>{chart.applyOptions({width:el.clientWidth,height:el.clientHeight});resizeDrawingCanvas();});
  ro.observe(el); resizeDrawingCanvas();
}
function demoCandles(symbol,interval,count=180){
  const step=interval==="1day"?86400:interval==="4h"?14400:interval==="1h"?3600:interval==="30min"?1800:interval==="15min"?900:interval==="5min"?300:60;
  let price=samplePrices[symbol]||1.1, now=Math.floor(Date.now()/1000/step)*step, out=[];
  const scale=price>100?price*.0008:.00045;
  for(let i=count-1;i>=0;i--){const time=now-i*step,drift=(Math.random()-.49)*scale*2.2,open=price,close=Math.max(.00001,open+drift);out.push({time,open,high:Math.max(open,close)+Math.random()*scale,low:Math.min(open,close)-Math.random()*scale,close});price=close;}
  return out;
}
function parseApiValues(values){
  return values.slice().reverse().map(v=>{
    const stamp=String(v.datetime).includes("T")?String(v.datetime):String(v.datetime).replace(" ","T");
    const time=Math.floor(new Date(stamp.endsWith("Z")?stamp:stamp+"Z").getTime()/1000);
    return {time,open:+v.open,high:+v.high,low:+v.low,close:+v.close};
  }).filter(v=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite));
}
async function fetchMarketData(){
  const key=localStorage.getItem("mojimaro_td_key");
  if(!key){candles=demoCandles(currentSymbol,currentInterval);$("dataStatus").textContent="DEMO DATA";return false;}
  $("dataStatus").textContent="UPDATING";
  const url=`${API_URL}?symbol=${encodeURIComponent(currentSymbol)}&interval=${currentInterval}&outputsize=500&timezone=UTC&apikey=${encodeURIComponent(key)}`;
  const res=await fetch(url); const data=await res.json();
  if(!res.ok||data.status==="error"||!data.values)throw new Error(data.message||data.code||"Market data request failed");
  const fresh=parseApiValues(data.values);
  if(!fresh.length)throw new Error("The provider returned no usable candles for this symbol.");
  candles=fresh;$("dataStatus").textContent="API DATA";return true;
}
function visibleCandles(){return replayMode?candles.slice(0,replayIndex+1):candles;}
function paintMarket(){
  if(!candles.length)return;
  const shown=visibleCandles();if(!shown.length)return;
  candleSeries.setData(shown);
  const last=shown[shown.length-1],first=shown[0],change=((last.close-first.open)/first.open)*100;
  $("lastPrice").textContent=fmt(last.close);$("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"%";$("priceChange").className=change>=0?"positive":"negative";
  $("chartTimestamp").textContent=(replayMode?"REPLAY: ":"Last candle: ")+new Date(last.time*1000).toLocaleString()+(replayMode?" · future candles hidden":" · auto-refresh every 2 min");
  $("ticketPrice").textContent=fmt(last.close);updateReplayUI();renderAccount();redrawDrawings();
}
async function loadCandles(keepView=false){
  currentSymbol=$("symbolSelect").value;currentInterval=$("intervalSelect").value;
  $("marketName").textContent=currentSymbol;$("marketClass").textContent=currentSymbol==="XAU/USD"?"METAL":["SPX","NDX","DJI"].includes(currentSymbol)?"INDEX":"FOREX";
  $("chartTitle").textContent=`${currentSymbol} · ${intervals[currentInterval]}`;
  try{await fetchMarketData();paintMarket();if(!keepView)chart.timeScale().fitContent();}
  catch(err){$("dataStatus").textContent="DATA ERROR";$("chartTimestamp").textContent=err.message+" · Check symbol/API access";$("scoreMessage").textContent="Market data unavailable. Check your API key, symbol permissions and request limits.";console.error(err);}
}
function fmt(n){return Number(n).toLocaleString("en-US",{maximumFractionDigits:n>100?2:5,minimumFractionDigits:n>100?2:4});}
function smaDirection(data){
  if(data.length<30)return "NEUTRAL";
  const c=data.map(x=>x.close),fast=c.slice(-10).reduce((a,b)=>a+b,0)/10,slow=c.slice(-30).reduce((a,b)=>a+b,0)/30;
  return fast>slow?"BULLISH":fast<slow?"BEARISH":"NEUTRAL";
}
function analyze(){ /* MOJIMARO is a manual analysis and execution journal: no strategy signals are generated. */ }
function drawFib(){ /* No automatic strategy levels are drawn. */ }

/* Drawing tools: drawings are saved in this browser session and use chart time/price coordinates. */
function setTool(tool){
  activeTool=tool;drawingStart=null;previewPoint=null;
  document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));
  $("chartWrap").classList.toggle("drawing-active",tool!=="cursor");
  $("drawingCanvas").style.pointerEvents=tool==="cursor"?"none":"auto";
  redrawDrawings();
}
function resizeDrawingCanvas(){
  const canvas=$("drawingCanvas");if(!canvas||!chart)return;
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);redrawDrawings();
}
function pointFromEvent(e){
  const rect=$("drawingCanvas").getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  const time=chart.timeScale().coordinateToTime(x),price=candleSeries.coordinateToPrice(y);
  if(time==null||price==null)return null;return {time,price};
}
function xy(point){
  const x=chart.timeScale().timeToCoordinate(point.time),y=candleSeries.priceToCoordinate(point.price);
  return x==null||y==null?null:{x,y};
}
function drawShape(ctx,item,preview=false){
  const a=xy(item.a),b=xy(item.b||item.a);if(!a||!b)return;
  ctx.save();ctx.lineWidth=1.6;ctx.strokeStyle=item.color||"#58a6ff";ctx.fillStyle=(item.color||"#58a6ff")+"22";ctx.setLineDash(item.kind==="horizontal"?[7,5]:[]);
  if(item.kind==="horizontal"){ctx.beginPath();ctx.moveTo(0,a.y);ctx.lineTo($("drawingCanvas").clientWidth,a.y);ctx.stroke();}
  else if(item.kind==="trend"){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  else if(item.kind==="rectangle"){ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
  ctx.restore();
}
function redrawDrawings(){
  const canvas=$("drawingCanvas");if(!canvas||!chart)return;const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
  drawings.forEach(d=>drawShape(ctx,d));if(drawingStart&&previewPoint){drawShape(ctx,{kind:activeTool,a:drawingStart,b:previewPoint,color:"#e5b85c"});}
}
function handleDrawPointer(e){
  if(activeTool==="cursor")return;
  const point=pointFromEvent(e);if(!point)return;
  if(e.type==="pointermove"){if(drawingStart){previewPoint=point;redrawDrawings();}return;}
  if(e.type==="pointerdown"){
    e.preventDefault();$("drawingCanvas").setPointerCapture(e.pointerId);
    if(activeTool==="horizontal"){drawings.push({kind:"horizontal",a:point,color:"#e5b85c"});redrawDrawings();return;}
    if(!drawingStart){drawingStart=point;previewPoint=point;}
    else{drawings.push({kind:activeTool,a:drawingStart,b:point,color:"#58a6ff"});drawingStart=null;previewPoint=null;redrawDrawings();}
  }
}
function setupDrawingTools(){
  document.querySelectorAll("[data-tool]").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));
  $("drawingCanvas").addEventListener("pointerdown",handleDrawPointer);
  $("drawingCanvas").addEventListener("pointermove",handleDrawPointer);
  $("undoDrawing").addEventListener("click",()=>{drawings.pop();redrawDrawings();});
  $("clearDrawings").addEventListener("click",()=>{drawings=[];drawingStart=null;previewPoint=null;redrawDrawings();});
  $("fullscreenBtn").addEventListener("click",async()=>{
    const target=$("chart-panel");
    try{if(!document.fullscreenElement)await target.requestFullscreen();else await document.exitFullscreen();}
    catch(e){$("chartTimestamp").textContent="Full screen is not supported by this browser.";}
  });
  document.addEventListener("fullscreenchange",()=>{setTimeout(()=>{chart.applyOptions({width:$("chart").clientWidth,height:$("chart").clientHeight});resizeDrawingCanvas();},100);});
  chart.timeScale().subscribeVisibleTimeRangeChange(redrawDrawings);
  candleSeries.subscribeDataChanged(redrawDrawings);
}
function scheduleAutoRefresh(){
  if(refreshTimer)clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{if(!replayMode&&document.visibilityState==="visible"&&localStorage.getItem("mojimaro_td_key"))loadCandles(true);},120000);
}
function loadAccount(){
  try{const saved=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||"null");if(saved&&Array.isArray(saved.open)&&Array.isArray(saved.closed))return saved;}catch(e){}
  return {startingBalance:1000,open:[],closed:[]};
}
function saveAccount(){localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));}
function contractSize(symbol){if(symbol==="XAU/USD")return 100;if(["SPX","NDX","DJI"].includes(symbol))return 1;return 100000;}
function tradePnl(t,price=t.markPrice??t.entry){const move=(price-t.entry)*(t.side==="BUY"?1:-1);return move*t.lots*contractSize(t.symbol);}
function updateOpenMarks(price){account.open.forEach(t=>{if(t.symbol===currentSymbol)t.markPrice=price;});}
function money(n){return (n<0?"-":"")+"$"+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function currentPrice(){const shown=visibleCandles();return shown.length?shown[shown.length-1].close:null;}
function currentCandle(){const shown=visibleCandles();return shown.length?shown[shown.length-1]:null;}
function renderAccount(){
  const balance=1000+account.closed.reduce((a,t)=>a+t.pnl,0),price=currentPrice()??0;
  updateOpenMarks(price);const openPnl=account.open.reduce((a,t)=>a+tradePnl(t),0),equity=balance+openPnl;
  const wins=account.closed.filter(t=>t.pnl>0),losses=account.closed.filter(t=>t.pnl<0),count=account.closed.length;
  const grossWin=wins.reduce((a,t)=>a+t.pnl,0),grossLoss=Math.abs(losses.reduce((a,t)=>a+t.pnl,0));
  const winRate=count?wins.length/count*100:0,lossRate=count?losses.length/count*100:0;
  let peak=1000,maxDd=0,curve=1000;account.closed.slice().reverse().forEach(t=>{curve+=t.pnl;peak=Math.max(peak,curve);maxDd=Math.max(maxDd,peak-curve);});
  const set=(id,val)=>{const el=$(id);if(el)el.textContent=val;};
  set("miniBalance",money(balance));set("miniEquity",money(equity));set("miniOpenPnl",money(openPnl));set("miniTrades",String(count));
  set("statBalance",money(balance));set("statEquity",money(equity));set("statNet",money(balance-1000));set("statWinRate",winRate.toFixed(1)+"%");set("statLossRate",lossRate.toFixed(1)+"%");set("statProfitFactor",grossLoss? (grossWin/grossLoss).toFixed(2):grossWin?"∞":"—");set("statWinsLosses",wins.length+" / "+losses.length);set("statDrawdown",money(maxDd));
  set("openCount",account.open.length+" OPEN");
  const openBody=$("openPositionsBody");
  if(openBody)openBody.innerHTML=account.open.length?account.open.map(t=>{const pnl=tradePnl(t);return `<tr><td>${esc(t.symbol)}</td><td class="${t.side==="BUY"?"positive":"negative"}">${t.side}</td><td>${t.lots.toFixed(2)}</td><td>${fmt(t.entry)}</td><td>${t.stop?fmt(t.stop):"—"}</td><td>${t.target?fmt(t.target):"—"}</td><td class="${pnl>=0?"positive":"negative"}">${money(pnl)}</td><td><button class="close-trade" data-close="${t.id}">Close</button></td></tr>`;}).join(""):'<tr><td colspan="8" class="empty-row">No open demo positions.</td></tr>';
  const history=$("historyBody");
  if(history)history.innerHTML=account.closed.length?account.closed.slice().reverse().map(t=>`<tr><td>${new Date(t.closedAt).toLocaleString()}</td><td>${esc(t.symbol)}</td><td class="${t.side==="BUY"?"positive":"negative"}">${t.side}</td><td>${t.lots.toFixed(2)}</td><td>${fmt(t.entry)}</td><td>${fmt(t.exit)}</td><td class="${t.pnl>=0?"positive":"negative"}">${money(t.pnl)}</td><td class="note-cell">${esc(t.note||"")}</td></tr>`).join(""):'<tr><td colspan="8" class="empty-row">No closed trades yet. Start practising.</td></tr>';
}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openDemoTrade(side){
  const candle=currentCandle();if(!candle){$("ticketMessage").textContent="Load candle data before opening a demo trade.";return;}
  const lots=Number($("lotSize").value),stop=Number($("stopInput").value)||null,target=Number($("takeInput").value)||null,entry=candle.close;
  if(!Number.isFinite(lots)||lots<=0||lots>100){$("ticketMessage").textContent="Enter a lot size between 0.01 and 100.";return;}
  if(stop!==null&&((side==="BUY"&&stop>=entry)||(side==="SELL"&&stop<=entry))){$("ticketMessage").textContent="Stop loss must be below entry for BUY and above entry for SELL.";return;}
  if(target!==null&&((side==="BUY"&&target<=entry)||(side==="SELL"&&target>=entry))){$("ticketMessage").textContent="Take profit must be above entry for BUY and below entry for SELL.";return;}
  account.open.push({id:Date.now()+Math.random().toString(16).slice(2),symbol:currentSymbol,side,lots,entry,stop,target,note:$("tradeNote").value.trim(),markPrice:entry,openedAt:new Date(candle.time*1000).toISOString()});
  saveAccount();renderAccount();$("ticketMessage").textContent=side+" opened at "+fmt(entry)+" on the demo account.";$("tradeNote").value="";
}
function closeDemoTrade(id,price,reason="MANUAL"){
  const index=account.open.findIndex(t=>String(t.id)===String(id));if(index<0)return;
  const t=account.open.splice(index,1)[0],exit=price??t.markPrice??(t.symbol===currentSymbol?currentPrice():t.entry),pnl=tradePnl(t,exit);
  account.closed.push({...t,exit,pnl,reason,closedAt:new Date().toISOString()});saveAccount();renderAccount();
}
function checkStopsOnCandle(candle){
  account.open.slice().forEach(t=>{
    if(t.symbol!==currentSymbol)return;
    let exit=null,reason="";
    if(t.side==="BUY"){
      if(t.stop!==null&&candle.low<=t.stop){exit=t.stop;reason="STOP LOSS";}
      else if(t.target!==null&&candle.high>=t.target){exit=t.target;reason="TAKE PROFIT";}
    }else{
      if(t.stop!==null&&candle.high>=t.stop){exit=t.stop;reason="STOP LOSS";}
      else if(t.target!==null&&candle.low<=t.target){exit=t.target;reason="TAKE PROFIT";}
    }
    if(exit!==null)closeDemoTrade(t.id,exit,reason);
  });
}
function setReplayIndex(index){
  replayIndex=Math.max(0,Math.min(candles.length-1,index));
  candleSeries.setData(visibleCandles());const shown=visibleCandles(),last=shown[shown.length-1];
  if(last){updateOpenMarks(last.close);const first=shown[0],change=((last.close-first.open)/first.open)*100;$("lastPrice").textContent=fmt(last.close);$("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"%";$("priceChange").className=change>=0?"positive":"negative";$("ticketPrice").textContent=fmt(last.close);$("chartTimestamp").textContent="REPLAY: "+new Date(last.time*1000).toLocaleString()+" · future candles hidden";checkStopsOnCandle(last);}
  updateReplayUI();renderAccount();redrawDrawings();
}
function updateReplayUI(){
  const slider=$("replaySlider");if(!slider)return;
  slider.max=Math.max(0,candles.length-1);slider.min=Math.min(30,Math.max(0,candles.length-1));
  if(!replayMode&&candles.length)slider.value=candles.length-1;else slider.value=replayIndex;
  slider.disabled=!candles.length;
  if(!replayMode&&!slider.dataset.initialized&&candles.length){slider.value=candles.length-1;slider.dataset.initialized="1";}
  const shown=visibleCandles(),last=replayMode?shown[shown.length-1]:candles[Math.min(Number(slider.value)||0,candles.length-1)];
  $("replayDate").textContent=last?((replayMode?"Replay point: ":"Selected start: ")+new Date(last.time*1000).toLocaleString()):"No candle selected";
  $("replayProgress").textContent=candles.length?(replayMode?shown.length+" / "+candles.length+" candles":"Choose a historical candle to start replay"):"0 / 0 candles";
  $("replayStatus").textContent=replayMode?"REPLAY ACTIVE":"LIVE VIEW";
  ["playReplayBtn","stepBackBtn","stepForwardBtn","exitReplayBtn"].forEach(id=>$(id).disabled=!replayMode);
  $("enterReplayBtn").disabled=!candles.length||replayMode;
}
function stopReplay(){if(replayTimer){clearInterval(replayTimer);replayTimer=null;}$("playReplayBtn").textContent="▶ Play";}
function stepReplay(direction=1){if(!replayMode)return;const next=replayIndex+direction;if(next<0)return;if(next>=candles.length){stopReplay();return;}setReplayIndex(next);}
function setupReplay(){
  $("enterReplayBtn").addEventListener("click",()=>{if(!candles.length)return;stopReplay();replayMode=true;const chosen=Number($("replaySlider").value);replayIndex=Math.min(chosen,candles.length-1);if(replayIndex>=candles.length-1)replayIndex=Math.max(30,candles.length-30);setReplayIndex(replayIndex);updateReplayUI();});
  $("exitReplayBtn").addEventListener("click",()=>{stopReplay();replayMode=false;replayIndex=candles.length-1;paintMarket();});
  $("stepForwardBtn").addEventListener("click",()=>stepReplay(1));$("stepBackBtn").addEventListener("click",()=>stepReplay(-1));
  $("replaySlider").addEventListener("input",e=>{if(replayMode){stopReplay();setReplayIndex(Number(e.target.value));}else{const c=candles[Number(e.target.value)];if(c){$("replayDate").textContent="Selected start: "+new Date(c.time*1000).toLocaleString();}}});
  $("playReplayBtn").addEventListener("click",()=>{if(replayTimer){stopReplay();return;}if(replayIndex>=candles.length-1)return;$("playReplayBtn").textContent="Ⅱ Pause";replayTimer=setInterval(()=>stepReplay(1),Number($("replaySpeed").value));});
  $("replaySpeed").addEventListener("change",()=>{if(replayTimer){stopReplay();$("playReplayBtn").click();}});
}
function setupEvents(){
  $("refreshBtn").addEventListener("click",()=>loadCandles(true));
  $("symbolSelect").addEventListener("change",()=>{stopReplay();replayMode=false;drawings=[];loadCandles();});
  $("intervalSelect").addEventListener("change",()=>{stopReplay();replayMode=false;drawings=[];loadCandles();});
  $("watchItems").addEventListener("click",e=>{const b=e.target.closest("button[data-symbol]");if(b){$("symbolSelect").value=b.dataset.symbol;stopReplay();replayMode=false;drawings=[];loadCandles();}});
  $("settingsBtn").addEventListener("click",()=>{$("apiKeyInput").value=localStorage.getItem("mojimaro_td_key")||"";$("settingsDialog").showModal();});
  $("saveKeyBtn").addEventListener("click",()=>{const k=$("apiKeyInput").value.trim();if(k)localStorage.setItem("mojimaro_td_key",k);else localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();stopReplay();replayMode=false;loadCandles();});
  $("clearKeyBtn").addEventListener("click",()=>{$("apiKeyInput").value="";localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();stopReplay();replayMode=false;loadCandles();});
  $("buyBtn").addEventListener("click",()=>openDemoTrade("BUY"));$("sellBtn").addEventListener("click",()=>openDemoTrade("SELL"));
  $("openPositionsBody").addEventListener("click",e=>{const b=e.target.closest("[data-close]");if(b)closeDemoTrade(b.dataset.close,currentPrice(),"MANUAL");});
  $("resetAccountBtn").addEventListener("click",()=>{if(confirm("Reset the demo account to $1,000 and delete all demo trade history?")){account={startingBalance:1000,open:[],closed:[]};saveAccount();renderAccount();$("ticketMessage").textContent="Demo account reset to $1,000.";}});
}
function tickClock(){$("clock").textContent=new Date().toISOString().slice(11,19)+" UTC";}
initChart();setupEvents();setupReplay();setupDrawingTools();tickClock();setInterval(tickClock,1000);scheduleAutoRefresh();loadCandles();renderAccount();
