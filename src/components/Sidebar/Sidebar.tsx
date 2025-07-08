import React, { useState, useEffect } from "react";
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
    thumbnails: { [key: string]: string };
    variant: "main" | "history";
    onAddSlide?: () => void;
    onReorderSlides?: (newSlides: string[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
                                             slides,
                                             currentSlide,
                                             setCurrentSlide,
                                             thumbnails,
                                             variant,
                                             onAddSlide,
                                             onReorderSlides,
                                         }) => {
    const [selectAll, setSelectAll] = useState(false);
    const [selectedSlides, setSelectedSlides] = useState<string[]>([]);

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedSlides([]);
        } else {
            setSelectedSlides([...slides]);
        }
        setSelectAll(!selectAll);
    };

    const toggleSlideSelect = (slideNum: string) => {
        if (variant === "history") {
            if (selectedSlides.includes(slideNum)) {
                setSelectedSlides((prev) => prev.filter((s) => s !== slideNum));
            } else {
                setSelectedSlides((prev) => [...prev, slideNum]);
            }
        } else {
            setCurrentSlide(slideNum);
        }
    };

    useEffect(() => {
        if (selectAll) {
            setSelectedSlides([...slides]);
        }
    }, [slides, selectAll]);

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !onReorderSlides) return;

        const reordered = [...slides];
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        onReorderSlides(reordered);
    };

    return (
        <div className={`sidebar sidebar-${variant}`}>
            {variant === "history" && (
                <div className="sidebar-header">
                    <p className="sidebar-title">복원 슬라이드 선택</p>
                    <button
                        className={`select-all-btn ${selectAll ? "active" : ""}`}
                        onClick={toggleSelectAll}
                    >
                        {selectAll ? "선택 해제" : "모든 슬라이드 선택"}
                    </button>
                </div>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="slides-list" isDropDisabled={variant === "history"}>
                    {(provided) => (
                        <ul className="slides-list" ref={provided.innerRef} {...provided.droppableProps}>
                            {slides.map((slideNum, index) => {
                                const isSelected =
                                    variant === "main"
                                        ? slideNum === currentSlide
                                        : selectedSlides.includes(slideNum);

                                return (
                                    <Draggable
                                        key={`slide-${slideNum}-${index}`}
                                        draggableId={`slide-${slideNum}-${index}`}
                                        index={index}
                                        isDragDisabled={variant === "history"}
                                    >
                                        {(dragProvided, snapshot) => (
                                            <li
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                {...dragProvided.dragHandleProps}
                                                className={`slide-item ${
                                                    isSelected ? "selected" : ""
                                                } ${snapshot.isDragging ? "dragging" : ""}`}
                                                onClick={() => toggleSlideSelect(slideNum)}
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
                                );
                            })}
                            {provided.placeholder}

                            {slides.length === 0 && (
                                <li className="slide-placeholder">슬라이드를 추가해보세요</li>
                            )}
                        </ul>
                    )}
                </Droppable>
            </DragDropContext>

            {variant === "main" && onAddSlide && (
                <div onClick={onAddSlide}>
                    <div className="slide-thumbnail add-slide">+</div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
