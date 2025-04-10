import React from "react";
import "./Sidebar.css";

interface SidebarProps {
    slides: number[];
    currentSlide: number;
    setCurrentSlide: React.Dispatch<React.SetStateAction<number>>;
    onAddSlide: () => void;
    thumbnails: { [key: number]: string };
}

const Sidebar: React.FC<SidebarProps> = ({
                                             slides,
                                             currentSlide,
                                             setCurrentSlide,
                                             onAddSlide,
                                             thumbnails,
                                         }) => {
    return (
        <div className="sidebar">
            <ul>
                {slides.map((slideNum) => (
                    <li
                        key={slideNum}
                        className={`slide-item ${slideNum === currentSlide ? "selected" : ""}`}
                        onClick={() => setCurrentSlide(slideNum)}
                    >
                        <span className="slide-number">{slideNum}</span>
                        <div className="slide-thumbnail">
                            {thumbnails[slideNum] && (
                                <img
                                    src={thumbnails[slideNum]}
                                    alt={`Slide ${slideNum}`}
                                    className="slide-preview"
                                />
                            )}
                        </div>
                    </li>
                ))}
                <li onClick={onAddSlide}>
                    <div className="slide-thumbnail add-slide">+</div>
                </li>
            </ul>
        </div>
    );
};

export default Sidebar;
