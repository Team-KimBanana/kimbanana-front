import { InvitationResponse, InvitationVerificationResponse, CreateInvitationRequest } from '../types/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');


export async function createInvitation(
    request: CreateInvitationRequest,
    accessToken: string
): Promise<InvitationResponse> {
    const response = await fetch(`${API_BASE}/invitations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('인증이 필요합니다. 로그인이 필요합니다.');
        }
        const errorText = await response.text();
        throw new Error(`초대 링크 생성 실패: ${errorText || response.statusText}`);
    }

    return response.json();
}


export async function verifyInvitation(token: string): Promise<InvitationVerificationResponse> {
    const response = await fetch(`${API_BASE}/invitations/${token}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`초대 링크 검증 실패: ${response.statusText}`);
    }

    return response.json();
}
