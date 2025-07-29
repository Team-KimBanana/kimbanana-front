import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Header from '../components/Header/Header';
import { Presentation } from '../types/types';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from '../components/LoginModal/LoginModal';
import RegisterModal from '../components/RegisterModal/RegisterModal';
import './Workspace.css';

const Workspace: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);

    

    useEffect(() => {
        // 5개만 보여주기
        const mockPresentations: Presentation[] = [
            {
                id: '1',
                title: '프로젝트 기획안',
                thumbnail: '/assets/thumbnails/presentation1.png',
                createdAt: '2024-01-15T10:30:00Z',
                updatedAt: '2024-01-20T14:20:00Z',
                userId: 'user1',
                isShared: true,
                shareUrl: 'https://kimbanana.com/share/1'
            },
            {
                id: '2',
                title: '팀 미팅 자료',
                thumbnail: '/assets/thumbnails/presentation2.png',
                createdAt: '2024-01-10T09:15:00Z',
                updatedAt: '2024-01-18T16:45:00Z',
                userId: 'user1',
                isShared: false
            },
            {
                id: '3',
                title: '제품 발표회',
                thumbnail: '/assets/thumbnails/presentation3.png',
                createdAt: '2024-01-05T11:00:00Z',
                updatedAt: '2024-01-12T13:30:00Z',
                userId: 'user1',
                isShared: true,
                shareUrl: 'https://kimbanana.com/share/3'
            },
            {
                id: '4',
                title: '마케팅 전략',
                thumbnail: '/assets/thumbnails/presentation4.png',
                createdAt: '2024-01-08T15:20:00Z',
                updatedAt: '2024-01-16T11:30:00Z',
                userId: 'user1',
                isShared: false
            },
            {
                id: '5',
                title: '분기별 실적 보고',
                thumbnail: '/assets/thumbnails/presentation5.png',
                createdAt: '2024-01-03T08:45:00Z',
                updatedAt: '2024-01-14T09:15:00Z',
                userId: 'user1',
                isShared: true,
                shareUrl: 'https://kimbanana.com/share/5'
            }
        ];
        setPresentations(mockPresentations);
        setIsLoading(false);
    }, []);


/* 로그인 로직 추가시 인증 구현
    const handleCreatePresentation = () => {
        if (!isAuthenticated) {
            setLoginModalOpen(true);
            return;
        }
        const newId = Date.now().toString();
        navigate(`/editor/${newId}`);
    };
*/

    const handleCreatePresentation = () => {
        const newId = Date.now().toString();
        navigate(`/editor/${newId}`);
    };
    

    const handlePresentationClick = (id: string) => {
        navigate(`/editor/${id}`);
    };

    const handleShare = (e: React.MouseEvent, presentation: Presentation) => {
        e.stopPropagation();
        if (presentation.shareUrl) {
            navigator.clipboard.writeText(presentation.shareUrl);
            alert('공유 링크가 클립보드에 복사되었습니다!');
        }
    };

    const handleMoreOptions = (e: React.MouseEvent, presentation: Presentation) => {
        e.stopPropagation();
        // 더보기 메뉴 구현
        console.log('더보기 메뉴:', presentation.id);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const openLoginModal = () => {
        setRegisterModalOpen(false);
        setLoginModalOpen(true);
    };

    const openRegisterModal = () => {
        setLoginModalOpen(false);
        setRegisterModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="workspace-loading">
                <div className="loading-spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    // 검색 필터링 (제목 기준)
    const filtered = presentations.filter(p => p.title.includes(search));

    return (
        <div className="workspace">
            <Header 
                variant="workspace" 
                onLoginClick={openLoginModal} 
                onRegisterClick={openRegisterModal} 
            />
            <div className="workspace-hero">
                <div className="hero-left">
                    <h2 className="hero-title">
                        슬라이드별 복원과 동시 편집으로,<br />
                        더 빠르고 효율적인 협업을 시작하세요
                    </h2>
                </div>
                <div className="hero-right">
                    <button className="create-presentation-btn" onClick={handleCreatePresentation}>
                        <Icon icon="material-symbols:add" width="24" />
                        프레젠테이션 시작하기
                    </button>
                </div>
            </div>
            <div className="workspace-footer-bg" >
            <div className="workspace-main">
                <div className="workspace-topbar">
                    <h2 className="workspace-main-title">Workspace</h2>
                    <div className="workspace-search">
                        <Icon icon="material-symbols:search" width="22" />
                        <input
                            type="text"
                            placeholder="워크스페이스 검색"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="presentations-row">
                    {filtered.map((presentation) => (
                        <div
                            key={presentation.id}
                            className="presentation-card"
                            onClick={() => handlePresentationClick(presentation.id)}
                        >
                            <div className="card-thumbnail">
                                <img
                                    src={presentation.thumbnail || '/assets/default-thumbnail.png'}
                                    alt={presentation.title}
                                    onError={e => {
                                        e.currentTarget.src = '/assets/default-thumbnail.png';
                                    }}
                                />
                                <div className="card-overlay">
                                    <div className="card-actions">
                                        {presentation.isShared && (
                                            <button
                                                className="action-btn share-btn"
                                                onClick={e => handleShare(e, presentation)}
                                                title="공유"
                                            >
                                                <Icon icon="material-symbols:share" width="20" />
                                            </button>
                                        )}
                                        <button
                                            className="action-btn more-btn"
                                            onClick={e => handleMoreOptions(e, presentation)}
                                            title="더보기"
                                        >
                                            <Icon icon="material-symbols:more-vert" width="20" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="card-content">
                                <h3 className="card-title">{presentation.title}</h3>
                                <p className="card-date">{formatDate(presentation.updatedAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            </div>
            {isLoginModalOpen && (
                <LoginModal 
                    onClose={() => setLoginModalOpen(false)} 
                    onSwitchToRegister={openRegisterModal} 
                />
            )}
            {isRegisterModalOpen && (
                <RegisterModal 
                    onClose={() => setRegisterModalOpen(false)} 
                    onSwitchToLogin={openLoginModal} 
                />
            )}
        </div>
    );
};

export default Workspace; 