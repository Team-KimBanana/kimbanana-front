import React from "react";
import "./Header.css";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
    variant: "main" | "history" | "workspace" | "login";
    title?: string;
    onTitleChange?: (v: string) => void;
    onTitleSave?: (v: string) => void;
    onLoginClick?: () => void;
    onRegisterClick?: () => void;
    isFullscreen?: boolean;
    onEnterFullscreen?: () => void;
    onExitFullscreen?: () => void;
    onApplyRestore?: () => Promise<void> | void;
    presentationId?: string;
    onSaveHistory?: () => void | Promise<void | boolean>;
}

const Header: React.FC<HeaderProps> = ({
                                           variant,
                                           title,
                                           onTitleChange,
                                           onTitleSave,
                                           onLoginClick,
                                           onRegisterClick,
                                           isFullscreen = false,
                                           onEnterFullscreen,
                                           onExitFullscreen,
                                           onApplyRestore,
                                           presentationId: presentationIdProp,
                                           onSaveHistory,
                                       }) => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();

    const { id, presentationId: presentationIdParam } = useParams();
    const presentationId = presentationIdProp ?? presentationIdParam ?? id;

    const handleLogout = () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            logout();
            navigate("/");
        }
    };

    const handleOAuthLogin = (provider: "google" | "github") => {
        window.location.href = `/api/auth/${provider}`;
    };

    const goHistory = () => {
        if (!presentationId) {
            alert("프레젠테이션 ID가 없어 히스토리로 이동할 수 없어요.");
            return;
        }
        navigate(`/history/${presentationId}`);
    };

    const goEditor = () => {
        if (!presentationId) {
            alert("프레젠테이션 ID가 없어 에디터로 이동할 수 없어요.");
            return;
        }
        navigate(`/editor/${presentationId}`);
    };

    return (
        <header className={`header header-${variant}`}>
            {(variant === "main" || variant === "workspace") && (
                <div className="logo-container" onClick={() => navigate("/")}>
                    <img
                        src="/assets/headerIcon/KimbananaLogo.svg"
                        alt="KimBanana Logo"
                        className="logo"
                        style={{ cursor: "pointer" }}
                    />
                </div>
            )}

            {variant === "history" && (
                <>
                    <div className="history-header-left" onClick={() => navigate(-1)}>
                        <Icon icon="material-symbols:arrow-back-rounded" width="24" className="back-arrow" />
                    </div>
                    <div className="header-buttons history-btns">
                        {onApplyRestore && (
                            <button
                                className="header-btn restore-apply-btn"
                                onClick={async () => {
                                    if (!onApplyRestore) return;
                                    if (window.confirm("복원된 내용을 적용하시겠습니까?")) {
                                        await onApplyRestore();
                                    }
                                }}
                            >
                                <img src="/assets/headerIcon/restoreApply.svg" alt="restoreApply" />
                            </button>
                        )}
                    </div>
                </>
            )}

            {variant === "main" && (
                <input
                    type="text"
                    className="title-input"
                    placeholder="제목을 입력해주세요."
                    value={title ?? ""}
                    onChange={(e) => onTitleChange?.(e.target.value)}
                    onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) onTitleSave?.(val);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                />
            )}

            {variant === "main" && (
                <div className="header-buttons btn">
                    <button
                        className="header-btn fullscreen-btn"
                        onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}
                        title={isFullscreen ? "전체화면 종료" : "전체화면"}
                    >
                        <img src="/assets/headerIcon/fullscreen.svg" alt="fullscreen" />
                    </button>

                    <button
                        className="header-btn history-btn"
                        onClick={async () => {
                            try {
                                if (onSaveHistory) {
                                    await onSaveHistory();
                                }
                            } finally {
                                goHistory();
                            }
                        }}
                        title="히스토리"
                    >
                        <img src="/assets/headerIcon/history.svg" alt="History" />
                    </button>

                    <button className="header-btn save-btn" onClick={onSaveHistory}>
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

            {variant === "workspace" && (
                <div className="auth-buttons">
                    {isAuthenticated ? (
                        <div className="user-profile">
                            <div className="profile-avatar">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="profile-dropdown">
                                <span className="user-name">{user?.name}</span>
                                <button onClick={handleLogout} className="logout-btn">
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="login-buttons">
                            <button onClick={onLoginClick} className="login-btn">
                                로그인
                            </button>
                            <button onClick={onRegisterClick} className="register-btn">
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