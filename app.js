const $ = (id) => document.getElementById(id);
const API_URL = "https://api.twelvedata.com/time_series";
let chart, candleSeries, candles = [], currentSymbol = "EUR/USD", currentInterval = "5min";
const intervals = {"1min":"M1","5min":"M5","15min":"M15","30min":"M30","1h":"H1","4h":"H4","1day":"D1"};
const samplePrices = {"EUR/USD":1.0842,"GBP/USD":1.271,"USD/JPY":149.2,"AUD/USD":0.654,"XAU/USD":2360,"SPX":5200,"NDX":18200,"DJI":39000};

function initChart(){
  const el = $("chart");
  chart = LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:"solid",color:"#0e1725"},textColor:"#8292a8"},grid:{vertLines:{color:"#172538"},horzLines:{color:"#172538"}},rightPriceScale:{borderColor:"#26364a"},timeScale:{borderColor:"#26364a",timeVisible:true,secondsVisible:false},crosshair:{mode:1}});
  candleSeries = chart.addCandlestickSeries({upColor:"#16c784",downColor:"#ea5b68",borderUpColor:"#16c784",borderDownColor:"#ea5b68",wickUpColor:"#16c784",wickDownColor:"#ea5b68"});
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:el.clientHeight})).observe(el);
}
function demoCandles(symbol, interval, count=180){
  const step = interval==="1day"?86400:interval==="4h"?14400:interval==="1h"?3600:interval==="30min"?1800:interval==="15min"?900:interval==="5min"?300:60;
  let price=samplePrices[symbol]||1.1, now=Math.floor(Date.now()/1000/step)*step, out=[];
  const scale = price>100?price*.0008:.00045;
  for(let i=count-1;i>=0;i--){
    const time=now-i*step, drift=(Math.random()-.49)*scale*2.2, open=price, close=Math.max(.00001,open+drift);
    const high=Math.max(open,close)+Math.random()*scale, low=Math.min(open,close)-Math.random()*scale;
    out.push({time,open,high,low,close}); price=close;
  }
  return out;
}
async function loadCandles(){
  currentSymbol=$("symbolSelect").value; currentInterval=$("intervalSelect").value;
  $("marketName").textContent=currentSymbol; $("marketClass").textContent=currentSymbol==="XAU/USD"?"METAL":["SPX","NDX","DJI"].includes(currentSymbol)?"INDEX":"FOREX";
  $("chartTitle").textContent=`${currentSymbol} · ${intervals[currentInterval]}`;
  const key=localStorage.getItem("mojimaro_td_key");
  if(key){
    $("dataStatus").textContent="CONNECTING";
    try{
      const url=`${API_URL}?symbol=${encodeURIComponent(currentSymbol)}&interval=${currentInterval}&outputsize=250&timezone=UTC&apikey=${encodeURIComponent(key)}`;
      const res=await fetch(url); const data=await res.json();
      if(!res.ok||data.status==="error"||!data.values) throw new Error(data.message||"Market data request failed");
      candles=data.values.slice().reverse().map(v=>({time:Math.floor(new Date(v.datetime.replace(" ","T")+"Z").getTime()/1000),open:+v.open,high:+v.high,low:+v.low,close:+v.close})).filter(v=>Number.isFinite(v.time)&&Number.isFinite(v.close));
      if(!candles.length) throw new Error("No candle data returned for this symbol.");
      $("dataStatus").textContent="API DATA";
    }catch(err){$("dataStatus").textContent="DEMO FALLBACK"; $("chartTimestamp").textContent=err.message+" · showing demo candles"; candles=demoCandles(currentSymbol,currentInterval);}
  }else{$("dataStatus").textContent="DEMO DATA";candles=demoCandles(currentSymbol,currentInterval);}
  candleSeries.setData(candles); chart.timeScale().fitContent();
  const last=candles[candles.length-1], first=candles[0], change=((last.close-first.open)/first.open)*100;
  $("lastPrice").textContent=fmt(last.close); $("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"%";
  $("priceChange").className=change>=0?"positive":"negative";
  $("chartTimestamp").textContent="Last candle: "+new Date(last.time*1000).toLocaleString();
  analyze();
}
function fmt(n){return Number(n).toLocaleString("en-US",{maximumFractionDigits:n>100?2:5,minimumFractionDigits:n>100?2:4});}
function smaDirection(data){
  if(data.length<30)return "NEUTRAL";
  const closes=data.map(x=>x.close), fast=closes.slice(-10).reduce((a,b)=>a+b,0)/10, slow=closes.slice(-30).reduce((a,b)=>a+b,0)/30;
  return fast>slow?"BULLISH":fast<slow?"BEARISH":"NEUTRAL";
}
function analyze(){
  if(candles.length<35)return;
  const d=candles, last=d[d.length-1], prior=d.slice(-31,-1);
  const recentHigh=Math.max(...prior.slice(-10).map(x=>x.high)), recentLow=Math.min(...prior.slice(-10).map(x=>x.low));
  const swingHigh=Math.max(...prior.map(x=>x.high)), swingLow=Math.min(...prior.map(x=>x.low));
  const bosBull=last.close>recentHigh, bosBear=last.close<recentLow;
  const sweepBull=last.low<recentLow&&last.close>recentLow, sweepBear=last.high>recentHigh&&last.close<recentHigh;
  const range=swingHigh-swingLow, fibBull=swingHigh-range*.82, fibBear=swingLow+range*.82;
  const direction=smaDirection(d), price=last.close;
  const midpoint=(swingHigh+swingLow)/2, zone=price>midpoint?"PREMIUM":price<midpoint?"DISCOUNT":"EQUILIBRIUM";
  const bullish=direction==="BULLISH"||bosBull||sweepBull, bearish=direction==="BEARISH"||bosBear||sweepBear;
  let score=25;
  if(bosBull||bosBear)score+=25;
  if(sweepBull||sweepBear)score+=20;
  if((direction==="BULLISH"&&zone==="DISCOUNT")||(direction==="BEARISH"&&zone==="PREMIUM"))score+=15;
  if((direction==="BULLISH"&&price>=fibBull*.999&&price<=fibBull*1.001)||(direction==="BEARISH"&&price>=fibBear*.999&&price<=fibBear*1.001))score+=15;
  score=Math.min(100,score);
  const bias=bullish&&!bearish?"BULLISH":bearish&&!bullish?"BEARISH":direction;
  $("structureValue").textContent=direction;
  $("bosValue").textContent=bosBull?"BULLISH BOS":bosBear?"BEARISH BOS":"NOT CONFIRMED";
  $("sweepValue").textContent=sweepBull?"SELL-SIDE SWEEP":sweepBear?"BUY-SIDE SWEEP":"NOT DETECTED";
  $("zoneValue").textContent=zone;
  const fibLevel=bias==="BEARISH"?fibBear:fibBull;
  $("fibValue").textContent=fmt(fibLevel);
  $("scoreValue").textContent=score+"%"; $("scoreBar").style.width=score+"%";
  $("scoreRing").style.background=`conic-gradient(${score>=75?"#16c784":"#4a9eff"} ${score*3.6}deg,#243347 0deg)`;
  $("biasText").textContent=bias+" BIAS";
  $("scoreMessage").textContent=score>=75?"Setup passes the minimum score filter.":"Below 75%: no trade setup is qualified.";
  $("signalPill").textContent=score>=75?bias+" SETUP":"WAIT"; $("signalPill").className="pill"+(score>=75?"":" neutral");
  $("mtfCurrent").textContent=direction;
  $("mtf1").textContent=smaDirection(d.slice(-80));
  $("mtf4").textContent=smaDirection(d.slice(-150));
  $("mtfNote").textContent="H1/H4 labels are approximations from the currently loaded candle series, not separate H1/H4 data feeds.";
  const valid=score>=75&&(bias==="BULLISH"||bias==="BEARISH");
  $("tradeStatus").textContent=valid?"REVIEW SETUP":"NO QUALIFIED SETUP";
  $("tradeStatus").className="pill"+(valid?"":" neutral");
  if(valid){
    const entry=fibLevel, risk=Math.abs(entry-swingLow)*.35||range*.15, stop=bias==="BULLISH"?entry-risk:entry+risk, target=bias==="BULLISH"?entry+risk:entry-risk;
    $("entryLevel").textContent=fmt(entry); $("stopLevel").textContent=fmt(stop); $("targetLevel").textContent=fmt(target); $("rrLevel").textContent="1:1";
    $("tradeExplanation").textContent="Rule-based candidate only. Verify the 0.82 retracement, structure, spread and risk before considering any trade.";
  }else{$("entryLevel").textContent="—";$("stopLevel").textContent="—";$("targetLevel").textContent="—";$("rrLevel").textContent="—";$("tradeExplanation").textContent="No trade is suggested. Wait for stronger alignment and confirm the setup manually.";}
  drawFib(fibLevel,swingHigh,swingLow);
}
let fibLine;
function drawFib(level, high, low){
  if(fibLine){candleSeries.removePriceLine(fibLine);}
  fibLine=candleSeries.createPriceLine({price:level,color:"#e5b85c",lineWidth:2,lineStyle:2,axisLabelVisible:true,title:"0.82"});
}
function setupEvents(){
  $("refreshBtn").addEventListener("click",loadCandles);
  $("symbolSelect").addEventListener("change",loadCandles);
  $("intervalSelect").addEventListener("change",loadCandles);
  $("watchItems").addEventListener("click",e=>{const b=e.target.closest("button[data-symbol]");if(b){$("symbolSelect").value=b.dataset.symbol;loadCandles();}});
  $("settingsBtn").addEventListener("click",()=>{$("apiKeyInput").value=localStorage.getItem("mojimaro_td_key")||"";$("settingsDialog").showModal();});
  $("saveKeyBtn").addEventListener("click",()=>{const k=$("apiKeyInput").value.trim();if(k)localStorage.setItem("mojimaro_td_key",k);else localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();loadCandles();});
  $("clearKeyBtn").addEventListener("click",()=>{$("apiKeyInput").value="";localStorage.removeItem("mojimaro_td_key");$("settingsDialog").close();loadCandles();});
}
function tickClock(){$("clock").textContent=new Date().toISOString().slice(11,19)+" UTC";}
initChart();setupEvents();tickClock();setInterval(tickClock,1000);loadCandles();
