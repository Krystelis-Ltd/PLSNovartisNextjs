import { NextRequest } from 'next/server';

/**
 * Extracts the user identity from Azure App Service (Easy Auth) headers.
 * 
 * Headers provided by Azure:
 * - X-MS-CLIENT-PRINCIPAL-NAME: User's email/username
 * - X-MS-CLIENT-PRINCIPAL-ID: User's unique ID
 */
export function getUserIdentity(request: NextRequest): string {
    const userEmail = request.headers.get('x-ms-client-principal-name');
    
    if (userEmail) {
        return userEmail;
    }

    // Fallback for local development
    if (process.env.NODE_ENV === 'development') {
        return 'Local-Dev-User';
    }

    return 'Anonymous-User';
}
