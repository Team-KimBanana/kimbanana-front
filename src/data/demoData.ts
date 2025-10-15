import { SlideData } from '../types/types';

export interface DemoPresentation {
    id: string;
    title: string;
    slides: {
        id: string;
        order: number;
        data: SlideData;
    }[];
}

export const demoPresentations: Record<string, DemoPresentation> = {
    'demo-1': {
        id: 'demo-1',
        title: 'AI 기반 협업 도구 - 비즈니스 기획서',
        slides: [
            {
                id: 's_bp_001_page_01',
                order: 1,
                data: {
                    shapes: [
                        { id: 1001, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 500, color: '#2563eb' }
                    ],
                    texts: [
                        { id: 2001, text: 'AI 기반 협업 도구', x: 200, y: 200, color: '#ffffff', fontSize: 48 },
                        { id: 2002, text: '비즈니스 기획서', x: 250, y: 280, color: '#ffffff', fontSize: 36 },
                        { id: 2003, text: '2025년 1월', x: 400, y: 450, color: '#ffffff', fontSize: 24 }
                    ]
                }
            },
            {
                id: 's_bp_001_page_02',
                order: 2,
                data: {
                    shapes: [
                        { id: 1002, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#1e40af' },
                        { id: 1003, type: 'circle', x: 150, y: 250, rotation: 0, radiusX: 80, radiusY: 80, color: '#3b82f6' },
                        { id: 1004, type: 'circle', x: 400, y: 250, rotation: 0, radiusX: 80, radiusY: 80, color: '#60a5fa' },
                        { id: 1005, type: 'circle', x: 650, y: 250, rotation: 0, radiusX: 80, radiusY: 80, color: '#93c5fd' }
                    ],
                    texts: [
                        { id: 2004, text: '시장 분석', x: 400, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 2005, text: '시장 규모', x: 100, y: 380, color: '#1f2937', fontSize: 20 },
                        { id: 2006, text: '$50B', x: 120, y: 240, color: '#ffffff', fontSize: 24 },
                        { id: 2007, text: '성장률', x: 360, y: 380, color: '#1f2937', fontSize: 20 },
                        { id: 2008, text: '35%', x: 380, y: 240, color: '#ffffff', fontSize: 24 },
                        { id: 2009, text: '목표 시장', x: 600, y: 380, color: '#1f2937', fontSize: 20 },
                        { id: 2010, text: 'SMB', x: 630, y: 240, color: '#ffffff', fontSize: 24 }
                    ]
                }
            },
            {
                id: 's_bp_001_page_03',
                order: 3,
                data: {
                    shapes: [
                        { id: 1006, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#1e40af' },
                        { id: 1007, type: 'rectangle', x: 100, y: 200, rotation: 0, width: 250, height: 300, color: '#dbeafe' },
                        { id: 1008, type: 'rectangle', x: 400, y: 200, rotation: 0, width: 250, height: 300, color: '#bfdbfe' },
                        { id: 1009, type: 'rectangle', x: 700, y: 200, rotation: 0, width: 250, height: 300, color: '#93c5fd' }
                    ],
                    texts: [
                        { id: 2011, text: '비즈니스 모델', x: 350, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 2012, text: '무료 플랜', x: 160, y: 230, color: '#1e40af', fontSize: 24 },
                        { id: 2013, text: '• 기본 기능\n• 3명까지\n• 1GB 저장', x: 120, y: 290, color: '#374151', fontSize: 18 },
                        { id: 2014, text: '프로 플랜', x: 460, y: 230, color: '#1e40af', fontSize: 24 },
                        { id: 2015, text: '• 전체 기능\n• 50명까지\n• 100GB 저장', x: 420, y: 290, color: '#374151', fontSize: 18 },
                        { id: 2016, text: '엔터프라이즈', x: 730, y: 230, color: '#1e40af', fontSize: 24 },
                        { id: 2017, text: '• 무제한\n• 커스텀\n• 전담 지원', x: 720, y: 290, color: '#374151', fontSize: 18 }
                    ]
                }
            },
            {
                id: 's_bp_001_page_04',
                order: 4,
                data: {
                    shapes: [
                        { id: 1010, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#1e40af' },
                        { id: 1011, type: 'rectangle', x: 100, y: 200, rotation: 0, width: 150, height: 100, color: '#3b82f6' },
                        { id: 1012, type: 'rectangle', x: 300, y: 320, rotation: 0, width: 150, height: 150, color: '#60a5fa' },
                        { id: 1013, type: 'rectangle', x: 500, y: 490, rotation: 0, width: 150, height: 200, color: '#93c5fd' }
                    ],
                    texts: [
                        { id: 2018, text: '재무 계획 (3년)', x: 350, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 2019, text: 'Year 1', x: 150, y: 160, color: '#1f2937', fontSize: 20 },
                        { id: 2020, text: '$500K', x: 145, y: 240, color: '#ffffff', fontSize: 20 },
                        { id: 2021, text: 'Year 2', x: 350, y: 280, color: '#1f2937', fontSize: 20 },
                        { id: 2022, text: '$2M', x: 360, y: 380, color: '#ffffff', fontSize: 20 },
                        { id: 2023, text: 'Year 3', x: 550, y: 450, color: '#1f2937', fontSize: 20 },
                        { id: 2024, text: '$5M', x: 560, y: 560, color: '#ffffff', fontSize: 20 }
                    ]
                }
            },
            {
                id: 's_bp_001_page_05',
                order: 5,
                data: {
                    shapes: [
                        { id: 1014, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#1e40af' },
                        { id: 1015, type: 'circle', x: 150, y: 250, rotation: 0, radiusX: 50, radiusY: 50, color: '#10b981' },
                        { id: 1016, type: 'circle', x: 400, y: 250, rotation: 0, radiusX: 50, radiusY: 50, color: '#3b82f6' },
                        { id: 1017, type: 'circle', x: 650, y: 250, rotation: 0, radiusX: 50, radiusY: 50, color: '#8b5cf6' },
                        { id: 1018, type: 'rectangle', x: 200, y: 245, rotation: 0, width: 150, height: 10, color: '#9ca3af' },
                        { id: 1019, type: 'rectangle', x: 450, y: 245, rotation: 0, width: 150, height: 10, color: '#9ca3af' }
                    ],
                    texts: [
                        { id: 2025, text: '로드맵', x: 420, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 2026, text: 'Q1 2025', x: 120, y: 340, color: '#1f2937', fontSize: 18 },
                        { id: 2027, text: '베타 출시', x: 110, y: 370, color: '#6b7280', fontSize: 16 },
                        { id: 2028, text: 'Q2 2025', x: 370, y: 340, color: '#1f2937', fontSize: 18 },
                        { id: 2029, text: '정식 론칭', x: 360, y: 370, color: '#6b7280', fontSize: 16 },
                        { id: 2030, text: 'Q3 2025', x: 620, y: 340, color: '#1f2937', fontSize: 18 },
                        { id: 2031, text: '글로벌 확장', x: 600, y: 370, color: '#6b7280', fontSize: 16 }
                    ]
                }
            }
        ]
    },
    'demo-2': {
        id: 'demo-2',
        title: '웹 개발 기초 - 교육 자료',
        slides: [
            {
                id: 's_ed_002_page_01',
                order: 1,
                data: {
                    shapes: [
                        { id: 2001, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 500, color: '#059669' }
                    ],
                    texts: [
                        { id: 3001, text: '웹 개발 기초', x: 300, y: 200, color: '#ffffff', fontSize: 48 },
                        { id: 3002, text: 'HTML, CSS, JavaScript 입문', x: 220, y: 280, color: '#d1fae5', fontSize: 28 },
                        { id: 3003, text: '강사: 김개발\n소요 시간: 4주', x: 350, y: 400, color: '#ffffff', fontSize: 20 }
                    ]
                }
            },
            {
                id: 's_ed_002_page_02',
                order: 2,
                data: {
                    shapes: [
                        { id: 2002, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#047857' },
                        { id: 2003, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 800, height: 100, color: '#d1fae5' },
                        { id: 2004, type: 'rectangle', x: 100, y: 300, rotation: 0, width: 800, height: 100, color: '#a7f3d0' },
                        { id: 2005, type: 'rectangle', x: 100, y: 420, rotation: 0, width: 800, height: 100, color: '#6ee7b7' }
                    ],
                    texts: [
                        { id: 3004, text: '학습 목표', x: 400, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 3005, text: '1. HTML 태그와 구조를 이해한다', x: 130, y: 210, color: '#065f46', fontSize: 22 },
                        { id: 3006, text: '2. CSS를 활용한 스타일링을 학습한다', x: 130, y: 330, color: '#065f46', fontSize: 22 },
                        { id: 3007, text: '3. JavaScript로 인터랙티브한 웹페이지를 만든다', x: 130, y: 450, color: '#065f46', fontSize: 22 }
                    ]
                }
            },
            {
                id: 's_ed_002_page_03',
                order: 3,
                data: {
                    shapes: [
                        { id: 2006, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#047857' },
                        { id: 2007, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 800, height: 350, color: '#1f2937' }
                    ],
                    texts: [
                        { id: 3008, text: 'HTML 기본 구조', x: 360, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 3009, text: '<html>\n  <head>\n    <title>내 첫 웹페이지</title>\n  </head>\n  <body>\n    <h1>안녕하세요!</h1>\n    <p>웹 개발을 시작합니다.</p>\n  </body>\n</html>', x: 130, y: 210, color: '#10b981', fontSize: 18 }
                    ]
                }
            },
            {
                id: 's_ed_002_page_04',
                order: 4,
                data: {
                    shapes: [
                        { id: 2008, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#047857' },
                        { id: 2009, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 350, height: 300, color: '#3b82f6' },
                        { id: 2010, type: 'circle', x: 650, y: 330, rotation: 0, radiusX: 100, radiusY: 100, color: '#ef4444' }
                    ],
                    texts: [
                        { id: 3010, text: 'CSS 기초', x: 400, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 3011, text: '색상, 크기, 위치를\n자유롭게 조절', x: 150, y: 300, color: '#ffffff', fontSize: 24 },
                        { id: 3012, text: '다양한 도형과\n레이아웃 구성', x: 570, y: 470, color: '#1f2937', fontSize: 20 }
                    ]
                }
            },
            {
                id: 's_ed_002_page_05',
                order: 5,
                data: {
                    shapes: [
                        { id: 2011, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#047857' },
                        { id: 2012, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 800, height: 400, color: '#fef3c7' }
                    ],
                    texts: [
                        { id: 3013, text: '실습 과제', x: 400, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 3014, text: '📝 과제: 자기소개 페이지 만들기', x: 150, y: 220, color: '#92400e', fontSize: 28 },
                        { id: 3015, text: '요구사항:\n\n✓ HTML로 기본 구조 작성\n✓ CSS로 스타일 적용\n✓ 최소 3개의 섹션 포함\n✓ 반응형 디자인 고려', x: 150, y: 290, color: '#78350f', fontSize: 20 },
                        { id: 3016, text: '제출 기한: 1주일', x: 350, y: 520, color: '#b45309', fontSize: 22 }
                    ]
                }
            }
        ]
    },
    'demo-3': {
        id: 'demo-3',
        title: 'Kimbanana - 제품 소개',
        slides: [
            {
                id: 's_pi_003_page_01',
                order: 1,
                data: {
                    shapes: [
                        { id: 3001, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 500, color: '#7c3aed' }
                    ],
                    texts: [
                        { id: 4001, text: 'Kimbanana', x: 350, y: 180, color: '#ffffff', fontSize: 56 },
                        { id: 4002, text: '실시간 협업 프레젠테이션 도구', x: 240, y: 270, color: '#e9d5ff', fontSize: 28 },
                        { id: 4003, text: '팀워크를 한 단계 업그레이드하세요', x: 260, y: 420, color: '#ffffff', fontSize: 22 }
                    ]
                }
            },
            {
                id: 's_pi_003_page_02',
                order: 2,
                data: {
                    shapes: [
                        { id: 3002, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#6d28d9' },
                        { id: 3003, type: 'triangle', x: 200, y: 250, rotation: 180, points: [0, -80, 80, 80, -80, 80], color: '#ef4444' },
                        { id: 3004, type: 'triangle', x: 500, y: 250, rotation: 180, points: [0, -80, 80, 80, -80, 80], color: '#f59e0b' },
                        { id: 3005, type: 'triangle', x: 800, y: 250, rotation: 180, points: [0, -80, 80, 80, -80, 80], color: '#eab308' }
                    ],
                    texts: [
                        { id: 4004, text: '이런 문제 겪고 계신가요?', x: 300, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 4005, text: '버전 관리\n어려움', x: 150, y: 360, color: '#1f2937', fontSize: 20 },
                        { id: 4006, text: '실시간 협업\n불가', x: 460, y: 360, color: '#1f2937', fontSize: 20 },
                        { id: 4007, text: '파일 공유\n번거로움', x: 750, y: 360, color: '#1f2937', fontSize: 20 }
                    ]
                }
            },
            {
                id: 's_pi_003_page_03',
                order: 3,
                data: {
                    shapes: [
                        { id: 3006, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#6d28d9' },
                        { id: 3007, type: 'circle', x: 500, y: 320, rotation: 0, radiusX: 150, radiusY: 150, color: '#10b981' }
                    ],
                    texts: [
                        { id: 4008, text: 'Kimbanana가 해결합니다', x: 300, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 4009, text: '✓ 실시간 동시 편집\n✓ 자동 버전 관리\n✓ 클라우드 저장\n✓ 어디서나 접근', x: 150, y: 200, color: '#1f2937', fontSize: 24 },
                        { id: 4010, text: '간편하게\n협업하세요', x: 430, y: 290, color: '#ffffff', fontSize: 26 }
                    ]
                }
            },
            {
                id: 's_pi_003_page_04',
                order: 4,
                data: {
                    shapes: [
                        { id: 3008, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#6d28d9' },
                        { id: 3009, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 180, height: 180, color: '#ddd6fe' },
                        { id: 3010, type: 'rectangle', x: 320, y: 180, rotation: 0, width: 180, height: 180, color: '#c4b5fd' },
                        { id: 3011, type: 'rectangle', x: 540, y: 180, rotation: 0, width: 180, height: 180, color: '#a78bfa' },
                        { id: 3012, type: 'rectangle', x: 760, y: 180, rotation: 0, width: 180, height: 180, color: '#8b5cf6' }
                    ],
                    texts: [
                        { id: 4011, text: '핵심 기능', x: 400, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 4012, text: '✏️\n그리기', x: 150, y: 230, color: '#5b21b6', fontSize: 20 },
                        { id: 4013, text: '📝\n텍스트', x: 365, y: 230, color: '#5b21b6', fontSize: 20 },
                        { id: 4014, text: '🖼️\n이미지', x: 585, y: 230, color: '#ffffff', fontSize: 20 },
                        { id: 4015, text: '👥\n협업', x: 810, y: 230, color: '#ffffff', fontSize: 20 },
                        { id: 4016, text: '드래그 앤 드롭으로 쉬운 편집', x: 280, y: 450, color: '#1f2937', fontSize: 24 }
                    ]
                }
            },
            {
                id: 's_pi_003_page_05',
                order: 5,
                data: {
                    shapes: [
                        { id: 3013, type: 'rectangle', x: 50, y: 50, rotation: 0, width: 900, height: 80, color: '#6d28d9' },
                        { id: 3014, type: 'rectangle', x: 100, y: 180, rotation: 0, width: 250, height: 350, color: '#f3f4f6' },
                        { id: 3015, type: 'rectangle', x: 380, y: 180, rotation: 0, width: 250, height: 350, color: '#e5e7eb' },
                        { id: 3016, type: 'rectangle', x: 660, y: 180, rotation: 0, width: 250, height: 350, color: '#d1d5db' }
                    ],
                    texts: [
                        { id: 4017, text: '요금제', x: 420, y: 70, color: '#ffffff', fontSize: 32 },
                        { id: 4018, text: '무료', x: 200, y: 210, color: '#6d28d9', fontSize: 28 },
                        { id: 4019, text: '₩0/월\n\n• 3명까지\n• 기본 기능\n• 1GB 저장', x: 130, y: 270, color: '#374151', fontSize: 18 },
                        { id: 4020, text: '프로', x: 480, y: 210, color: '#6d28d9', fontSize: 28 },
                        { id: 4021, text: '₩9,900/월\n\n• 50명까지\n• 전체 기능\n• 100GB 저장', x: 410, y: 270, color: '#374151', fontSize: 18 },
                        { id: 4022, text: '기업', x: 750, y: 210, color: '#6d28d9', fontSize: 28 },
                        { id: 4023, text: '문의하기\n\n• 무제한\n• 맞춤 설정\n• 전담 지원', x: 690, y: 270, color: '#374151', fontSize: 18 },
                        { id: 4024, text: '📧 contact@kimbanana.io', x: 320, y: 560, color: '#6d28d9', fontSize: 20 }
                    ]
                }
            }
        ]
    }
};
