/**
 * Secure authentication service
 * Uses HTTP-only cookies for token storage (set by server)
 * Stores only non-sensitive user data in sessionStorage (cleared on browser close)
 * NEVER stores tokens or sensitive data in localStorage
 */

import {API_BASE_URL} from './api.js';

class AuthService
{
    constructor()
    {
        this.user=null;
        this.isInitialized=false;
    }

    /**
     * Initialize auth on app load
     * Verifies session with backend
     */
    async initialize()
    {
        try
        {
            // Verify existing session with backend
            // If user has valid HTTP-only cookie, this will succeed
            const response=await fetch(`${API_BASE_URL}/api/auth/verify`, {
                credentials: 'include', // Send cookies with request
                headers: {'Content-Type': 'application/json'},
            });

            if (response.ok)
            {
                const data=await response.json();
                if (data.success&&data.data&&data.data.user)
                {
                    this.setUser(data.data.user);
                    this.isInitialized=true;
                    return true;
                }
            }

            // No valid session, clear any stored data
            this.clearSession();
            this.isInitialized=true;
            return false;
        } catch (err)
        {
            console.error('[AUTH] Initialization failed:', err);
            this.clearSession();
            this.isInitialized=true;
            return false;
        }
    }

    /**
     * Register new user
     */
    async register(userData)
    {
        try
        {
            const response=await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                credentials: 'include', // Accept HTTP-only cookies from server
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(userData),
            });

            const data=await response.json();

            if (!response.ok)
            {
                throw new Error(data.error||'Registration failed');
            }

            // Server sets HTTP-only cookie automatically
            if (data.success&&data.data&&data.data.user)
            {
                this.setUser(data.data.user);
                return {success: true, user: data.data.user};
            }

            return {success: false, error: data.error||'Unknown error'};
        } catch (err)
        {
            console.error('[AUTH] Registration error:', err);
            return {success: false, error: err.message};
        }
    }

    /**
     * Login user (regular email/password)
     */
    async login(email, password)
    {
        try
        {
            const response=await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                credentials: 'include', // Accept HTTP-only cookies from server
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password}),
            });

            const data=await response.json();

            if (!response.ok)
            {
                throw new Error(data.error||'Login failed');
            }

            // Server sets HTTP-only cookie automatically
            if (data.success&&data.data&&data.data.user)
            {
                this.setUser(data.data.user);
                return {success: true, user: data.data.user};
            }

            return {success: false, error: data.error||'Unknown error'};
        } catch (err)
        {
            console.error('[AUTH] Login error:', err);
            return {success: false, error: err.message};
        }
    }

    /**
     * Login with face recognition
     */
    async faceLogin(descriptor)
    {
        try
        {
            // Encrypt descriptor before sending (handled at request layer)
            const response=await fetch(`${API_BASE_URL}/api/auth/faceLogin`, {
                method: 'POST',
                credentials: 'include', // Accept HTTP-only cookies from server
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({descriptor}),
            });

            const data=await response.json();

            if (!response.ok)
            {
                throw new Error(data.error||'Face login failed');
            }

            // Server sets HTTP-only cookie automatically
            if (data.success&&data.data&&data.data.user)
            {
                this.setUser(data.data.user);
                return {success: true, user: data.data.user};
            }

            return {success: false, error: data.error||'Unknown error'};
        } catch (err)
        {
            console.error('[AUTH] Face login error:', err);
            return {success: false, error: err.message};
        }
    }

    /**
     * Refresh token (server handles via cookie rotation)
     */
    async refreshToken()
    {
        try
        {
            const response=await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'},
            });

            const data=await response.json();

            if (response.ok&&data.success)
            {
                // Server automatically sets new HTTP-only cookie
                return {success: true};
            }

            // Token refresh failed, user needs to re-login
            this.clearSession();
            return {success: false, error: 'Token refresh failed'};
        } catch (err)
        {
            console.error('[AUTH] Token refresh error:', err);
            this.clearSession();
            return {success: false, error: err.message};
        }
    }

    /**
     * Set authenticated user in memory
     * Only stores non-sensitive fields
     */
    setUser(userData)
    {
        // Extract only non-sensitive fields
        this.user={
            id: userData.id||userData._id,
            email: userData.email,
            role: userData.role||'candidate',
            name: userData.name||userData.username||userData.email.split('@')[0],
            avatar: userData.avatar||null,
            faceDescriptor: null, // Never store face descriptor
        };

        // Store in sessionStorage (cleared on browser close)
        try
        {
            sessionStorage.setItem('_user', JSON.stringify(this.user));
        } catch (err)
        {
            console.error('[AUTH] Failed to store user in sessionStorage:', err);
        }
    }

    /**
     * Get current user (non-sensitive data only)
     */
    getUser()
    {
        return this.user;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated()
    {
        return !!this.user&&!!this.user.id;
    }

    /**
     * Get current user role
     */
    getUserRole()
    {
        return this.user?.role||'guest';
    }

    /**
     * Check if user has specific role
     */
    hasRole(role)
    {
        return this.user?.role===role;
    }

    /**
     * Logout user and clear session
     */
    async logout()
    {
        try
        {
            // Notify server to clear HTTP-only cookie
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'},
            });
        } catch (err)
        {
            console.error('[AUTH] Logout request error:', err);
        }

        // Clear local session regardless of server response
        this.clearSession();
    }

    /**
     * Clear all session data
     */
    clearSession()
    {
        this.user=null;

        // Clear sessionStorage
        try
        {
            sessionStorage.removeItem('_user');
            sessionStorage.removeItem('practiceSession');
            sessionStorage.removeItem('interviewSession');
            sessionStorage.removeItem('aiInterviewSession');
        } catch (err)
        {
            console.error('[AUTH] Failed to clear sessionStorage:', err);
        }

        // Never touch localStorage for auth data (if it was used before, it was a security bug)
        // But we don't clear localStorage as it may contain non-auth settings
    }

    /**
     * Load user from sessionStorage on app initialization
     * Used for persistent session across page reloads (but clears on browser close)
     */
    loadFromSessionStorage()
    {
        try
        {
            const stored=sessionStorage.getItem('_user');
            if (stored)
            {
                this.user=JSON.parse(stored);
                return true;
            }
        } catch (err)
        {
            console.error('[AUTH] Failed to load user from sessionStorage:', err);
        }
        return false;
    }

    /**
     * Verify user has a specific permission (based on role)
     */
    hasPermission(permission)
    {
        const rolePermissions={
            admin: ['manage_users', 'manage_jobs', 'view_analytics', 'manage_content'],
            proctor: ['proctoring', 'view_submissions', 'manage_sessions'],
            candidate: ['take_interview', 'view_jobs', 'view_own_submissions'],
            guest: [],
        };

        const userPermissions=rolePermissions[this.user?.role]||[];
        return userPermissions.includes(permission);
    }
}

// Export singleton instance
export const authService=new AuthService();
