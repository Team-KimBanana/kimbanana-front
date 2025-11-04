const BASE = import.meta.env.VITE_API_BASE_URL;

export interface CreateInvitationRequest {
    presentation_id: string;
    expires_in_hours?: number;
}

export interface InvitationResponse {
    token: string;
    presentation_id: string;
    expires_at: string;
    invitation_url: string;
}

export async function createInvitation(
    request: CreateInvitationRequest,
    token: string | null
): Promise<InvitationResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const body: CreateInvitationRequest = {
        presentation_id: request.presentation_id,
        expires_in_hours: request.expires_in_hours ?? 24,
    };

    const res = await fetch(`${BASE}/invitations`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
    });

    if (res.status === 403) {
        throw new Error('인증 실패 (403 Forbidden). 정식 사용자만 초대 링크를 생성할 수 있습니다.');
    }
    
    if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`초대 링크 생성 실패: ${res.status} ${errorText}`);
    }

    return await res.json();
}

export interface VerifyInvitationResponse {
    valid: boolean;
    guest_token: string | null;
    presentation_id: string | null;
    message: string;
}

export async function verifyInvitation(token: string): Promise<VerifyInvitationResponse> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    const res = await fetch(`${BASE}/invitations/${token}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers,
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`초대 링크 검증 실패: ${res.status} ${errorText}`);
    }

    return await res.json();
}

