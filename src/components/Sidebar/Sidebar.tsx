import React from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import "./Sidebar.css";

interface SidebarProps {
    slides: string[];
    currentSlide: string;
    setCurrentSlide: React.Dispatch<React.SetStateAction<string>>;
    onAddSlide: () => void;
    thumbnails: { [key: string]: string };
    onReorderSlides: (newSlides: string[]) => void;
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
                                    key={`slide-${slideNum}-${index}`}
                                    draggableId={`slide-${slideNum}-${index}`}
                                    index={index}
                                >
                                    {(dragProvided, snapshot) => (
                                        <li
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            className={`slide-item ${slideNum === currentSlide && currentSlide !== "" ? "selected" : ""} ${snapshot.isDragging ? "dragging" : ""}`}
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
