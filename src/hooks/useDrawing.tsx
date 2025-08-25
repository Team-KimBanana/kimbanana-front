import { useRef } from "react";
import Konva from "konva";
import { Shape } from "../types/types";
import { KonvaEventObject } from "konva/lib/Node";
import Vector2d = Konva.Vector2d;

interface UseDrawingOptions {
  color?: string;
  width?: number;
  isEraser?: boolean;
  eraserSize?: number;
  eraserMode?: "size" | "area";
}

export default function useDrawing(
    layerRef: React.RefObject<Konva.Layer>,
    options: UseDrawingOptions = {},
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>
) {
  const {
    color = "black",
    width = 2,
    isEraser = false,
    eraserSize = 15,
    eraserMode = "size",
  } = options;

  const isDrawing = useRef(false);
  const eraserStartPos = useRef<{ x: number; y: number } | null>(null);
  const currentPoints = useRef<number[]>([]);


  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos: Vector2d | null = stage.getPointerPosition();
    if (!pos) return;

    if (isEraser) {
      eraserStartPos.current = pos;
    } else {
      currentPoints.current = [pos.x, pos.y];
    }
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos: Vector2d | null = stage.getPointerPosition();
    if (!pos) return;

    if (isEraser) {
      if (eraserMode === "size") {
        handleSizeEraser(pos);
      } else {
        handleAreaEraser(pos);
      }
    } else {
      currentPoints.current.push(pos.x, pos.y);
      drawTempLine();
    }
  };

  const onMouseUp = () => {
    isDrawing.current = false;

    if (!isEraser && currentPoints.current.length >= 4) {
      const newLine: Shape = {
        id: Date.now(),
        type: "line",
        x: 0,
        y: 0,
        points: [...currentPoints.current],
        color,
        strokeWidth: width,
      };
      setShapes(prev => [...prev, newLine]);
    }

    currentPoints.current = [];
    eraserStartPos.current = null;
    clearTempVisuals();
  };

  const drawTempLine = () => {
    const existing = layerRef.current?.findOne(".drawing-preview") as Konva.Line;
    if (existing) {
      existing.points(currentPoints.current);
    } else {
      const tempLine = new Konva.Line({
        name: "drawing-preview",
        points: currentPoints.current,
        stroke: color,
        strokeWidth: width,
        lineCap: "round",
        lineJoin: "round",
        dash: [10, 5],
      });
      layerRef.current?.add(tempLine);
    }

    layerRef.current?.batchDraw();
  };

  const clearTempVisuals = () => {
    const tempLine = layerRef.current?.findOne(".drawing-preview");
    if (tempLine) {
      tempLine.destroy();
      layerRef.current?.batchDraw();
    }

    const eraserShapes = ["eraser-circle", "eraser-rect"];
    eraserShapes.forEach((name) => {
      const shape = layerRef.current?.findOne(`.${name}`);
      shape?.destroy();
    });
  };

  const handleSizeEraser = (pos: { x: number; y: number }) => {
    const centerX = pos.x;
    const centerY = pos.y;
    const radius = eraserSize / 2;

    setShapes((prev) =>
        prev.filter((shape) => {
          if (shape.type !== "line" || !shape.points) return true;
          return !shape.points.some((_, i) =>
              i % 2 === 0
                  ? Math.hypot(shape.points![i] - centerX, shape.points![i + 1] - centerY) <= radius
                  : false
          );
        })
    );

    const circle = new Konva.Circle({
      x: centerX,
      y: centerY,
      radius,
      fill: "rgba(255,0,0,0.2)",
      stroke: "red",
      strokeWidth: 2,
      name: "eraser-circle",
    });
    layerRef.current?.add(circle);
    layerRef.current?.batchDraw();
  };

  const handleAreaEraser = (pos: { x: number; y: number }) => {
    if (!eraserStartPos.current) return;

    const start = eraserStartPos.current;
    const minX = Math.min(start.x, pos.x);
    const maxX = Math.max(start.x, pos.x);
    const minY = Math.min(start.y, pos.y);
    const maxY = Math.max(start.y, pos.y);

    setShapes((prev) =>
        prev.filter((shape) => {
          if (shape.type !== "line" || !shape.points) return true;
          return !shape.points.some((_, i) =>
              i % 2 === 0
                  ? shape.points![i] >= minX &&
                  shape.points![i] <= maxX &&
                  shape.points![i + 1] >= minY &&
                  shape.points![i + 1] <= maxY
                  : false
          );
        })
    );

    const rect = new Konva.Rect({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      fill: "rgba(255,0,0,0.3)",
      stroke: "red",
      strokeWidth: 2,
      name: "eraser-rect",
    });
    layerRef.current?.add(rect);
    layerRef.current?.batchDraw();
  };

  return { onMouseDown, onMouseMove, onMouseUp };
}