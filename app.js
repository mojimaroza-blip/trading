const $ = (id) => document.getElementById(id);
const API_URL = "https://api.twelvedata.com/time_series";
let chart, candleSeries, candles = [], currentSymbol = "EUR/USD", currentInterval = "5min";
let fibLine, drawings = [], activeTool = "cursor", drawingStart = null, previewPoint = null, refreshTimer;
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
  const url=`${API_URL}?symbol=${encodeURIComponent(currentSymbol)}&interval=${currentInterval}&outputsize=250&timezone=UTC&apikey=${encodeURIComponent(key)}`;
  const res=await fetch(url); const data=await res.json();
  if(!res.ok||data.status==="error"||!data.values)throw new Error(data.message||data.code||"Market data request failed");
  const fresh=parseApiValues(data.values);
  if(!fresh.length)throw new Error("The provider returned no usable candles for this symbol.");
  candles=fresh;$("dataStatus").textContent="API DATA";return true;
}
function paintMarket(){
  if(!candles.length)return;
  candleSeries.setData(candles);
  const last=candles[candles.length-1],first=candles[0],change=((last.close-first.open)/first.open)*100;
  $("lastPrice").textContent=fmt(last.close);$("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"%";$("priceChange").className=change>=0?"positive":"negative";
  $("chartTimestamp").textContent="Last candle: "+new Date(last.time*1000).toLocaleString()+" · auto-refresh every 2 min";
  analyze();redrawDrawings();
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
function analyze(){
  if(candles.length<35)return;
  const d=candles,last=d[d.length-1],prior=d.slice(-31,-1);
  const recentHigh=Math.max(...prior.slice(-10).map(x=>x.high)),recentLow=Math.min(...prior.slice(-10).map(x=>x.low));
  const swingHigh=Math.max(...prior.map(x=>x.high)),swingLow=Math.min(...prior.map(x=>x.low));
  const bosBull=last.close>recentHigh,bosBear=last.close<recentLow;
  const sweepBull=last.low<recentLow&&last.close>recentLow,sweepBear=last.high>recentHigh&&last.close<recentHigh;
  const range=swingHigh-swingLow,fibBull=swingHigh-range*.82,fibBear=swingLow+range*.82,direction=smaDirection(d),price=last.close;
  const midpoint=(swingHigh+swingLow)/2,zone=price>midpoint?"PREMIUM":price<midpoint?"DISCOUNT":"EQUILIBRIUM";
  const bullish=direction==="BULLISH"||bosBull||sweepBull,bearish=direction==="BEARISH"||bosBear||sweepBear;
  let score=25;if(bosBull||bosBear)score+=25;if(sweepBull||sweepBear)score+=20;
  if((direction==="BULLISH"&&zone==="DISCOUNT")||(direction==="BEARISH"&&zone==="PREMIUM"))score+=15;
  if((direction==="BULLISH"&&price>=fibBull*.999&&price<=fibBull*1.001)||(direction==="BEARISH"&&price>=fibBear*.999&&price<=fibBear*1.001))score+=15;
  score=Math.min(100,score);const bias=bullish&&!bearish?"BULLISH":bearish&&!bullish?"BEARISH":direction;
  $("structureValue").textContent=direction;$("bosValue").textContent=bosBull?"BULLISH BOS":bosBear?"BEARISH BOS":"NOT CONFIRMED";
  $("sweepValue").textContent=sweepBull?"SELL-SIDE SWEEP":sweepBear?"BUY-SIDE SWEEP":"NOT DETECTED";$("zoneValue").textContent=zone;
  const fibLevel=bias==="BEARISH"?fibBear:fibBull;$("fibValue").textContent=fmt(fibLevel);
  $("scoreValue").textContent=score+"%";$("scoreBar").style.width=score+"%";$("scoreRing").style.background=`conic-gradient(${score>=75?"#16c784":"#4a9eff"} ${score*3.6}deg,#243347 0deg)`;
  $("biasText").textContent=bias+" BIAS";$("scoreMessage").textContent=score>=75?"Setup passes the minimum score filter.":"Below 75%: no trade setup is qualified.";
  $("signalPill").textContent=score>=75?bias+" SETUP":"WAIT";$("signalPill").className="pill"+(score>=75?"":" neutral");
  $("mtfCurrent").textContent=direction;$("mtf1").textContent=smaDirection(d.slice(-80));$("mtf4").textContent=smaDirection(d.slice(-150));
  $("mtfNote").textContent="Higher-timeframe readings are approximations from this chart's candles in this version.";
  const valid=score>=75&&(bias==="BULLISH"||bias==="BEARISH");$("tradeStatus").textContent=valid?"REVIEW SETUP":"NO QUALIFIED SETUP";$("tradeStatus").className="pill"+(valid?"":" neutral");
  if(valid){const entry=fibLevel,risk=Math.abs(entry-swingLow)*.35||range*.15,stop=bias==="BULLISH"?entry-risk:entry+risk,target=bias==="BULLISH"?entry+risk:entry-risk;
    $("entryLevel").textContent=fmt(entry);$("stopLevel").textContent=fmt(stop);$("targetLevel").textContent=fmt(target);$("rrLevel").textContent="1:1";
    $("tradeExplanation").textContent="Rule-based candidate only. Confirm the 0.82 retracement, structure, spread and risk manually.";
  }else{$("entryLevel").textContent="—";$("stopLevel").textContent="—";$("targetLevel").textContent="—";$("rrLevel").textContent="—";$("tradeExplanation").textContent="No trade is suggested. Wait for stronger alignment and confirm manually.";}
  drawFib(fibLevel);
}
function drawFib(level){if(fibLine)candleSeries.removePriceLine(fibLine);fibLine=candleSeries.createPriceLine({price:level,color:"#e5b85c",lineWidth:2,lineStyle:2,axisLabelVisible:true,title:"0.82"});}

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
  // A 2-minute interval is a cautious polling interval for limited free API plans.
  refreshTimer=setInterval(()=>{if(document.visibilityState==="visible"&&localStorage.getItem("mojimaro_td_key"))loadCandles(true);},120000);
}
function setupEvents(){
  $("refreshBtn").addEventListener("click",()=>loadCandles(true));
  $("symbolSelect").addEventListener("change",()=>{drawings=[];loadCandles();});
  $("intervalSelect").addEventListener("change",()=>{drawings=[];loadCandles();});
  $("watchItems").addEventListener("click",e=>{const b=e.target.closest("button[data-symbol]");if(b){$("symbolSelect").value=b.dataset.symbol;drawings=[];loadCandles();}});
  $("settingsBtn").addEventListener("click",()=>{$("apiKeyInput").value=localStorage.getItem("mojimaro_td_key")||"";$("settingsDialog").showModal();});
  $("saveKeyBtn").addEventListener("click",()=>{const k=$("apiKeyInput").value.trim();if(k)localStorage.setItem("mojimaro_td_key",k);else localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();loadCandles();});
  $("clearKeyBtn").addEventListener("click",()=>{$("apiKeyInput").value="";localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();loadCandles();});
}
function tickClock(){$("clock").textContent=new Date().toISOString().slice(11,19)+" UTC";}
initChart();setupEvents();setupDrawingTools();tickClock();setInterval(tickClock,1000);scheduleAutoRefresh();loadCandles();
