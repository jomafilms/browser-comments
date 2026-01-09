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
  width?: number;
  height?: number;
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
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<Color>('#EF4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>();
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [textBgOpacity, setTextBgOpacity] = useState<'transparent' | 'white'>('white');
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTextIndex, setSelectedTextIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);
  const [resizingTextIndex, setResizingTextIndex] = useState<number | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [justFinishedEditing, setJustFinishedEditing] = useState(false);

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
        // Text is rendered as HTML divs, not on canvas
        // Will be drawn on canvas only during screenshot
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
    // Ignore clicks if we just finished editing a text box
    if (justFinishedEditing) {
      setJustFinishedEditing(false);
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'text') {
      // Create text box immediately
      const newElement: DrawingElement = {
        type: 'text',
        color,
        start: { x, y },
        text: '',
        width: 200,
        height: 60,
      };
      const newElements = [...(elements || []), newElement];
      setElements(newElements);
      setEditingTextIndex(newElements.length - 1); // Start editing immediately
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

  const handleTextChange = (index: number, newText: string) => {
    if (!elements) return;
    const updatedElements = [...elements];
    updatedElements[index] = {
      ...updatedElements[index],
      text: newText,
    };
    setElements(updatedElements);
  };

  const handleDeleteText = (index: number) => {
    if (!elements) return;
    const updatedElements = elements.filter((_, i) => i !== index);
    setElements(updatedElements);
    setEditingTextIndex(null);
  };

  const handleTextDragStart = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const textElement = elements?.[index];
    if (textElement && textElement.start) {
      setSelectedTextIndex(index);
      setDragOffset({
        x: e.clientX - textElement.start.x,
        y: e.clientY - textElement.start.y,
      });
    }
  };

  const handleTextDrag = (e: MouseEvent) => {
    if (selectedTextIndex !== null && elements) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      const updatedElements = [...elements];
      updatedElements[selectedTextIndex] = {
        ...updatedElements[selectedTextIndex],
        start: { x: newX, y: newY },
      };
      setElements(updatedElements);
    }
  };

  const handleTextDragEnd = () => {
    setSelectedTextIndex(null);
  };

  // Add document-level event listeners for dragging
  useEffect(() => {
    if (selectedTextIndex !== null) {
      const handleMouseMove = (e: MouseEvent) => {
        handleTextDrag(e);
      };

      const handleMouseUp = () => {
        handleTextDragEnd();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [selectedTextIndex, dragOffset, elements]);

  const handleResizeStart = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const textElement = elements?.[index];
    if (textElement && textElement.start) {
      setResizingTextIndex(index);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: textElement.width || 200,
        height: textElement.height || 60,
      });
    }
  };

  const handleResize = (e: MouseEvent) => {
    if (resizingTextIndex !== null && elements) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(100, Math.min(1200, resizeStart.width + deltaX));
      const newHeight = Math.max(40, Math.min(800, resizeStart.height + deltaY));

      const updatedElements = [...elements];
      updatedElements[resizingTextIndex] = {
        ...updatedElements[resizingTextIndex],
        width: newWidth,
        height: newHeight,
      };
      setElements(updatedElements);
    }
  };

  const handleResizeEnd = () => {
    setResizingTextIndex(null);
  };

  // Add document-level event listeners for resizing
  useEffect(() => {
    if (resizingTextIndex !== null) {
      const handleMouseMove = (e: MouseEvent) => {
        handleResize(e);
      };

      const handleMouseUp = () => {
        handleResizeEnd();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingTextIndex, resizeStart, elements]);

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
    const iframe = iframeRef.current;
    if (!canvas || !iframe) return;

    setIsSaving(true);
    try {
      // Create combined canvas
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = canvas.width;
      combinedCanvas.height = canvas.height;
      const ctx = combinedCanvas.getContext('2d');
      if (!ctx) return;

      let capturedIframe = false;

      console.log('Starting screenshot capture...');

      // Try same-origin capture first (works if CORS headers are set)
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          console.log('Same-origin iframe detected, using html2canvas...');

          // Get iframe dimensions
          const iframeRect = iframe.getBoundingClientRect();

          // Use html2canvas to capture the iframe's current state
          const html2canvas = (await import('html2canvas')).default;
          const iframeCanvas = await html2canvas(iframeDoc.body, {
            width: iframeRect.width,
            height: iframeRect.height,
            windowWidth: iframeRect.width,
            windowHeight: iframeRect.height,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
          });

          // Draw iframe capture scaled to match canvas size
          ctx.drawImage(iframeCanvas, 0, 0, combinedCanvas.width, combinedCanvas.height);
          capturedIframe = true;
          console.log('Successfully captured same-origin iframe');
        }
      } catch (sameOriginError) {
        console.log('Same-origin capture failed (expected for cross-origin):', sameOriginError);
      }

      // If same-origin capture failed, use screen capture
      if (!capturedIframe) {
        console.log('Using screen capture for cross-origin iframe...');

        // Check if screen capture is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          console.error('Screen capture not available in this browser');
          throw new Error('Screen capture is not supported in this browser. Please try a different browser or ask the site owner to enable CORS headers.');
        }

        // Temporarily hide toolbar and spinner only (keep annotations visible for capture)
        setIsSaving(false);

        if (toolbarRef.current) {
          toolbarRef.current.style.display = 'none';
        }

        // Temporarily enable text backgrounds for capture
        const wasAnnotationsEnabled = annotationsEnabled;
        if (!annotationsEnabled) {
          setAnnotationsEnabled(true);
        }

        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log('Requesting screen share permission...');
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser',
          } as MediaTrackConstraints,
          audio: false,
          preferCurrentTab: true,
        } as any);
        console.log('Screen share granted, stream:', stream);

        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        // Wait for video to be ready
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve;
        });

        // Wait one more frame to ensure video is fully loaded
        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Get video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Calculate the iframe position relative to the viewport
        const iframeRect = iframe.getBoundingClientRect();

        // Calculate scale factor between video capture and actual screen
        const scaleX = videoWidth / window.innerWidth;
        const scaleY = videoHeight / window.innerHeight;

        // Draw the iframe area WITH annotations (they're already visible in the capture)
        ctx.drawImage(
          video,
          iframeRect.left * scaleX,
          iframeRect.top * scaleY,
          iframeRect.width * scaleX,
          iframeRect.height * scaleY,
          0,
          0,
          combinedCanvas.width,
          combinedCanvas.height
        );

        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
        console.log('Successfully captured via screen share');

        // Restore UI state
        if (toolbarRef.current) {
          toolbarRef.current.style.display = '';
        }
        setIsSaving(true);

        // Restore annotations state if it was disabled
        if (!wasAnnotationsEnabled) {
          setAnnotationsEnabled(false);
        }

        // Skip redrawing annotations since they're already in the screen capture
        capturedIframe = true; // Reuse this flag to skip annotation redraw
      }

      // Only draw annotations if NOT using screen capture (which already includes them)
      if (!capturedIframe) {
        // Draw canvas annotations on top (pen, arrow, rectangle, circle)
        ctx.drawImage(canvas, 0, 0);

        // Draw text annotations on top (since they're HTML divs, not on canvas)
        elements?.forEach(element => {
          if (element.type === 'text' && element.start && element.text) {
            ctx.font = '16px sans-serif';
            const padding = 4;

            // Draw background if enabled
            if (textBgOpacity === 'white') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillRect(
                element.start.x,
                element.start.y,
                element.width || 200,
                element.height || 60
              );
            }

            // Draw text with word wrapping
            ctx.fillStyle = element.color;
            const maxWidth = (element.width || 200) - padding * 2;
            const lineHeight = 20;
            const words = element.text.split(' ');
            let line = '';
            let y = element.start.y + lineHeight;

            for (let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, element.start.x + padding, y);
                line = words[n] + ' ';
                y += lineHeight;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, element.start.x + padding, y);
          }
        });
      }

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

      // Clear annotations after successful save
      setElements([]);
      setCurrentElement(null);
      redrawCanvas();
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
      <div ref={toolbarRef} className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white backdrop-blur-sm shadow-lg rounded-lg p-4 flex gap-4 items-center transition-all duration-200 opacity-30 hover:opacity-100">
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


      {/* Annotation Container */}
      <div id="annotation-container" className="relative w-full h-full">
        {/* Auth/blank page help banner */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
          <span>Page blank or showing login?</span>
          <span className="font-semibold">Use the embedded widget on the actual site for authenticated pages.</span>
        </div>

        {/* iframe */}
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          className="w-full h-full border-0"
          title="Web page to annotate"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        />

        {/* Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 ${annotationsEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ pointerEvents: !annotationsEnabled ? 'none' : 'auto' }}
        />

        {/* Draggable Text Annotations */}
        {elements?.map((element, index) => {
          if (element.type === 'text' && element.start) {
            const isEditing = editingTextIndex === index;
            return (
              <div
                key={index}
                className={`absolute group ${annotationsEnabled ? 'border-2 border-dashed border-blue-400 hover:border-blue-600' : 'border-none'}`}
                style={{
                  left: element.start.x,
                  top: element.start.y,
                  width: element.width || 200,
                  height: element.height || 60,
                  backgroundColor: annotationsEnabled && textBgOpacity === 'white' ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                  pointerEvents: annotationsEnabled ? 'auto' : 'none',
                  zIndex: 10,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (!isEditing) handleTextDragStart(index, e);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Delete button */}
                <button
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteText(index);
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  ×
                </button>

                {/* Resize handle */}
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-br cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleResizeStart(index, e);
                  }}
                  style={{ pointerEvents: 'auto', zIndex: 20 }}
                >
                  <div className="w-2 h-2 border-b-2 border-r-2 border-white"></div>
                </div>

                {/* Text content */}
                {isEditing ? (
                  <textarea
                    className="w-full h-full resize-none border-none outline-none bg-transparent p-1 overflow-auto"
                    style={{
                      color: element.color,
                      fontSize: '16px',
                      cursor: 'text',
                    }}
                    value={element.text || ''}
                    onChange={(e) => handleTextChange(index, e.target.value)}
                    onBlur={() => {
                      setEditingTextIndex(null);
                      setJustFinishedEditing(true);
                    }}
                    autoFocus
                    placeholder="Type here..."
                  />
                ) : (
                  <div
                    className="w-full h-full p-1 overflow-auto whitespace-pre-wrap break-words"
                    style={{
                      color: element.color,
                      fontSize: '16px',
                      cursor: 'move',
                    }}
                    onDoubleClick={() => setEditingTextIndex(index)}
                  >
                    {element.text || <span className="text-gray-400">Double click to type...</span>}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
