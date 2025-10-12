import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User, SignInRequest, SignUpRequest, AuthResponse, UserInfo, AuthError } from '../types/types';

interface AuthContextType extends AuthState {
    login: (credentials: SignInRequest) => Promise<{ success: boolean; error?: string }>;
    register: (credentials: SignUpRequest) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
    | { type: 'LOGIN_START' }
    | { type: 'LOGIN_SUCCESS'; payload: User }
    | { type: 'LOGIN_FAILURE'; payload: string }
    | { type: 'REGISTER_START' }
    | { type: 'REGISTER_SUCCESS'; payload: User }
    | { type: 'REGISTER_FAILURE'; payload: string }
    | { type: 'LOGOUT' }
    | { type: 'CLEAR_ERROR' }
    | { type: 'LOAD_USER'; payload: User };

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
    switch (action.type) {
        case 'LOGIN_START':
        case 'REGISTER_START':
            return {
                ...state,
                isLoading: true,
                error: null,
            };
        case 'LOGIN_SUCCESS':
        case 'REGISTER_SUCCESS':
        case 'LOAD_USER':
            return {
                ...state,
                user: action.payload,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            };
        case 'LOGIN_FAILURE':
        case 'REGISTER_FAILURE':
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: action.payload,
            };
        case 'LOGOUT':
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            };
        case 'CLEAR_ERROR':
            return {
                ...state,
                error: null,
            };
        default:
            return state;
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);
    const refreshRetryCount = React.useRef(0);
    
    // 개발 환경에서는 프록시 사용, 운영 환경에서는 실제 URL 사용
    const API_BASE_URL = import.meta.env.DEV 
        ? '/api'  // 개발 환경: Vite 프록시 사용
        : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

    useEffect(() => {
        // 페이지 로드 시 localStorage에서 토큰 확인
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            // 토큰이 있으면 사용자 정보 로드
            loadUser(accessToken);
        }
    }, []);

    const loadUser = async (token: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            });
            
            if (response.ok) {
                const userInfo: UserInfo = await response.json();
                const user: User = {
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    profileImage: undefined,
                    createdAt: new Date().toISOString(),
                };
                dispatch({ type: 'LOAD_USER', payload: user });
            } else {
                // 토큰이 유효하지 않으면 리프레시 시도
                await attemptTokenRefresh();
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            clearTokens();
        }
    };

    const attemptTokenRefresh = async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            clearTokens();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${refreshToken}`,
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data: AuthResponse = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                await loadUser(data.accessToken);
            } else {
                clearTokens();
            }
        } catch (error) {
            console.error('토큰 재발급 실패:', error);
            clearTokens();
        }
    };

    const clearTokens = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        dispatch({ type: 'LOGOUT' });
    };

    const login = async (credentials: SignInRequest): Promise<{ success: boolean; error?: string }> => {
        dispatch({ type: 'LOGIN_START' });
        
        try {
            console.log('🔐 로그인 시도:', {
                url: `${API_BASE_URL}/auth/sign-in`,
                email: credentials.email,
                isDev: import.meta.env.DEV
            });

            const response = await fetch(`${API_BASE_URL}/auth/sign-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            console.log('🔐 로그인 응답:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const data: AuthResponse = await response.json();
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                // 로그인 성공 시 재시도 카운터 리셋
                refreshRetryCount.current = 0;
                
                // 사용자 정보 로드 시도
                try {
                    await loadUser(data.accessToken);
                } catch (error) {
                    console.warn('프로필 조회 실패, 임시 사용자 정보 생성');
                    // 프로필 API가 실패하면 임시 사용자 정보 생성
                    const tempUser: User = {
                        id: 'temp_user_' + Date.now(),
                        email: credentials.email,
                        name: credentials.email.split('@')[0],
                        profileImage: undefined,
                        createdAt: new Date().toISOString(),
                    };
                    dispatch({ type: 'LOAD_USER', payload: tempUser });
                }
                
                return { success: true };
            } else {
                // 응답 본문도 확인
                let responseText = '';
                try {
                    responseText = await response.text();
                    console.log('🔐 로그인 실패 응답 본문:', responseText);
                } catch (e) {
                    console.log('🔐 응답 본문 읽기 실패:', e);
                }

                let errorMessage = '로그인에 실패했습니다.';
                
                if (response.status === 400) {
                    errorMessage = '이메일 또는 비밀번호를 확인해주세요.';
                } else if (response.status === 401) {
                    errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
                }
                
                dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
                return { success: false, error: errorMessage };
            }
        } catch (error) {
            const errorMessage = '네트워크 오류가 발생했습니다.';
            dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
            return { success: false, error: errorMessage };
        }
    };

    const register = async (credentials: SignUpRequest): Promise<{ success: boolean; error?: string }> => {
        dispatch({ type: 'REGISTER_START' });
        
        try {
            console.log('📝 회원가입 시도:', {
                url: `${API_BASE_URL}/auth/sign-up`,
                email: credentials.email,
                name: credentials.name,
                isDev: import.meta.env.DEV
            });

            const response = await fetch(`${API_BASE_URL}/auth/sign-up`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            console.log('📝 회원가입 응답:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                // 회원가입 성공 시 자동 로그인
                const loginResult = await login({ email: credentials.email, password: credentials.password });
                return loginResult;
            } else {
                // 응답 본문도 확인
                let responseText = '';
                try {
                    responseText = await response.text();
                    console.log('📝 회원가입 실패 응답 본문:', responseText);
                } catch (e) {
                    console.log('📝 응답 본문 읽기 실패:', e);
                }

                let errorMessage = '회원가입에 실패했습니다.';
                
                if (response.status === 400) {
                    errorMessage = '입력 정보를 확인해주세요. (이메일 형식, 이름 3자 이상, 비밀번호 6자 이상 영문+숫자)';
                } else if (response.status === 409) {
                    errorMessage = '이미 가입된 이메일입니다.';
                }
                
                dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
                return { success: false, error: errorMessage };
            }
        } catch (error) {
            console.error('📝 회원가입 네트워크 오류:', error);
            const errorMessage = '네트워크 오류가 발생했습니다.';
            dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
            return { success: false, error: errorMessage };
        }
    };

    const logout = async (): Promise<void> => {
        // API 호출 없이 클라이언트에서만 토큰 삭제
        clearTokens();
    };

    const clearError = useCallback(() => {
        dispatch({ type: 'CLEAR_ERROR' });
    }, []);

    const value: AuthContextType = {
        ...state,
        login,
        register,
        logout,
        clearError,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 