// Minewdjhu, minimal canvas sparkline/line chart. No dependencies on
// purpose, the whole frontend is plain HTML/CSS/JS with no build step.
function drawMarketChart(canvas, points) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
  const cssHeight = canvas.clientHeight || 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!points || points.length < 2) {
    ctx.fillStyle = "#8b93a7";
    ctx.font = "13px 'Space Grotesk', sans-serif";
    ctx.fillText("Not enough price history yet.", 12, cssHeight / 2);
    return;
  }

  const prices = points.map((p) => p.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = 14;
  const range = max - min || 1;
  const up = prices[prices.length - 1] >= prices[0];
  const lineColor = up ? "#4ade80" : "#f87171";

  const xAt = (i) => pad + (i / (points.length - 1)) * (cssWidth - pad * 2);
  const yAt = (v) => cssHeight - pad - ((v - min) / range) * (cssHeight - pad * 2);

  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(prices[0]));
  prices.forEach((v, i) => ctx.lineTo(xAt(i), yAt(v)));
  ctx.lineTo(xAt(prices.length - 1), cssHeight - pad);
  ctx.lineTo(xAt(0), cssHeight - pad);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, cssHeight);
  grad.addColorStop(0, up ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  prices.forEach((v, i) => {
    const x = xAt(i), y = yAt(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#8b93a7";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.fillText(max.toFixed(2), 4, 12);
  ctx.fillText(min.toFixed(2), 4, cssHeight - 4);
}

async function loadMarketChart(canvas, symbol) {
  try {
    const data = await Api.get(`/api/markets/${symbol}/history`);
    drawMarketChart(canvas, data.points);
  } catch (e) {
    drawMarketChart(canvas, []);
  }
}
