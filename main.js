/* Navigation: Show/hide modules */
function showTab(tabId) {
  var tabs = document.getElementsByClassName("tab");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove("active");
  }
  document.getElementById(tabId).classList.add("active");
}

/* Standard Normal CDF approximation */
function normCDF(x) {
  var sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  var t = 1 / (1 + 0.3275911 * x);
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  var a4 = -1.453152027, a5 = 1.061405429;
  var erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/* Black–Scholes formulas */
function blackScholesCall(S, K, sigma, r, T) {
  var d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  var d2 = d1 - sigma * Math.sqrt(T);
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}
function blackScholesPut(S, K, sigma, r, T) {
  var d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  var d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

/* Option Valuation Module Function */
function computeValuation() {
  // Black–Scholes inputs
  var optionType = document.getElementById("optionType").value;
  var S = parseFloat(document.getElementById("paramS").value);
  var K = parseFloat(document.getElementById("paramK").value);
  var sigma = parseFloat(document.getElementById("paramSigma").value);
  var r = parseFloat(document.getElementById("paramR").value);
  // Time to Maturity is input in days. Convert to years (using 252 trading days)
  var T_days = parseFloat(document.getElementById("paramT").value);
  var T = T_days / 252;
  
  // Additional market factors
  var regime = document.getElementById("marketRegime").value;
  var theta = parseFloat(document.getElementById("paramTheta").value);
  var delta = parseFloat(document.getElementById("paramDelta").value);
  var ATR = parseFloat(document.getElementById("paramATR").value);
  var OI = parseFloat(document.getElementById("paramOI").value);
  var marketOptionPrice = parseFloat(document.getElementById("marketOptionPrice").value);
  
  // Compute Black–Scholes Price (P)
  var bsPrice = (optionType === "call") ? blackScholesCall(S, K, sigma, r, T)
                                        : blackScholesPut(S, K, sigma, r, T);
  
  // Compute IV (Implied Volatility percentage)
  var IV = sigma * 100;
  
  // Custom adjustment (Q) calculation:
  // Q = (P × θ × e^(IV/100)) / [Δ × ATR × (P/S) × (OI+1) × ln(T_days+1)]
  var numerator = bsPrice * theta * Math.exp(IV / 100);
  var denominator = delta * ATR * (bsPrice / S) * (OI + 1) * Math.log(T_days + 1);
  var adjustment = (denominator !== 0) ? numerator / denominator : 0;
  
  // Option-type–dependent regime factor: market sentiment remains dominant.
  var regimeFactor = 1.0;
  if(optionType === "call"){
    if(regime === "Bear"){
      regimeFactor = 0.5;  // Heavy penalty for calls in Bear markets.
    } else if(regime === "Consolidating"){
      regimeFactor = 0.7;  // Moderate penalty in Consolidating markets.
    } else {  // Bull
      regimeFactor = 1.0;  // Neutral for Bull markets.
    }
  } else { // For puts
    if(regime === "Bull"){
      regimeFactor = 0.5;  // Heavy penalty for puts in Bull markets.
    } else if(regime === "Consolidating"){
      regimeFactor = 0.7;  // Moderate penalty.
    } else {
      regimeFactor = 1.0;  // Favorable for puts in Bear markets.
    }
  }
  
  // Apply regime factor to adjustment.
  adjustment *= regimeFactor;
  
  // Composite valuation: BS Price + adjustment.
  var compositeValuation = bsPrice + adjustment;
  
  // Trading Edge: difference between composite valuation and the market option price.
  var tradingEdge = compositeValuation - marketOptionPrice;
  
  // Compute additional factors for a multi-dimensional grade score:
  // 1. Trading Edge Ratio:
  var edgeRatio = marketOptionPrice !== 0 ? tradingEdge / marketOptionPrice : 0;
  
  // 2. Volatility Score: Baseline sigma is set to 0.2. Penalize if sigma exceeds baseline.
  var baselineSigma = 0.2;
  var volatilityScore = 1.0;
  if (sigma > baselineSigma) {
    volatilityScore = Math.max(0, 1 - ((sigma - baselineSigma) / baselineSigma));
  }
  
  // 3. Liquidity Score: Normalize OI using logarithm. Ideal OI is 1000.
  var liquidityScore = Math.log(OI + 1) / Math.log(1001);
  
  // Composite Grade Score with weights: 60% edgeRatio, 20% volatility, 20% liquidity.
  var compositeGradeScore = regimeFactor * (0.6 * edgeRatio + 0.2 * volatilityScore + 0.2 * liquidityScore);
  
  // Determine grade based on compositeGradeScore thresholds.
  var grade = "";
  var recommendation = "";
  if(compositeGradeScore >= 0.5) {
    grade = "AAA";
    recommendation = "This option is clearly undervalued. Consider a longer holding period with dual take-profit targets.";
  } else if(compositeGradeScore >= 0.3) {
    grade = "AA";
    recommendation = "Moderate edge detected. Recommended stop loss: 30% below entry, take profit: 15% above entry (1–3 day trade).";
  } else {
    grade = "A";
    var A_stopLoss = 0.10;     // 10% stop loss
    var A_takeProfit = 0.20;   // 20% take profit
    var A_holdingPeriod = "intraday/short-term";
    recommendation = "Low edge detected. Recommended stop loss: " + (A_stopLoss * 100).toFixed(0) +
                     "% below entry, take profit: " + (A_takeProfit * 100).toFixed(0) +
                     "% above entry (" + A_holdingPeriod + ").";
  }
  
  // Build output and highlight key results in yellow.
  var outputHTML = "<strong>Results:</strong><br>";
  outputHTML += "Black–Scholes Price: $" + bsPrice.toFixed(4) + "<br>";
  outputHTML += "Adjustment Factor (Q): $" + adjustment.toFixed(4) + "<br>";
  outputHTML += "Composite Valuation: $" + compositeValuation.toFixed(4) + "<br>";
  outputHTML += "Market Option Price: $" + marketOptionPrice.toFixed(4) + "<br>";
  outputHTML += "Trading Edge: $" + tradingEdge.toFixed(4) + " (" + (edgeRatio*100).toFixed(2) + "%)<br>";
  outputHTML += "Composite Grade Score: " + compositeGradeScore.toFixed(4) + "<br>";
  outputHTML += "Grade: " + grade + "<br>";
  outputHTML += "<em>Recommendation:</em> " + recommendation;
  
  document.getElementById("valuationOutput").innerHTML = 
    '<div style="background-color: yellow; color: black; padding: 10px; border-radius: 5px;">' + outputHTML + '</div>';
}

/* Simulation Lab Functions */

// Gaussian random number using Box-Muller transform
function gaussianRandom() {
  var u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Simulate Geometric Brownian Motion (GBM)
function simulateGBM(S0, mu, sigma, dt, steps) {
  var path = [S0];
  for (var i = 1; i <= steps; i++) {
    var prev = path[i-1];
    var rand = gaussianRandom();
    var change = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * rand;
    path.push(prev * Math.exp(change));
  }
  return path;
}

// Price Path Simulation (with horizontal lines for TP and SL)
var pricePathChart;
function simulatePricePath() {
  var S = parseFloat(document.getElementById("simS").value);
  var mu = parseFloat(document.getElementById("simMu").value);
  var sigma = parseFloat(document.getElementById("simSigma").value);
  var dt = parseFloat(document.getElementById("simDt").value);
  var steps = parseInt(document.getElementById("simSteps").value);
  var path = simulateGBM(S, mu, sigma, dt, steps);
  var K = parseFloat(document.getElementById("simK").value);
  var tp = K * (1 + parseFloat(document.getElementById("tpPercentSim").value) / 100);
  var sl = K * (1 - parseFloat(document.getElementById("slPercentSim").value) / 100);
  var secTP = K * (1 + parseFloat(document.getElementById("tpPercentSim").value) / 100) * (1 + parseFloat(document.getElementById("secTPPercentSim").value) / 100);
  
  // Create horizontal lines arrays
  var strikeLine = Array(path.length).fill(K);
  var primaryTPLine = Array(path.length).fill(tp);
  var stopLossLine = Array(path.length).fill(sl);
  var secondaryTPLine = Array(path.length).fill(secTP);
  
  var ctx = document.getElementById("pricePathChart").getContext("2d");
  if(pricePathChart) { pricePathChart.destroy(); }
  pricePathChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: path.map((p, i) => i),
      datasets: [
        {
          label: 'Simulated Price Path',
          data: path,
          borderColor: 'white',
          backgroundColor: 'rgba(255,255,255,0.1)',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Strike (' + K + ')',
          data: strikeLine,
          borderColor: 'orange',
          borderDash: [5,5],
          fill: false
        },
        {
          label: 'Primary TP (' + document.getElementById("tpPercentSim").value + '%)',
          data: primaryTPLine,
          borderColor: 'lightgreen',
          borderDash: [5,5],
          fill: false
        },
        {
          label: 'Stop-Loss (' + document.getElementById("slPercentSim").value + '%)',
          data: stopLossLine,
          borderColor: 'red',
          borderDash: [5,5],
          fill: false
        },
        {
          label: 'Secondary TP (' + document.getElementById("secTPPercentSim").value + '% extra)',
          data: secondaryTPLine,
          borderColor: 'darkgreen',
          borderDash: [5,5],
          fill: false
        }
      ]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Time Step" }, ticks: { color: "white" } },
        y: { title: { display: true, text: "Price" }, ticks: { color: "white" } }
      },
      plugins: {
        legend: { labels: { color: "white" } },
        title: { display: true, text: "Simulated Price Path", color: "white" }
      }
    }
  });
  document.getElementById("pricePathInfo").innerHTML = "Terminal Price: $" + path[path.length - 1].toFixed(2);
}

// Equity Curve Simulation
var equityCurveChart;
function simulateEquityCurve() {
  var numTrades = parseInt(document.getElementById("simNumSim").value);
  var S = parseFloat(document.getElementById("simS").value);
  var mu = parseFloat(document.getElementById("simMu").value);
  var sigma = parseFloat(document.getElementById("simSigma").value);
  var dt = parseFloat(document.getElementById("simDt").value);
  var steps = parseInt(document.getElementById("simSteps").value);
  var optionType = document.getElementById("simOptionType").value;
  var r = parseFloat(document.getElementById("simR").value);
  var T = parseFloat(document.getElementById("simT").value);
  var K = parseFloat(document.getElementById("simK").value);
  
  var bsPrice, cumSum = [], sum = 0;
  for (var i = 0; i < numTrades; i++) {
    var path = simulateGBM(S, mu, sigma, dt, steps);
    var payoff;
    if(optionType === "call") {
      bsPrice = blackScholesCall(S, K, sigma, r, T);
      payoff = Math.max(path[path.length - 1] - K, 0) * 100;
    } else {
      bsPrice = blackScholesPut(S, K, sigma, r, T);
      payoff = Math.max(K - path[path.length - 1], 0) * 100;
    }
    var pl = payoff - (bsPrice * 100);
    sum += pl;
    cumSum.push(sum);
  }
  var ctx = document.getElementById("equityCurveChart").getContext("2d");
  if(equityCurveChart) { equityCurveChart.destroy(); }
  equityCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: cumSum.map((v, i) => i+1),
      datasets: [{
        label: 'Equity Curve',
        data: cumSum,
        borderColor: 'green',
        backgroundColor: 'rgba(0,255,0,0.1)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Trade Number" }, ticks: { color: "white" } },
        y: { title: { display: true, text: "Cumulative P&L" }, ticks: { color: "white" } }
      },
      plugins: {
        legend: { labels: { color: "white" } },
        title: { display: true, text: "Equity Curve Simulation", color: "white" }
      }
    }
  });
}

// Strategy Equity Simulation (using TP/SL, Secondary TP, Extraction, and Initial Equity)
var strategyEquityChart;
function simulateStrategyEquity() {
  var numTrades = parseInt(document.getElementById("simNumSim").value);
  var K = parseFloat(document.getElementById("simK").value);
  var tpPercent = parseFloat(document.getElementById("tpPercentSim").value) / 100;
  var slPercent = parseFloat(document.getElementById("slPercentSim").value) / 100;
  var secTPPercent = parseFloat(document.getElementById("secTPPercentSim").value) / 100;
  var extractionPercent = parseFloat(document.getElementById("extractionPercentSim").value) / 100;
  var initialEquity = parseFloat(document.getElementById("initialEquitySim").value);
  
  var S = parseFloat(document.getElementById("simS").value);
  var mu = parseFloat(document.getElementById("simMu").value);
  var sigma = parseFloat(document.getElementById("simSigma").value);
  var dt = parseFloat(document.getElementById("simDt").value);
  var steps = parseInt(document.getElementById("simSteps").value);
  
  var equity = initialEquity;
  var equityCurve = [];
  var winCount = 0;
  
  for (var i = 0; i < numTrades; i++) {
    var price = K;
    var tradePL = null;
    var reachedTP = false;
    for (var j = 0; j < steps; j++) {
      var rand = gaussianRandom();
      var change = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * rand;
      price = price * Math.exp(change);
      // Check Stop-Loss
      if (price <= K * (1 - slPercent)) {
        tradePL = price - K;
        break;
      }
      // Primary TP check
      if (!reachedTP && price >= K * (1 + tpPercent)) {
        reachedTP = true;
      }
      if (reachedTP) {
        if (price >= K * (1 + tpPercent) * (1 + secTPPercent)) {
          tradePL = (K * (1 + tpPercent) * (1 + secTPPercent) - K) * extractionPercent;
          break;
        }
        if (price < K * (1 + tpPercent)) {
          tradePL = (K * (1 + tpPercent) - K) * extractionPercent;
          break;
        }
      }
    }
    if (tradePL === null) {
      tradePL = reachedTP ? (K * (1 + tpPercent) - K) * extractionPercent : price - K;
    }
    if (tradePL > 0) winCount++;
    equity += tradePL;
    equityCurve.push(equity);
  }
  
  var winRate = (winCount / numTrades) * 100;
  var ctx = document.getElementById("strategyEquityChart").getContext("2d");
  if (strategyEquityChart) { strategyEquityChart.destroy(); }
  strategyEquityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: equityCurve.map((v, i) => i+1),
      datasets: [{
        label: 'Strategy Equity',
        data: equityCurve,
        borderColor: 'cyan',
        backgroundColor: 'rgba(0,255,255,0.1)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Trade Number" }, ticks: { color: "white" } },
        y: { title: { display: true, text: "Cumulative Equity" }, ticks: { color: "white" } }
      },
      plugins: {
        legend: { labels: { color: "white" } },
        title: { display: true, text: "Strategy Equity Simulation", color: "white" }
      }
    }
  });
  document.getElementById("strategyMetrics").innerHTML = "<p>Win Rate: " + winRate.toFixed(2) + "%</p><p>Final Equity: $" + equity.toFixed(2) + "</p>";
}

// Trading Edge Simulation
function simulateTradeEdge() {
  var optionType = document.getElementById("simOptionType").value;
  var S = parseFloat(document.getElementById("simS").value);
  var K = parseFloat(document.getElementById("simK").value);
  var sigma = parseFloat(document.getElementById("simSigma").value);
  var r = parseFloat(document.getElementById("simR").value);
  var T = parseFloat(document.getElementById("simT").value);
  var marketOptionPrice = parseFloat(document.getElementById("marketOptionPrice").value);
  var bsPrice = (optionType === "call") ? blackScholesCall(S, K, sigma, r, T)
                                        : blackScholesPut(S, K, sigma, r, T);
  var tradeEdge = (optionType === "call") ? bsPrice - marketOptionPrice : marketOptionPrice - bsPrice;
  document.getElementById("tradeEdgeInfoSim").innerHTML = "Model Price: $" + bsPrice.toFixed(4) + "<br>Market Price: $" + marketOptionPrice.toFixed(4) + "<br>Trading Edge: $" + tradeEdge.toFixed(4);
}

/* Trading Calendar Functions */
var trades = [];
function addTrade(event) {
  event.preventDefault();
  var date = document.getElementById("tradeDate").value;
  var optionType = document.getElementById("tradeOptionType").value;
  var S = document.getElementById("tradeS").value;
  var K = document.getElementById("tradeK").value;
  var entry = document.getElementById("tradeEntry").value;
  var exit = document.getElementById("tradeExit").value;
  var profit = document.getElementById("tradeProfit").value;
  var comments = document.getElementById("tradeComments").value;
  
  var trade = {
    date: date,
    optionType: optionType,
    S: S,
    K: K,
    entry: entry,
    exit: exit,
    profit: profit,
    comments: comments
  };
  trades.push(trade);
  updateTradeTable();
  document.getElementById("tradeForm").reset();
}

function updateTradeTable() {
  var tbody = document.getElementById("tradeTable").getElementsByTagName("tbody")[0];
  tbody.innerHTML = "";
  trades.forEach(function(trade) {
    var row = document.createElement("tr");
    row.innerHTML = "<td>" + trade.date + "</td>" +
                    "<td>" + trade.optionType + "</td>" +
                    "<td>" + trade.S + "</td>" +
                    "<td>" + trade.K + "</td>" +
                    "<td>" + trade.entry + "</td>" +
                    "<td>" + trade.exit + "</td>" +
                    "<td>" + trade.profit + "</td>" +
                    "<td>" + trade.comments + "</td>";
    tbody.appendChild(row);
  });
}
