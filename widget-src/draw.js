// Drawing helpers
function drawArrow(ctx, from, to) {
  const headLength = 16;
  const headWidth = 10;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  // Calculate the point where the line meets the arrowhead base
  const arrowBase = {
    x: to.x - headLength * Math.cos(angle),
    y: to.y - headLength * Math.sin(angle)
  };

  // Draw the line (stopping at arrowhead base for clean connection)
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(arrowBase.x, arrowBase.y);
  ctx.stroke();

  // Draw filled triangle arrowhead
  const perpAngle = angle + Math.PI / 2;
  const point1 = {
    x: arrowBase.x + headWidth * Math.cos(perpAngle),
    y: arrowBase.y + headWidth * Math.sin(perpAngle)
  };
  const point2 = {
    x: arrowBase.x - headWidth * Math.cos(perpAngle),
    y: arrowBase.y - headWidth * Math.sin(perpAngle)
  };

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(point1.x, point1.y);
  ctx.lineTo(point2.x, point2.y);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function drawAnnotation(ctx, ann) {
  if (ann.points.length < 2) return;
  if (ann.type === 'draw') {
    ctx.beginPath();
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    ann.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  } else if (ann.type === 'arrow') {
    drawArrow(ctx, ann.points[0], ann.points[ann.points.length - 1]);
  } else if (ann.type === 'rectangle') {
    const from = ann.points[0];
    const to = ann.points[ann.points.length - 1];
    ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
  }
}

function drawTextOnCanvas(ctx, ta) {
  const padding = 8;
  const lineHeight = 18;
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';

  // Use stored dimensions or calculate from text
  const boxWidth = ta.width || 120;
  const boxHeight = ta.height || 50;

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(ta.x, ta.y, boxWidth, boxHeight);

  // Border
  ctx.strokeStyle = ta.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(ta.x, ta.y, boxWidth, boxHeight);

  // Draw text with word wrap
  ctx.fillStyle = ta.color;
  const maxWidth = boxWidth - padding * 2;
  const lines = ta.text.split('\n');
  let y = ta.y + padding + 12;

  lines.forEach(line => {
    const words = line.split(' ');
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        ctx.fillText(currentLine, ta.x + padding, y);
        currentLine = word;
        y += lineHeight;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      ctx.fillText(currentLine, ta.x + padding, y);
      y += lineHeight;
    }
  });
}

function getCanvasPoint(e, canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export { drawAnnotation, drawTextOnCanvas, getCanvasPoint };
