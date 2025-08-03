import { useRef, useState } from "react";
import Konva from "konva";

interface UseDrawingOptions {
  color?: string;
  width?: number;
  isEraser?: boolean;
  eraserSize?: number;
  eraserMode?: "size" | "area";
}

export default function useDrawing(layerRef: React.RefObject<Konva.Layer>, options: UseDrawingOptions = {}) {
  const { color = "black", width = 2, isEraser = false, eraserSize = 15, eraserMode = "size" } = options;
  const isDrawing = useRef(false);
  const [lines, setLines] = useState<Konva.Line[]>([]);
  const eraserStartPos = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    
    if (isEraser) {
      eraserStartPos.current = pos;
    } else {
      const newLine = new Konva.Line({
        points: [pos.x, pos.y],
        stroke: color,
        strokeWidth: width,
        globalCompositeOperation: "source-over",
        lineCap: "round",
        lineJoin: "round",
        draggable: false,
      });
      layerRef.current?.add(newLine);
      setLines((prev) => [...prev, newLine]);
    }
  };

  const onMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const pos = e.target.getStage().getPointerPosition();
    
    if (isEraser) {
      if (eraserMode === "size") {
        handleSizeEraser(pos);
      } else {
        handleAreaEraser(pos);
      }
    } else {
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        lastLine.points([...lastLine.points(), pos.x, pos.y]);
        layerRef.current?.batchDraw();
      }
    }
  };

  const handleSizeEraser = (pos: { x: number; y: number }) => {
    const centerX = pos.x;
    const centerY = pos.y;
    const radius = eraserSize / 2;
    
    const shapesToRemove: Konva.Line[] = [];
    layerRef.current?.children.forEach((child) => {
      if (child instanceof Konva.Line && child !== layerRef.current?.findOne('Rect')) {
        const points = child.points();
        let isInEraserArea = false;
        
        for (let i = 0; i < points.length; i += 2) {
          const pointX = points[i];
          const pointY = points[i + 1];
          
          const distance = Math.sqrt(
            Math.pow(pointX - centerX, 2) + Math.pow(pointY - centerY, 2)
          );
          
          if (distance <= radius) {
            isInEraserArea = true;
            break;
          }
        }
        
        if (isInEraserArea) {
          shapesToRemove.push(child);
        }
      }
    });
    
    shapesToRemove.forEach((line) => {
      line.destroy();
    });
    
    setLines((prev) => prev.filter(line => !shapesToRemove.includes(line)));
    
    const eraserCircle = layerRef.current?.findOne('.eraser-circle');
    if (eraserCircle) {
      eraserCircle.destroy();
    }
    
    const circle = new Konva.Circle({
      x: centerX,
      y: centerY,
      radius: radius,
      fill: 'rgba(255, 0, 0, 0.2)',
      stroke: 'red',
      strokeWidth: 2,
      name: 'eraser-circle'
    });
    layerRef.current?.add(circle);
    
    layerRef.current?.batchDraw();
  };

  const handleAreaEraser = (pos: { x: number; y: number }) => {
    if (eraserStartPos.current) {
      const startPos = eraserStartPos.current;
      const endPos = pos;
      
      const minX = Math.min(startPos.x, endPos.x);
      const maxX = Math.max(startPos.x, endPos.x);
      const minY = Math.min(startPos.y, endPos.y);
      const maxY = Math.max(startPos.y, endPos.y);
      
      const shapesToRemove: Konva.Line[] = [];
      layerRef.current?.children.forEach((child) => {
        if (child instanceof Konva.Line && child !== layerRef.current?.findOne('Rect')) {
          const points = child.points();
          let isInEraserArea = false;
          
          for (let i = 0; i < points.length; i += 2) {
            const pointX = points[i];
            const pointY = points[i + 1];
            
            if (pointX >= minX && pointX <= maxX && pointY >= minY && pointY <= maxY) {
              isInEraserArea = true;
              break;
            }
          }
          
          if (isInEraserArea) {
            shapesToRemove.push(child);
          }
        }
      });
      
      shapesToRemove.forEach((line) => {
        line.destroy();
      });
      
      setLines((prev) => prev.filter(line => !shapesToRemove.includes(line)));
      
      const eraserRect = layerRef.current?.findOne('.eraser-rect');
      if (eraserRect) {
        eraserRect.destroy();
      }
      
      const rect = new Konva.Rect({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fill: 'rgba(255, 0, 0, 0.3)',
        stroke: 'red',
        strokeWidth: 2,
        name: 'eraser-rect'
      });
      layerRef.current?.add(rect);
      
      layerRef.current?.batchDraw();
    }
  };

  const onMouseUp = () => {
    isDrawing.current = false;
    eraserStartPos.current = null;
    
    const eraserCircle = layerRef.current?.findOne('.eraser-circle');
    const eraserRect = layerRef.current?.findOne('.eraser-rect');
    if (eraserCircle) {
      eraserCircle.destroy();
    }
    if (eraserRect) {
      eraserRect.destroy();
    }
    layerRef.current?.batchDraw();
  };

  return { onMouseDown, onMouseMove, onMouseUp, lines };
}