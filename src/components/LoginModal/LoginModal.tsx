import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import './LoginModal.css';

interface LoginModalProps {
    onClose: () => void;
    onSwitchToRegister: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSwitchToRegister }) => {
    const { login, isLoading, error, clearError, setOAuthSuccessCallback } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isOAuthLoading, setIsOAuthLoading] = useState(false);

    useEffect(() => {
        clearError();
        setOAuthSuccessCallback(() => {
            onClose();
        });

        return () => {
            setOAuthSuccessCallback(undefined);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 모달이 열릴 때만 실행

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // 사용자가 입력을 시작하면 에러를 지움
        if (error) {
            clearError();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await login(formData);
        if (result.success) {
            onClose();
        }
    };

    const handleOAuthLogin = (provider: 'google' | 'github') => {
        setIsOAuthLoading(true);
        window.location.href = `/kimbanana/app/oauth2/authorization/${provider}`;
    };

    const isFormValid = formData.email && formData.password;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>
                    <Icon icon="material-symbols:close" width="24" />
                </button>

                <div className="login-header">
                    <h1 className="login-title">로그인</h1>
                    <p className="login-subtitle">
                        계정이 없으신가요?{' '}
                        <span onClick={onSwitchToRegister} className="register-link">
                            회원가입
                        </span>
                    </p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            이메일
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="form-input"
                            placeholder="이메일을 입력해주세요"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            비밀번호
                        </label>
                        <div className="password-input-container">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className="form-input"
                                placeholder="비밀번호를 입력해주세요"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <Icon
                                    icon={showPassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'}
                                    width="20"
                                />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={!isFormValid || isLoading || isOAuthLoading}
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                </form>

                <div className="divider">
                    <span className="divider-text">또는</span>
                </div>

                <div className="social-login">
                    <button
                        className="social-button google-button"
                        onClick={() => handleOAuthLogin('google')}
                        disabled={isLoading || isOAuthLoading}
                    >
                        <Icon icon="logos:google-icon" width="20" />
                        {isOAuthLoading ? '로그인 중...' : 'Google로 로그인'}
                    </button>

                    <button
                        className="social-button github-button"
                        onClick={() => handleOAuthLogin('github')}
                        disabled={isLoading || isOAuthLoading}
                    >
                        <Icon icon="logos:github-icon" width="20" />
                        {isOAuthLoading ? '로그인 중...' : 'GitHub로 로그인'}
                    </button>
                </div>

                <div className="login-footer">
                    <a href="/forgot-password" onClick={(e) => { e.preventDefault(); alert('비밀번호 찾기 기능 구현 필요'); }} className="forgot-password">
                        비밀번호를 잊으셨나요?
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;