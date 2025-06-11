import React from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import "./Sidebar.css";

interface SidebarProps {
    slides: number[];
    currentSlide: number;
    setCurrentSlide: React.Dispatch<React.SetStateAction<number>>;
    onAddSlide: () => void;
    thumbnails: { [key: number]: string };
    onReorderSlides: (newSlides: number[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
                                             slides,
                                             currentSlide,
                                             setCurrentSlide,
                                             onAddSlide,
                                             thumbnails,
                                             onReorderSlides,
                                         }) => {
    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const reordered = [...slides];
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        onReorderSlides(reordered);
    };

    return (
        <div className="sidebar">
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="slides-list">
                    {(provided) => (
                        <ul
                            className="slides-list"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {slides.map((slideNum, index) => (
                                <Draggable
                                    key={slideNum}
                                    draggableId={slideNum.toString()}
                                    index={index}
                                >
                                    {(dragProvided, snapshot) => (
                                        <li
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            className={`slide-item ${slideNum === currentSlide ? "selected" : ""} ${snapshot.isDragging ? "dragging" : ""}`}
                                            onClick={() => setCurrentSlide(slideNum)}
                                        >
                                            <span className="slide-number">{index + 1}</span>

                                            <div className="slide-thumbnail">
                                                {thumbnails[slideNum] && (
                                                    <img
                                                        src={thumbnails[slideNum]}
                                                        alt={`Slide ${index + 1}`}
                                                        className="slide-preview"
                                                    />
                                                )}
                                            </div>
                                        </li>
                                    )}
                                </Draggable>
                            ))}

                            {provided.placeholder}

                            {slides.length === 0 && (
                                <li className="slide-placeholder">슬라이드를 추가해보세요</li>
                            )}
                        </ul>
                    )}
                </Droppable>
            </DragDropContext>

            <div onClick={onAddSlide}>
                <div className="slide-thumbnail add-slide">+</div>
            </div>
        </div>
    );
};

export default Sidebar;
