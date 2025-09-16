import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { Image } from "react-konva";
import useImage from "use-image";
import { Shape } from "../../types/types";

interface CanvasImageProps {
    shape: Shape;
    onSelect: () => void;
    onDrag: (x: number, y: number) => void;
    onResize: (updated: Shape) => void;
    registerRef: (node: Konva.Image | null) => void;
    draggable?: boolean;
}

const CanvasImage: React.FC<CanvasImageProps> = ({ shape, onSelect, onDrag, onResize, registerRef, draggable = false }) => {
    const [image] = useImage(shape.imageSrc || "", "anonymous");
    const imageRef = useRef<Konva.Image | null>(null);

    useEffect(() => {
    }, [image]);

    return (
        <Image
            ref={(node) => {
                imageRef.current = node;
                registerRef(node);
            }}
            image={image}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            draggable={draggable}
            onClick={onSelect}
            onTransformEnd={() => {
                const node = imageRef.current;
                if (!node) return;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();
                const updated = {
                    ...shape,
                    x: node.x(),
                    y: node.y(),
                    width: node.width() * scaleX,
                    height: node.height() * scaleY,
                } as Shape;
                node.scaleX(1);
                node.scaleY(1);
                onResize(updated);
            }}
            onDragEnd={(e) => {
                const { x, y } = e.target.position();
                onDrag(x, y);
            }}
        />
    );
};

export default CanvasImage;



