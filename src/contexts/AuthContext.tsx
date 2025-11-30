import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User, SignInRequest, SignUpRequest, AuthResponse, UserInfo, UserInfoWithTokens } from '../types/types';

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
    isLoading: true,
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

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');

    const attemptTokenRefresh = useCallback(async (isSilent: boolean, loadUserFn?: (token: string) => Promise<void>): Promise<boolean> => {
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
                if (!isSilent && loadUserFn) {
                    await loadUserFn(data.accessToken);
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
    }, [API_BASE_URL]);

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
    }, [attemptTokenRefresh]);

    const clearTokens = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        dispatch({ type: 'LOGOUT' });
    };

    const loadUser = useCallback(async (token: string) => {
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
                await attemptTokenRefresh(false, loadUser);
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            clearTokens();
        }
    }, [API_BASE_URL, attemptTokenRefresh]);

    const loadUserFromOAuth = useCallback(async (): Promise<boolean> => {
        try {
            console.log('OAuth 사용자 정보 조회 시도:', `${API_BASE_URL}/auth/profile`);
            const profileResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include',
            });

            if (!profileResponse.ok) {
                return false;
            }

            const profileData: UserInfoWithTokens = await profileResponse.json();

            if (profileData.accessToken && profileData.refreshToken) {
                localStorage.setItem('accessToken', profileData.accessToken);
                localStorage.setItem('refreshToken', profileData.refreshToken);
                refreshRetryCount.current = 0;
                console.log('OAuth 토큰 저장 완료 (profile 응답에서)');
            } else {
                console.warn('OAuth 토큰이 profile 응답에 없음');
            }

            const user: User = {
                id: profileData.id,
                email: profileData.email,
                name: profileData.name,
                profileImage: undefined,
                createdAt: new Date().toISOString(),
            };
            dispatch({ type: 'LOAD_USER', payload: user });
            return true;
        } catch (error) {
            console.error('OAuth 사용자 정보 조회 중 오류:', error);
            return false;
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthSuccess = urlParams.get('oauth_success');
        const oauthError = urlParams.get('oauth_error');

        if (oauthSuccess === 'true' || oauthSuccess === '1') {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith('guestToken_')) {
                    sessionStorage.removeItem(key);
                }
            }
            
            loadUserFromOAuth().then((success) => {
                if (success) {
                    if (oAuthSuccessCallback.current) {
                        oAuthSuccessCallback.current();
                    }
                } else {
                    dispatch({ type: 'LOGIN_FAILURE', payload: 'OAuth 로그인 후 사용자 정보를 가져오는데 실패했습니다.' });
                }
            });

            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } else if (oauthError) {
            dispatch({ type: 'LOGIN_FAILURE', payload: 'OAuth 로그인에 실패했습니다.' });

            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, [loadUserFromOAuth]);

    useEffect(() => {
        (async () => {
            const urlParams = new URLSearchParams(window.location.search);
            
            const oauthSuccess = urlParams.get('oauth_success');
            if (oauthSuccess === 'true' || oauthSuccess === '1') {
                return;
            }
            
            const inviteToken = urlParams.get('invite');
            if (inviteToken) {
                dispatch({ type: 'LOGOUT' });
                return;
            }

            const isEditorPage = window.location.pathname.includes('/editor/');

            if (isEditorPage) {
                let hasGuestToken = false;
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith('guestToken_')) {
                        hasGuestToken = true;
                        break;
                    }
                }

                if (hasGuestToken) {
                    dispatch({ type: 'LOGOUT' });
                    return;
                }
                
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    dispatch({ type: 'LOGOUT' });
                    return;
                }
            }

            const token = localStorage.getItem('accessToken');
            if (!token) {
                dispatch({ type: 'LOGOUT' });
                return;
            }
            
            try {
                const res = await fetch(`${API_BASE_URL}/auth/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });
                if (res.ok) {
                    const user = await res.json();
                    dispatch({ type: 'LOAD_USER', payload: user });
                } else {
                    dispatch({ type: 'LOGOUT' });
                }
            } catch (e) {
                console.error('[AuthContext] profile load failed', e);
                dispatch({ type: 'LOGOUT' });
            }
        })();
    }, []);

    const login = async (credentials: SignInRequest): Promise<{ success: boolean; error?: string }> => {
        dispatch({ type: 'LOGIN_START' });

        try {
            const response = await fetch(`${API_BASE_URL}/auth/sign-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (response.ok) {
                const authorizationHeader = response.headers.get('Authorization');
                const refreshTokenHeader = response.headers.get('X-Refresh-Token');
                
                let accessToken = '';
                let refreshToken = '';
                
                if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
                    accessToken = authorizationHeader.substring(7); // "Bearer " 제거
                }
                
                if (refreshTokenHeader) {
                    refreshToken = refreshTokenHeader;
                }

                if (!accessToken) {
                    const errorMessage = 'Access Token을 받아오는데 실패했습니다.';
                    dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
                    return { success: false, error: errorMessage };
                }

                const userInfo: UserInfo = await response.json();
                
                localStorage.setItem('accessToken', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }
                refreshRetryCount.current = 0;

                const user: User = {
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name,
                    profileImage: undefined,
                    createdAt: new Date().toISOString(),
                };
                
                dispatch({ type: 'LOGIN_SUCCESS', payload: user });

                return { success: true };
            } else {
                let errorMessage = '로그인에 실패했습니다.';

                if (response.status === 400) {
                    errorMessage = '이메일 또는 비밀번호를 확인해주세요.';
                } else if (response.status === 401) {
                    errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
                }

                dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
                return { success: false, error: errorMessage };
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            const errorMessage = '네트워크 오류가 발생했습니다.';
            dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
            return { success: false, error: errorMessage };
        }
    };

    const register = async (credentials: SignUpRequest): Promise<{ success: boolean; error?: string }> => {
        dispatch({ type: 'REGISTER_START' });

        try {

            const response = await fetch(`${API_BASE_URL}/auth/sign-up`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            if (response.ok) {
                const loginResult = await login({ email: credentials.email, password: credentials.password });
                return loginResult;
            } else {
                let responseText = '';
                try {
                    responseText = await response.text();
                    console.log('회원가입 실패 응답 본문:', responseText);
                } catch (e) {
                    console.log('응답 본문 읽기 실패:', e);
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
            console.error('회원가입 네트워크 오류:', error);
            const errorMessage = '네트워크 오류가 발생했습니다.';
            dispatch({ type: 'REGISTER_FAILURE', payload: errorMessage });
            return { success: false, error: errorMessage };
        }
    };

    const logout = async (): Promise<void> => {
        clearTokens();
        window.location.href = '/kimbanana/ui/';
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