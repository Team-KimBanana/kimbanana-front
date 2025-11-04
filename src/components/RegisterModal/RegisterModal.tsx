import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import './RegisterModal.css';

interface RegisterModalProps {
    onClose: () => void;
    onSwitchToLogin: () => void;
}

const RegisterModal: React.FC<RegisterModalProps> = ({ onClose, onSwitchToLogin }) => {
    const { register, isLoading, error, clearError } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    useEffect(() => {
        clearError();
    }, []);

    useEffect(() => {
        const strength = calculatePasswordStrength(formData.password);
        setPasswordStrength(strength);
    }, [formData.password]);

    const calculatePasswordStrength = (password: string): number => {
        let strength = 0;
        if (password.length >= 8) strength += 1;
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        return strength;
    };

    const getPasswordStrengthText = (strength: number): string => {
        switch (strength) {
            case 0:
            case 1:
                return '매우 약함';
            case 2:
                return '약함';
            case 3:
                return '보통';
            case 4:
                return '강함';
            case 5:
                return '매우 강함';
            default:
                return '';
        }
    };

    const getPasswordStrengthColor = (strength: number): string => {
        switch (strength) {
            case 0:
            case 1:
                return '#ff4444';
            case 2:
                return '#ff8800';
            case 3:
                return '#ffbb33';
            case 4:
                return '#00C851';
            case 5:
                return '#007E33';
            default:
                return '#e0e0e0';
        }
    };

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

        if (formData.password !== formData.confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (passwordStrength < 3) {
            alert('비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용해주세요.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('올바른 이메일 형식을 입력해주세요.');
            return;
        }

        if (formData.name.length < 3) {
            alert('이름은 최소 3자 이상이어야 합니다.');
            return;
        }

        const nameCharRegex = /^[a-zA-Z0-9가-힣_-]+$/;
        if (!nameCharRegex.test(formData.name)) {
            alert('이름에는 한글, 영문, 숫자, 언더스코어(_), 하이픈(-) 외의 문자는 사용할 수 없습니다.');
            return;
        }

        if (formData.password.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        if (/[가-힣]/.test(formData.password)) {
            alert('비밀번호에는 한글을 사용할 수 없습니다.');
            return;
        }

        if (!/[a-zA-Z]/.test(formData.password)) {
            alert('비밀번호는 최소 하나의 영문자를 포함해야 합니다.');
            return;
        }

        if (!/[0-9]/.test(formData.password)) {
            alert('비밀번호는 최소 하나의 숫자를 포함해야 합니다.');
            return;
        }

        const { confirmPassword, ...registerData } = formData;
        const result = await register(registerData);
        if (result.success) {
            onClose();
        }
    };

    const handleOAuthRegister = (provider: 'google' | 'github') => {
        window.location.href = `/kimbanana/app/oauth2/authorization/${provider}`;
    };

    const isFormValid = formData.name && formData.email && formData.password &&
        formData.confirmPassword && formData.password === formData.confirmPassword &&
        passwordStrength >= 3;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>
                    <Icon icon="material-symbols:close" width="24" />
                </button>

                <div className="register-header">
                    <h1 className="register-title">회원가입</h1>
                    <p className="register-subtitle">
                        이미 계정이 있으신가요?{' '}
                        <span onClick={onSwitchToLogin} className="login-link">
                            로그인
                        </span>
                    </p>
                </div>

                <form className="register-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name" className="form-label">
                            이름
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="form-input"
                            placeholder="이름을 입력해주세요"
                            required
                        />
                    </div>

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
                            placeholder="이메일을 입력해주세요 (예: user@example.com)"
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
                                placeholder="비밀번호를 입력해주세요 (6자 이상, 영문/숫자 필수)"
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
                        {formData.password && (
                            <div className="password-strength">
                                <div className="strength-bar">
                                    <div
                                        className="strength-fill"
                                        style={{
                                            width: `${(passwordStrength / 5) * 100}%`,
                                            backgroundColor: getPasswordStrengthColor(passwordStrength)
                                        }}
                                    ></div>
                                </div>
                                <span className="strength-text" style={{ color: getPasswordStrengthColor(passwordStrength) }}>
                                    {getPasswordStrengthText(passwordStrength)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label">
                            비밀번호 확인
                        </label>
                        <div className="password-input-container">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                className={`form-input ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'error' : ''}`}
                                placeholder="비밀번호를 다시 입력해주세요"
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                <Icon
                                    icon={showConfirmPassword ? 'material-symbols:visibility-off' : 'material-symbols:visibility'}
                                    width="20"
                                />
                            </button>
                        </div>
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                            <div className="error-message small">
                                비밀번호가 일치하지 않습니다.
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="register-button"
                        disabled={!isFormValid || isLoading}
                    >
                        {isLoading ? '회원가입 중...' : '회원가입'}
                    </button>
                </form>


                <div className="divider">
                    <span className="divider-text">또는</span>
                </div>

                <div className="social-register">
                    <button
                        className="social-button google-button"
                        onClick={() => handleOAuthRegister('google')}
                        disabled={isLoading}
                    >
                        <Icon icon="logos:google-icon" width="20" />
                        Google로 회원가입
                    </button>

                    <button
                        className="social-button github-button"
                        onClick={() => handleOAuthRegister('github')}
                        disabled={isLoading}
                    >
                        <Icon icon="logos:github-icon" width="20" />
                        GitHub로 회원가입
                    </button>
                </div>

                <div className="register-footer">
                    <p className="terms-text">
                        회원가입 시{' '}
                        <a href="/terms" className="terms-link">이용약관</a>
                        과{' '}
                        <a href="/privacy" className="terms-link">개인정보처리방침</a>
                        에 동의하는 것으로 간주됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterModal;
