import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Icon} from '@iconify/react';
import Header from '../components/Header/Header';
import {Presentation, PresentationResponse, CreatePresentationRequest} from '../types/types';
// import { useAuth } from '../contexts/AuthContext';
import LoginModal from '../components/LoginModal/LoginModal';
import RegisterModal from '../components/RegisterModal/RegisterModal';
import './Workspace.css';

const BASE_URL = import.meta.env.VITE_BASE_URL || '';

const toAbsolute = (url?: string | null) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};


const Workspace: React.FC = () => {
    const navigate = useNavigate();
    // const { isAuthenticated } = useAuth();
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

    // 검색 필터링 (제목 기준)
    const filtered = presentations.filter(p => p.title.includes(search));

    // 페이지네이션 로직
    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const currentItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);


    // API 함수들
    const fetchPresentations = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/workspace/presentations`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: PresentationResponse[] = await response.json();

            // API 응답을 기존 Presentation 타입으로 변환
            const mappedPresentations: Presentation[] = data.map((item) => ({
                id: item.presentation.presentation_id,
                title: item.presentation.presentation_title,
                thumbnail: toAbsolute(item.thumbnail_url),
                createdAt: item.presentation.last_revision_date, // 임시로 last_revision_date 사용
                updatedAt: item.presentation.last_revision_date,
                userId: item.presentation.user_id,
                isShared: false, // API에서 제공하지 않으므로 기본값
                shareUrl: undefined, // API에서 제공하지 않으므로 기본값
            }));

            setPresentations(mappedPresentations);
        } catch (err) {
            console.error('프레젠테이션 목록 조회 실패:', err);
            setError('프레젠테이션을 불러오는데 실패했습니다.');

            // 에러 시 목 데이터 사용 (개발용)
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
                }
            ];
            setPresentations(mockPresentations);
        } finally {
            setIsLoading(false);
        }
    };

    const createPresentation = async (): Promise<string | null> => {
        try {
            const requestData: CreatePresentationRequest = {
                user_id: 'current_user' // 임시 사용자 ID (나중에 인증 시스템과 연동)
            };

            const response = await fetch(`${API_BASE_URL}/workspace/presentations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain',
                },
                body: JSON.stringify(requestData),
            });
            console.log('createPresentation response' + response);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const presentationId: string = await response.text();
            console.log('createPresentation' + presentationId);

            return presentationId;
        } catch (err) {
            console.error('프레젠테이션 생성 실패:', err);
            setError('프레젠테이션 생성에 실패했습니다.');
            return null;
        }
    };

    const deletePresentation = async (presentationId: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/workspace/presentations/${presentationId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                },
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
        fetchPresentations();
    }, []);

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