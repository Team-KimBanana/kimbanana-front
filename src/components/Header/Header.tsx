import React from "react";
import "./Header.css";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

interface HeaderProps {
    variant: "main" | "history" | "workspace" | "login";
    title?: string;
}

const Header: React.FC<HeaderProps> = ({ variant, title }) => {
    const navigate = useNavigate();

    return (
        <header className={`header header-${variant}`}>
            {variant === "main" || variant === "workspace" ? (
                <div className="logo-container">
                    <img src="/assets/headerIcon/KimbananaLogo.svg" alt="KimBanana Logo" className="logo" />
                </div>
            ) : null}

            {variant === "history" && (
                <div className="history-header-left" onClick={() => navigate(-1)}>
                    <Icon icon="material-symbols:arrow-back-rounded" width="24" className="back-arrow" />
                    <h2 className="header-title">{title || "히스토리"}</h2>
                </div>
            )}

            {variant === "main" && (
                <input
                    type="text"
                    className="title-input"
                    placeholder="제목을 입력해주세요."
                    defaultValue={title}
                />
            )}

            {variant === "main" && (
                <div className="header-buttons btn">
                    <button className="header-btn history-btn" onClick={() => navigate("/history")}>
                        <img src="/assets/headerIcon/history.svg" alt="History" />
                    </button>
                    <button className="header-btn save-btn">
                        <img src="/assets/headerIcon/save.svg" alt="Save" />
                    </button>
                    <button className="header-btn share-btn">
                        <img src="/assets/headerIcon/share.svg" alt="Share" />
                    </button>
                    <button className="header-btn download-btn">
                        <img src="/assets/headerIcon/download.svg" alt="Download" />
                    </button>
                </div>
            )}
        </header>
    );
};

export default Header;
