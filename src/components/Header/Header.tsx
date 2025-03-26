import React from "react";
import "./Header.css";

const Header: React.FC = () => {
    return (
        <header className="header">
            <div className="logo-container">
                <img src="/assets/headerIcon/KimbananaLogo.svg" alt="KimBanana Logo" className="logo" />
            </div>

            <input type="text" className="title-input" placeholder="제목을 입력해주세요." />

            <div className="header-buttons btn">
                <button className="header-btn history-btn">
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
        </header>
    );
};

export default Header;
