import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User, SignInRequest, SignUpRequest, AuthResponse, UserInfo } from '../types/types';

interface AuthContextType extends AuthState {
    login: (credentials: SignInRequest) => Promise<{ success: boolean; error?: string }>;
    register: (credentials: SignUpRequest) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    clearError: () => void;
    getAuthToken: () => Promise<string | null>;
    loadUserFromOAuth: () => Promise<boolean>;
    onOAuthSuccess?: () => void;
    setOAuthSuccessCallback: (callback: (() => void) | undefined) => void;
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
    const oAuthSuccessCallback = React.useRef<(() => void) | undefined>(undefined);

    const API_BASE_URL = import.meta.env.DEV
        ? '/api'
        : import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

    const getAuthToken = useCallback(async (): Promise<string | null> => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            return accessToken;
        }

        const success = await attemptTokenRefresh(true);
        if (success) {
            return localStorage.getItem('accessToken');
        }

        return null;
    }, []);

    const loadUserFromOAuth = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include',
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
                return true;
            } else {
                console.error('OAuth 로그인 후 사용자 정보 조회 실패:', response.status);
                return false;
            }
        } catch (error) {
            console.error('OAuth 로그인 후 사용자 정보 조회 중 오류:', error);
            return false;
        }
    }, [API_BASE_URL]);

    const handleOAuthCallback = useCallback(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');
        
        if (oauthSuccess === 'true') {
            const success = await loadUserFromOAuth();
            if (success) {
                console.log('OAuth 로그인 성공');
                if (oAuthSuccessCallback.current) {
                    oAuthSuccessCallback.current();
                }
            } else {
                console.error('OAuth 로그인 후 사용자 정보 로드 실패');
                dispatch({ type: 'LOGIN_FAILURE', payload: 'OAuth 로그인 후 사용자 정보를 가져오는데 실패했습니다.' });
            }
            
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } else if (oauthError) {
            console.error('OAuth 로그인 실패:', oauthError);
            dispatch({ type: 'LOGIN_FAILURE', payload: 'OAuth 로그인에 실패했습니다.' });
            
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, [loadUserFromOAuth]);

    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            loadUser(accessToken);
        } else {
            handleOAuthCallback();
        }
    }, [getAuthToken, handleOAuthCallback]);

    const loadUser = async (token: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
                credentials: "include",
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
                await attemptTokenRefresh(false);
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            clearTokens();
        }
    };

    const attemptTokenRefresh = async (isSilent: boolean): Promise<boolean> => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            clearTokens();
            return false;
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
                if (!isSilent) {
                    await loadUser(data.accessToken);
                }
                return true;
            } else {
                clearTokens();
                return false;
            }
        } catch (error) {
            console.error('토큰 재발급 실패:', error);
            clearTokens();
            return false;
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
                refreshRetryCount.current = 0;

                try {
                    await loadUser(data.accessToken);
                } catch (error) {
                    console.warn('프로필 조회 실패, 임시 사용자 정보 생성');
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
        clearTokens();
    };

    const clearError = useCallback(() => {
        dispatch({ type: 'CLEAR_ERROR' });
    }, []);

    const setOAuthSuccessCallback = useCallback((callback: (() => void) | undefined) => {
        oAuthSuccessCallback.current = callback;
    }, []);

    const value: AuthContextType = {
        ...state,
        login,
        register,
        logout,
        clearError,
        getAuthToken,
        loadUserFromOAuth,
        onOAuthSuccess: oAuthSuccessCallback.current,
        setOAuthSuccessCallback,
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
