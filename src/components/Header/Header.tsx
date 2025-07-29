import React from "react";
import "./Header.css";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
    variant: "main" | "history" | "workspace" | "login";
    title?: string;
    onLoginClick?: () => void;
    onRegisterClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ variant, title, onLoginClick, onRegisterClick }) => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleOAuthLogin = (provider: 'google' | 'github') => {
        window.location.href = `/api/auth/${provider}`;
    };

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

            {/* 인증 관련 버튼들 */}
            {variant === "workspace" && (
            <div className="auth-buttons">
                {isAuthenticated ? (
                    <div className="user-profile">
                        <img 
                            src={user?.profileImage || "/assets/default-avatar.png"} 
                            alt="Profile" 
                            className="profile-image"
                        />
                        <div className="profile-dropdown">
                            <span className="user-name">{user?.name}</span>
                            <button onClick={handleLogout} className="logout-btn">
                                로그아웃
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="login-buttons">
                        <button 
                            onClick={onLoginClick} 
                            className="login-btn"
                        >
                            로그인
                        </button>
                        <button 
                            onClick={onRegisterClick} 
                            className="register-btn"
                        >
                            회원가입
                        </button>
                    </div>
                )}
            </div>
            )}
        </header>
    );
};

export default Header;
