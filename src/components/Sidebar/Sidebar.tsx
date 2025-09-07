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
    variant: "main" | "history" | "current" | "restore";
    onAddSlide?: () => void;
    onReorderSlides?: (newSlides: string[]) => void;
    selectedSlides?: string[];
    setSelectedSlides?: React.Dispatch<React.SetStateAction<string[]>>;
    onRestoreSelected?: () => void;
    isRestoreEnabled?: boolean;
    onRestoreAll?: () => void;
    isRestoreAllEnabled?: boolean;
    setSelectedCurrentSlide?: (id: string) => void;
    setSelectedRestoreSlide?: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
                                             slides,
                                             currentSlide,
                                             setCurrentSlide,
                                             thumbnails,
                                             variant,
                                             onAddSlide,
                                             onReorderSlides,
                                             selectedSlides = [],
                                             setSelectedSlides,
                                             onRestoreSelected,
                                             isRestoreEnabled,
                                             onRestoreAll,
                                             isRestoreAllEnabled,
                                             setSelectedCurrentSlide,
                                             setSelectedRestoreSlide,
                                         }) => {
    const toggleSlideSelect = (slideId: string) => {
        if (variant === "restore") {
            if (setSelectedSlides) setSelectedSlides([slideId]);
            if (setSelectedRestoreSlide) setSelectedRestoreSlide(slideId);
        } else if (variant === "current") {
            setCurrentSlide(slideId);
            if (setSelectedSlides) setSelectedSlides([slideId]);
            if (setSelectedCurrentSlide) setSelectedCurrentSlide(slideId);
        } else {
            setCurrentSlide(slideId);
        }
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !onReorderSlides) return;

        const reordered = [...slides];
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        onReorderSlides(reordered);
    };

    return (
        <div className={`sidebar sidebar-${variant}`}>
            {(variant === "current" || variant === "restore") && (
                <p className="sidebar-title">
                    {variant === "current" ? "현재 슬라이드" : "복원 슬라이드 선택"}
                </p>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable
                    droppableId="slides-list"
                    isDropDisabled={variant !== "main"}
                >
                    {(provided) => (
                        <div className="slides-scrollable">
                            <ul
                                className="slides-list"
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {slides.map((slideId, index) => {
                                    const isSelected =
                                        variant === "main"
                                            ? slideId === currentSlide
                                            : selectedSlides.includes(slideId);

                                    return (
                                        <Draggable
                                            key={`slide-${slideId}`}
                                            draggableId={`slide-${slideId}`}
                                            index={index}
                                            isDragDisabled={variant !== "main"}
                                        >
                                            {(dragProvided, snapshot) => (
                                                <li
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    {...dragProvided.dragHandleProps}
                                                    className={`slide-item ${isSelected ? "selected" : ""} ${
                                                        snapshot.isDragging ? "dragging" : ""
                                                    }`}
                                                    onClick={() => toggleSlideSelect(slideId)}
                                                >
                                                    <span className="slide-number">{index + 1}</span>
                                                    <div className="slide-thumbnail">
                                                        {thumbnails[slideId] && (
                                                            <img
                                                                src={thumbnails[slideId]}
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

                                {variant === "main" && onAddSlide && (
                                    <li className="slide-item" onClick={onAddSlide}>
                                        <div className="slide-thumbnail add-slide">+</div>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            {variant === "restore" && (
                <div className="sidebar-footer">
                    <div
                        className="restore-text"
                        onClick={isRestoreEnabled ? onRestoreSelected : undefined}
                        style={{
                            color: isRestoreEnabled ? "#FFB93E" : "#aaa",
                            cursor: isRestoreEnabled ? "pointer" : "default",
                        }}
                    >
                        선택한 슬라이드 복원
                    </div>
                    <div
                        className={`restore-text ${isRestoreAllEnabled ? "active" : "disabled"}`}
                        onClick={isRestoreAllEnabled ? onRestoreAll : undefined}
                    >
                        전체 슬라이드 복원
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
