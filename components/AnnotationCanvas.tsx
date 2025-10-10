'use client';

import { useRef, useState, useEffect } from 'react';

export type Tool = 'pen' | 'arrow' | 'rectangle' | 'circle' | 'text';
export type Color = '#EF4444' | '#3B82F6' | '#F59E0B' | '#000000'; // red, blue, yellow, black

export interface DrawingElement {
  type: Tool;
  color: Color;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

interface AnnotationCanvasProps {
  onSave: (imageData: string, textAnnotations: TextAnnotation[]) => void;
  onNewComment?: () => void;
  onViewComments: () => void;
  iframeUrl: string;
}

export default function AnnotationCanvas({ onSave, onNewComment, onViewComments, iframeUrl }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<Color>('#EF4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>();
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [textBgOpacity, setTextBgOpacity] = useState<'transparent' | 'white'>('white');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements?.forEach(element => drawElement(ctx, element));

    // Draw current element if drawing
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'pen':
        if (element.points && element.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          element.points.forEach(point => ctx.lineTo(point.x, point.y));
          ctx.stroke();
        }
        break;

      case 'arrow':
        if (element.start && element.end) {
          drawArrow(ctx, element.start, element.end);
        }
        break;

      case 'rectangle':
        if (element.start && element.end) {
          const width = element.end.x - element.start.x;
          const height = element.end.y - element.start.y;
          ctx.strokeRect(element.start.x, element.start.y, width, height);
        }
        break;

      case 'circle':
        if (element.start && element.end) {
          const radius = Math.sqrt(
            Math.pow(element.end.x - element.start.x, 2) +
            Math.pow(element.end.y - element.start.y, 2)
          );
          ctx.beginPath();
          ctx.arc(element.start.x, element.start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;

      case 'text':
        if (element.start && element.text) {
          // Draw text background
          ctx.font = '16px sans-serif';
          const textMetrics = ctx.measureText(element.text);
          const textHeight = 20;
          const padding = 4;

          if (textBgOpacity === 'white') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(
              element.start.x - padding,
              element.start.y - textHeight + padding,
              textMetrics.width + padding * 2,
              textHeight + padding
            );
          }

          // Draw text
          ctx.fillStyle = element.color;
          ctx.fillText(element.text, element.start.x, element.start.y);
        }
        break;
    }
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'text') {
      setShowTextInput(true);
      setTextInputPos({ x, y });
      return;
    }

    setIsDrawing(true);

    const newElement: DrawingElement = {
      type: tool,
      color,
      ...(tool === 'pen' ? { points: [{ x, y }] } : { start: { x, y } }),
    };

    setCurrentElement(newElement);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pen' && currentElement.points) {
      setCurrentElement({
        ...currentElement,
        points: [...currentElement.points, { x, y }],
      });
    } else {
      setCurrentElement({
        ...currentElement,
        end: { x, y },
      });
    }

    redrawCanvas();
  };

  const handleMouseUp = () => {
    if (currentElement) {
      setElements([...(elements || []), currentElement]);
      setCurrentElement(null);
    }
    setIsDrawing(false);
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      const newElement: DrawingElement = {
        type: 'text',
        color,
        start: textInputPos,
        text: textValue,
      };
      setElements([...(elements || []), newElement]);
      redrawCanvas();
    }
    setTextValue('');
    setShowTextInput(false);
  };

  const handleUndo = () => {
    if (elements && elements.length > 0) {
      setElements(elements.slice(0, -1));
      redrawCanvas();
    }
  };

  const handleClearCanvas = () => {
    setElements([]);
    setCurrentElement(null);
    redrawCanvas();
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    try {
      // Use Puppeteer on the server to capture the webpage (bypasses CORS completely)
      const response = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: iframeUrl,
          width: canvas.width,
          height: canvas.height,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to capture screenshot');
      }

      const { image } = await response.json();

      // Create combined canvas
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = canvas.width;
      combinedCanvas.height = canvas.height;
      const ctx = combinedCanvas.getContext('2d');
      if (!ctx) return;

      // Load the screenshot and draw it
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = image;
      });

      ctx.drawImage(img, 0, 0, combinedCanvas.width, combinedCanvas.height);

      // Draw annotations on top
      ctx.drawImage(canvas, 0, 0);

      const imageData = combinedCanvas.toDataURL('image/png');

      // Extract text annotations
      const textAnnotations: TextAnnotation[] = (elements || [])
        .filter(el => el.type === 'text' && el.text)
        .map(el => ({
          text: el.text!,
          x: el.start!.x,
          y: el.start!.y,
          color: el.color,
        }));

      onSave(imageData, textAnnotations);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to capture screenshot: ${errorMessage}\n\nPlease try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [elements, currentElement, textBgOpacity]);

  return (
    <div className="relative w-full h-screen">
      {/* Loading Spinner */}
      {isSaving && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold">Capturing screenshot...</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white backdrop-blur-sm shadow-lg rounded-lg p-4 flex gap-4 items-center transition-all duration-200 opacity-30 hover:opacity-100">
        {/* Tool Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`px-3 py-2 rounded ${tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Pen
          </button>
          <button
            onClick={() => setTool('arrow')}
            className={`px-3 py-2 rounded ${tool === 'arrow' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Arrow
          </button>
          <button
            onClick={() => setTool('rectangle')}
            className={`px-3 py-2 rounded ${tool === 'rectangle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Rectangle
          </button>
          <button
            onClick={() => setTool('circle')}
            className={`px-3 py-2 rounded ${tool === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Circle
          </button>
          <button
            onClick={() => setTool('text')}
            className={`px-3 py-2 rounded ${tool === 'text' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Text
          </button>
        </div>

        {/* Color Picker */}
        <div className="flex gap-2 border-l pl-4">
          <button
            onClick={() => setColor('#EF4444')}
            className={`w-8 h-8 rounded-full bg-red-500 ${color === '#EF4444' ? 'ring-2 ring-black' : ''}`}
          />
          <button
            onClick={() => setColor('#3B82F6')}
            className={`w-8 h-8 rounded-full bg-blue-500 ${color === '#3B82F6' ? 'ring-2 ring-black' : ''}`}
          />
          <button
            onClick={() => setColor('#F59E0B')}
            className={`w-8 h-8 rounded-full bg-yellow-500 ${color === '#F59E0B' ? 'ring-2 ring-black' : ''}`}
          />
          <button
            onClick={() => setColor('#000000')}
            className={`w-8 h-8 rounded-full bg-black ${color === '#000000' ? 'ring-2 ring-gray-400' : ''}`}
          />
        </div>

        {/* Text Background Toggle */}
        <button
          onClick={() => setTextBgOpacity(textBgOpacity === 'white' ? 'transparent' : 'white')}
          className="px-3 py-2 rounded border-l pl-4 flex items-center gap-2"
          title={`Text background: ${textBgOpacity === 'white' ? 'White' : 'Transparent'}`}
        >
          <span className="text-xs">BG:</span>
          <div className="relative w-6 h-6 border border-gray-400 bg-white rounded">
            {textBgOpacity === 'transparent' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-0.5 bg-red-500 rotate-45"></div>
              </div>
            )}
          </div>
        </button>

        {/* Annotation Toggle */}
        <button
          onClick={() => setAnnotationsEnabled(!annotationsEnabled)}
          className={`px-3 py-2 rounded text-sm ${annotationsEnabled ? 'bg-green-500 text-white' : 'bg-gray-300'}`}
          title={annotationsEnabled ? 'Annotations enabled - click to disable' : 'Annotations disabled - click to enable'}
        >
          {annotationsEnabled ? '✏️ ON' : '✏️ OFF'}
        </button>

        {/* Actions */}
        <div className="flex gap-2 border-l pl-4">
          <button onClick={handleUndo} className="px-3 py-2 bg-gray-200 rounded">
            Undo
          </button>
          <button onClick={handleClearCanvas} className="px-3 py-2 bg-yellow-500 text-white rounded font-semibold">
            Clear
          </button>
          <button onClick={handleSave} className="px-3 py-2 bg-green-500 text-white rounded font-semibold">
            Save
          </button>
          <button onClick={onViewComments} className="px-3 py-2 bg-purple-500 text-white rounded font-semibold">
            View All
          </button>
        </div>
      </div>

      {/* Text Input Modal */}
      {showTextInput && (
        <div
          className="absolute z-50 bg-white p-4 rounded shadow-lg"
          style={{ left: textInputPos.x, top: textInputPos.y }}
        >
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            className="border p-2 rounded"
            placeholder="Enter text..."
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleTextSubmit} className="px-3 py-1 bg-blue-500 text-white rounded">
              Add
            </button>
            <button
              onClick={() => {
                setShowTextInput(false);
                setTextValue('');
              }}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Annotation Container */}
      <div id="annotation-container" className="relative w-full h-full">
        {/* iframe */}
        <iframe
          ref={iframeRef}
          src={`/api/proxy?url=${encodeURIComponent(iframeUrl)}`}
          className="w-full h-full border-0"
          title="Web page to annotate"
          sandbox="allow-scripts allow-same-origin"
        />

        {/* Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 ${annotationsEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ pointerEvents: showTextInput || !annotationsEnabled ? 'none' : 'auto' }}
        />
      </div>
    </div>
  );
}
