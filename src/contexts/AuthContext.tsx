import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, User, LoginCredentials, RegisterCredentials } from '../types/types';

interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>;
    register: (credentials: RegisterCredentials) => Promise<boolean>;
    logout: () => void;
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

    useEffect(() => {
        // 페이지 로드 시 localStorage에서 토큰 확인
        const token = localStorage.getItem('authToken');
        if (token) {
            // 토큰이 있으면 사용자 정보 로드
            loadUser(token);
        }
    }, []);

    const loadUser = async (token: string) => {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const user = await response.json();
                dispatch({ type: 'LOAD_USER', payload: user });
            } else {
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            localStorage.removeItem('authToken');
        }
    };

    const login = async (credentials: LoginCredentials): Promise<boolean> => {
        dispatch({ type: 'LOGIN_START' });
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('authToken', data.token);
                dispatch({ type: 'LOGIN_SUCCESS', payload: data.user });
                return true;
            } else {
                dispatch({ type: 'LOGIN_FAILURE', payload: data.message || '로그인에 실패했습니다.' });
                return false;
            }
        } catch (error) {
            dispatch({ type: 'LOGIN_FAILURE', payload: '네트워크 오류가 발생했습니다.' });
            return false;
        }
    };

    const register = async (credentials: RegisterCredentials): Promise<boolean> => {
        dispatch({ type: 'REGISTER_START' });
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('authToken', data.token);
                dispatch({ type: 'REGISTER_SUCCESS', payload: data.user });
                return true;
            } else {
                dispatch({ type: 'REGISTER_FAILURE', payload: data.message || '회원가입에 실패했습니다.' });
                return false;
            }
        } catch (error) {
            dispatch({ type: 'REGISTER_FAILURE', payload: '네트워크 오류가 발생했습니다.' });
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        dispatch({ type: 'LOGOUT' });
    };

    const clearError = () => {
        dispatch({ type: 'CLEAR_ERROR' });
    };

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