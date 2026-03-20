export type ApiOk<T> = { ok: true; data: T; status: number };
export type ApiErr = { ok: false; error: string; status: number; data?: any };
export type ApiResult<T> = ApiOk<T> | ApiErr;

async function safeReadText(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<T>> {
    try {
        const res = await fetch(input, init);
        const status = res.status;

        // Fire a global event so ClientProviders can redirect to login
        if (status === 401) {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }
        }

        const raw = await safeReadText(res);
        const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

        if (res.ok) {
            return { ok: true, data: (parsed as T) ?? (undefined as unknown as T), status };
        }

        const msg = (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as any).message === 'string')
            ? (parsed as any).message
            : (raw || `Request failed (${status})`);

        return { ok: false, error: msg, status, data: parsed };
    } catch {
        return { ok: false, error: 'Network error. Please check your connection and try again.', status: 0 };
    }
}
