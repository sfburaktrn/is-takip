import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.SERVER_API_URL || 'http://localhost:3001/api';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'GET');
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'POST');
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'PUT');
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'DELETE');
}

async function proxyRequest(
    request: NextRequest,
    path: string[],
    method: string
) {
    try {
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
