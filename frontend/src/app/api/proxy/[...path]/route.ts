import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.SERVER_API_URL || 'http://localhost:3001/api';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, params, 'GET');
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, params, 'POST');
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, params, 'PUT');
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return proxyRequest(request, params, 'DELETE');
}

async function proxyRequest(
    request: NextRequest,
    paramsPromise: { params: Promise<{ path: string[] }> },
    method: string
) {
    try {
        const { path } = await paramsPromise.params;
        const pathString = path.join('/');
        const searchParams = request.nextUrl.searchParams.toString();
        const url = `${BACKEND_URL}/${pathString}${searchParams ? `?${searchParams}` : ''}`;

        console.log(`[Proxy] ${method} ${url}`);

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Forward cookies from the client request
        const cookies = request.headers.get('cookie');
        if (cookies) {
            headers['Cookie'] = cookies;
        }

        const fetchOptions: RequestInit = {
            method,
            headers,
            credentials: 'include',
        };

        // Add body for POST/PUT requests
        if (method === 'POST' || method === 'PUT') {
            try {
                const body = await request.json();
                fetchOptions.body = JSON.stringify(body);
            } catch {
                // No body or invalid JSON
            }
        }

        const response = await fetch(url, fetchOptions);

        // Get response body
        const contentType = response.headers.get('content-type');
        let responseBody;
        if (contentType?.includes('application/json')) {
            responseBody = await response.json();
        } else {
            responseBody = await response.text();
        }

        // Create response with same status
        const nextResponse = NextResponse.json(
            responseBody,
            { status: response.status }
        );

        // Forward Set-Cookie headers from backend
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            nextResponse.headers.set('Set-Cookie', setCookie);
        }

        return nextResponse;
    } catch (error) {
        console.error('[Proxy Error]', error);
        return NextResponse.json(
            { error: 'Proxy error', message: String(error) },
            { status: 500 }
        );
    }
}
