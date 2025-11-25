import React, { useMemo } from "react";
import "./Header.css";
import {Link, useNavigate, useParams} from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "../../contexts/AuthContext";
import { ActiveUsersResponse } from "../../types/types";

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
    onDownloadPdf?: () => Promise<void>;
    onShare?: () => Promise<void> | void;
    isGuest?: boolean;
    activeUsers?: ActiveUsersResponse | null;
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
                                           onDownloadPdf,
                                           onShare,
                                           isGuest = false,
                                           activeUsers,
                                       }) => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();

    const { id, presentationId: presentationIdParam } = useParams();
    const presentationId = presentationIdProp ?? presentationIdParam ?? id;

    const getGuestColor = useMemo(() => {
        const colorMap = new Map<string, string>();
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
            '#EC7063', '#5DADE2', '#F4D03F', '#AF7AC5', '#7FB3D3'
        ];
        
        return (guestId: string): string => {
            if (!colorMap.has(guestId)) {
                let hash = 0;
                for (let i = 0; i < guestId.length; i++) {
                    hash = guestId.charCodeAt(i) + ((hash << 5) - hash);
                }
                const index = Math.abs(hash) % colors.length;
                colorMap.set(guestId, colors[index]);
            }
            return colorMap.get(guestId)!;
        };
    }, []);

    const handleLogout = () => {
        if (window.confirm("로그아웃 하시겠습니까?")) {
            logout();
            navigate("/");
        }
    };

    const goHistory = () => {
        if (!presentationId) {
            alert("프레젠테이션 ID가 없어 히스토리로 이동할 수 없어요.");
            return;
        }
        navigate(`/history/${presentationId}`);
    };

    return (
        <header className={`header header-${variant}`}>
            {(variant === "main" || variant === "workspace") && (
                <Link
                    to="/"
                    replace
                    className="logo-container"
                    aria-label="홈으로"
                    onClick={(e) => {
                        if (isGuest) {
                            e.preventDefault();
                            alert("게스트는 워크스페이스에 접근할 수 없습니다.");
                        }
                    }}
                    style={{ cursor: isGuest ? "not-allowed" : "pointer" }}
                >
                    <img
                        src="/kimbanana/ui/assets/headerIcon/KimbananaLogo.svg"
                        alt="KimBanana Logo"
                        className="logo"
                        style={{ cursor: isGuest ? "not-allowed" : "pointer" }}
                    />
                </Link>
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
                                <img src="/kimbanana/ui/assets/headerIcon/restoreApply.svg" alt="restoreApply" />
                            </button>
                        )}
                    </div>
                </>
            )}

            {variant === "main" && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', margin: '0 20px' }}>
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
                        style={{ flex: 1, margin: 0 }}
                    />
                    {activeUsers && activeUsers.active_users.length > 0 && (
                        <div className="active-users-list">
                            {activeUsers.active_users.map((activeUser) => {
                                const isGuest = activeUser.user_type === 'GUEST';
                                const displayText = isGuest ? 'G' : (activeUser.name?.charAt(0).toUpperCase() || 'U');
                                const backgroundColor = isGuest ? getGuestColor(activeUser.id) : '#FFE44B';
                                
                                return (
                                    <div
                                        key={activeUser.id}
                                        className="active-user-avatar"
                                        style={{ backgroundColor }}
                                        title={activeUser.name}
                                    >
                                        {displayText}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {variant === "main" && (
                <div className="header-buttons btn">
                    <button
                        className="header-btn fullscreen-btn"
                        onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}
                        title={isFullscreen ? "전체화면 종료" : "전체화면"}
                    >
                        <img src="/kimbanana/ui/assets/headerIcon/fullscreen.svg" alt="fullscreen" />
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
                        <img src="/kimbanana/ui/assets/headerIcon/history.svg" alt="History" />
                    </button>

                    <button className="header-btn save-btn" onClick={onSaveHistory}>
                        <img src="/kimbanana/ui/assets/headerIcon/save.svg" alt="Save" />
                    </button>

                    <button
                        className="header-btn share-btn"
                        onClick={() => {
                            if (isGuest) {
                                alert("초대 링크는 정식 사용자만 발급 가능합니다.");
                                return;
                            }
                            onShare?.();
                        }}
                    >
                        <img src="/kimbanana/ui/assets/headerIcon/share.svg" alt="Share" />
                    </button>
                    <button className="header-btn download-btn" onClick={onDownloadPdf}>
                        <img src="/kimbanana/ui/assets/headerIcon/download.svg" alt="Download" />
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
