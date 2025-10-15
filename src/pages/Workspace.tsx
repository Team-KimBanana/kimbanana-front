import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon} from '@iconify/react';
import Header from '../components/Header/Header';
import {Presentation, PresentationResponse, CreatePresentationRequest} from '../types/types';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from '../components/LoginModal/LoginModal';
import RegisterModal from '../components/RegisterModal/RegisterModal';
import ThumbnailRenderer from '../components/ThumbnailRenderer/ThumbnailRenderer';
import { demoPresentations } from '../data/demoData';
import './Workspace.css';

const BASE_URL = import.meta.env.VITE_BASE_URL || '';

const toAbsolute = (url?: string | null) => {
    if (!url) return '';
    
    // 절대 URL인 경우 API 프록시를 통해 로드
    if (/^https?:\/\//i.test(url)) {
        // daisy.wisoft.io 도메인인 경우 프록시로 변환
        if (url.includes('daisy.wisoft.io/kimbanana/app')) {
            const path = url.replace(/^https?:\/\/daisy\.wisoft\.io\/kimbanana\/app/, '');
            return import.meta.env.DEV ? `/api${path}` : url;
        }
        return url;
    }
    
    return `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};


const Workspace: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [thumbnailCache, setThumbnailCache] = useState<{ [key: string]: string }>({});
    const [demoThumbnails, setDemoThumbnails] = useState<{ [key: string]: string }>({});

    // 개발 환경에서는 프록시 사용, 운영 환경에서는 실제 URL 사용
    const API_BASE_URL = import.meta.env.DEV 
        ? '/api'  // 개발 환경: Vite 프록시 사용
        : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

    // 검색 필터링 (제목 기준)
    const filtered = presentations.filter(p => p.title.includes(search));

    // 페이지네이션 로직
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const currentItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);


    // 인증 헤더를 포함하여 썸네일 이미지 가져오기
    const fetchThumbnailWithAuth = async (thumbnailUrl: string): Promise<string> => {
        if (!thumbnailUrl) return '/kimbanana/ui/assets/default-thumbnail.png';
        
        // 이미 캐시에 있으면 반환
        if (thumbnailCache[thumbnailUrl]) {
            return thumbnailCache[thumbnailUrl];
        }
        
        try {
            const accessToken = localStorage.getItem('accessToken');
            const headers: Record<string, string> = {};
            
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }
            
            const response = await fetch(thumbnailUrl, {
                method: 'GET',
                headers,
            });
            
            if (!response.ok) {
                return '/assets/default-thumbnail.png';
            }
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // 캐시에 저장
            setThumbnailCache(prev => ({
                ...prev,
                [thumbnailUrl]: blobUrl
            }));
            
            return blobUrl;
        } catch (err) {
            return '/kimbanana/ui/assets/default-thumbnail.png';
        }
    };

    // API 함수들
    const fetchPresentations = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const requestData = {
                user_id: user?.id || ""
            };

            const headers: Record<string, string> = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            };

            // 로그인된 사용자의 경우 토큰 추가
            const accessToken = localStorage.getItem('accessToken');
            
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch(`${API_BASE_URL}/workspace/presentations/list`, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('접근 권한이 없습니다. 로그인해주세요.');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: PresentationResponse[] = await response.json();

            // API 응답을 기존 Presentation 타입으로 변환
            const mappedPresentations: Presentation[] = data.map((item) => ({
                id: item.presentation.presentation_id,
                title: item.presentation.presentation_title,
                thumbnail: toAbsolute(item.thumbnail_url),
                createdAt: item.presentation.last_revision_date,
                updatedAt: item.presentation.last_revision_date,
                userId: item.presentation.user_id,
                isShared: false,
                shareUrl: undefined,
            }));

            setPresentations(mappedPresentations);
            
            // 썸네일을 인증과 함께 다운로드
            mappedPresentations.forEach(async (presentation) => {
                const originalUrl = data.find(item => item.presentation.presentation_id === presentation.id)?.thumbnail_url;
                if (originalUrl && originalUrl.includes('daisy.wisoft.io')) {
                    const proxyUrl = originalUrl.replace(/^https?:\/\/daisy\.wisoft\.io\/kimbanana\/app/, '/api');
                    const blobUrl = await fetchThumbnailWithAuth(proxyUrl);
                    setPresentations(prev => prev.map(p => 
                        p.id === presentation.id ? { ...p, thumbnail: blobUrl } : p
                    ));
                }
            });
        } catch (err) {
            console.error('프레젠테이션 목록 조회 실패:', err);
            setError('프레젠테이션을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const createPresentation = async (): Promise<string | null> => {
        try {
            const requestData: CreatePresentationRequest = {
                user_id: user?.id || 'anonymous' // 로그인된 사용자 ID 또는 익명
            };

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'text/plain',
            };

            // 로그인된 사용자의 경우 토큰 추가
            const accessToken = localStorage.getItem('accessToken');

            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch(`${API_BASE_URL}/workspace/presentations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const presentationId: string = await response.text();

            return presentationId;
        } catch (err) {
            console.error('프레젠테이션 생성 실패:', err);
            setError('프레젠테이션 생성에 실패했습니다.');
            return null;
        }
    };

    const deletePresentation = async (presentationId: string): Promise<boolean> => {
        try {
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };

            // 로그인된 사용자의 경우 토큰 추가
            const accessToken = localStorage.getItem('accessToken');

            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch(`${API_BASE_URL}/workspace/presentations/${presentationId}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return true;
        } catch (err) {
            console.error('프레젠테이션 삭제 실패:', err);
            setError('프레젠테이션 삭제에 실패했습니다.');
            return false;
        }
    };

    useEffect(() => {
        // 로그인된 사용자만 API 호출
        if (isAuthenticated) {
            fetchPresentations();
        } else {
            // 비로그인 사용자는 로딩 상태 해제
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // 검색 시 첫 페이지로 리셋
    useEffect(() => {
        setCurrentPage(0);
    }, [search]);


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

    const handleCreatePresentation = async () => {
        try {
            const presentationId = await createPresentation();
            console.log('handleCreatePresentation' + presentationId);

            if (presentationId) {
                navigate(`/editor/${presentationId}`);
            }
        } catch (err) {
            console.error('프레젠테이션 생성 핸들러 오류:', err);
        }
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

    const handleMoreOptions = async (e: React.MouseEvent, presentation: Presentation) => {
        e.stopPropagation();
        const confirmDelete = window.confirm('이 프레젠테이션을 삭제하시겠습니까?');
        if (confirmDelete) {
            await handleDeletePresentation(presentation.id);
        }
    };

    const handleDeletePresentation = async (presentationId: string) => {
        try {
            const success = await deletePresentation(presentationId);
            if (success) {
                // 삭제 성공 시 목록에서 제거
                setPresentations(prev => prev.filter(p => p.id !== presentationId));
                alert('프레젠테이션이 삭제되었습니다.');
            }
        } catch (err) {
            console.error('프레젠테이션 삭제 핸들러 오류:', err);
        }
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

    const handleDemoThumbnailRendered = (slideId: string, dataUrl: string) => {
        setDemoThumbnails(prev => ({
            ...prev,
            [slideId]: dataUrl
        }));
    };

    if (isLoading) {
        return (
            <div className="workspace-loading">
                <div className="loading-spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="workspace">
                <Header
                    variant="workspace"
                    onLoginClick={openLoginModal}
                    onRegisterClick={openRegisterModal}
                />
                <div className="workspace-error">
                    <p>{error}</p>
                    <button onClick={fetchPresentations}>다시 시도</button>
                </div>
            </div>
        );
    }

    // 로그인하지 않은 사용자를 위한 페이지
    if (!isAuthenticated) {
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
                            슬라이드별 복원과 동시 편집으로,<br/>
                            더 빠르고 효율적인 협업을 시작하세요
                        </h2>
                        <p className="hero-subtitle">
                            로그인하고 나만의 프레젠테이션을 만들어보세요
                        </p>
                    </div>
                    <div className="hero-right">
                        <button className="create-presentation-btn" onClick={openLoginModal}>
                            <Icon icon="material-symbols:add" width="24"/>
                            로그인하고 시작하기
                        </button>
                    </div>
                </div>
                <div className="workspace-footer-bg">
                    <div className="workspace-main">
                        <div className="workspace-features">
                            <h2 className="features-title">KimBanana의 특별한 기능</h2>
                            <div className="features-grid">
                                <div className="feature-card">
                                    <div className="feature-icon">
                                        <Icon icon="material-symbols:history" width="48"/>
                                    </div>
                                    <h3 className="feature-title">슬라이드별 복원</h3>
                                    <p className="feature-description">
                                        각 슬라이드의 변경 이력을 개별적으로 관리하고, 
                                        원하는 시점으로 언제든 복원할 수 있습니다.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon">
                                        <Icon icon="material-symbols:group" width="48"/>
                                    </div>
                                    <h3 className="feature-title">실시간 협업</h3>
                                    <p className="feature-description">
                                        여러 사용자가 동시에 편집하며, 
                                        실시간으로 변경사항을 공유할 수 있습니다.
                                    </p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon">
                                        <Icon icon="material-symbols:draw" width="48"/>
                                    </div>
                                    <h3 className="feature-title">직관적인 편집</h3>
                                    <p className="feature-description">
                                        드래그 앤 드롭으로 쉽게 도형을 추가하고, 
                                        자유로운 그리기 도구로 아이디어를 표현하세요.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="demo-section">
                            <h2 className="demo-title">데모 프레젠테이션 살펴보기</h2>
                            <div className="demo-presentations">
                                <div className="demo-card" onClick={() => navigate('/editor/demo-1')}>
                                    <div className="demo-thumbnail">
                                        <img
                                            src={demoThumbnails['demo-1'] || '/kimbanana/ui/assets/default-thumbnail.png'}
                                            alt="비즈니스 기획서"
                                            onError={e => { e.currentTarget.src = '/kimbanana/ui/assets/default-thumbnail.png'; }}
                                        />
                                    </div>
                                    <div className="demo-content">
                                        <h3 className="demo-card-title">비즈니스 기획서</h3>
                                        <p className="demo-description">전문적인 비즈니스 프레젠테이션 템플릿</p>
                                        <span className="demo-badge">데모</span>
                                    </div>
                                </div>
                                <div className="demo-card" onClick={() => navigate('/editor/demo-2')}>
                                    <div className="demo-thumbnail">
                                        <img
                                            src={demoThumbnails['demo-2'] || '/kimbanana/ui/assets/default-thumbnail.png'}
                                            alt="교육 자료"
                                            onError={e => { e.currentTarget.src = '/kimbanana/ui/assets/default-thumbnail.png'; }}
                                        />
                                    </div>
                                    <div className="demo-content">
                                        <h3 className="demo-card-title">교육 자료</h3>
                                        <p className="demo-description">시각적이고 이해하기 쉬운 교육용 템플릿</p>
                                        <span className="demo-badge">데모</span>
                                    </div>
                                </div>
                                <div className="demo-card" onClick={() => navigate('/editor/demo-3')}>
                                    <div className="demo-thumbnail">
                                        <img
                                            src={demoThumbnails['demo-3'] || '/kimbanana/ui/assets/default-thumbnail.png'}
                                            alt="제품 소개"
                                            onError={e => { e.currentTarget.src = '/kimbanana/ui/assets/default-thumbnail.png'; }}
                                        />
                                    </div>
                                    <div className="demo-content">
                                        <h3 className="demo-card-title">제품 소개</h3>
                                        <p className="demo-description">매력적인 제품 프레젠테이션 템플릿</p>
                                        <span className="demo-badge">데모</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                                {Object.entries(demoPresentations).map(([demoId, demo]) => (
                                    <ThumbnailRenderer
                                        key={demoId}
                                        slideId={demoId}
                                        slideData={demo.slides[0].data}
                                        onRendered={handleDemoThumbnailRendered}
                                    />
                                ))}
                            </div>
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
    }

    // 로그인한 사용자를 위한 기존 페이지
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
                        슬라이드별 복원과 동시 편집으로,<br/>
                        더 빠르고 효율적인 협업을 시작하세요
                    </h2>
                </div>
                <div className="hero-right">
                    <button className="create-presentation-btn" onClick={handleCreatePresentation}>
                        <Icon icon="material-symbols:add" width="24"/>
                        프레젠테이션 시작하기
                    </button>
                </div>
            </div>
            <div className="workspace-footer-bg">
                <div className="workspace-main">
                    <div className="workspace-topbar">
                        <h2 className="workspace-main-title">Workspace</h2>
                        <div className="workspace-search">
                            <Icon icon="material-symbols:search" width="22"/>
                            <input
                                type="text"
                                placeholder="워크스페이스 검색"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="presentations-row">
                        {currentItems.map((presentation) => (
                            <div
                                key={presentation.id}
                                className="presentation-card"
                                onClick={() => handlePresentationClick(presentation.id)}
                            >
                                <div className="card-thumbnail">
                                    <img
                                        src={presentation.thumbnail || '/kimbanana/ui/assets/default-thumbnail.png'}
                                        alt={presentation.title}
                                        onError={e => {
                                            e.currentTarget.src = '/kimbanana/ui/assets/default-thumbnail.png';
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
                                                    <Icon icon="material-symbols:share" width="20"/>
                                                </button>
                                            )}
                                            <button
                                                className="action-btn more-btn"
                                                onClick={e => handleMoreOptions(e, presentation)}
                                                title="더보기"
                                            >
                                                <Icon icon="material-symbols:more-vert" width="20"/>
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

                    {/* 슬라이드 네비게이션 */}
                    {totalPages > 1 && (
                        <div className="slide-navigation">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                disabled={currentPage === 0}
                                className="nav-btn prev-btn"
                            >
                                <Icon icon="material-symbols:chevron-left" width="24"/>
                            </button>
                            <div className="slide-indicators">
                                {Array.from({length: totalPages}, (_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentPage(index)}
                                        className={`indicator ${index === currentPage ? 'active' : ''}`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                disabled={currentPage === totalPages - 1}
                                className="nav-btn next-btn"
                            >
                                <Icon icon="material-symbols:chevron-right" width="24"/>
                            </button>
                        </div>
                    )}
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