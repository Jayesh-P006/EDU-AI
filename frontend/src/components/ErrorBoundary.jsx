import {Component} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

/**
 * Error Boundary component
 * Catches React errors to prevent entire app crash
 * Displays error message and recovery options
 */
class ErrorBoundary extends Component
{
    constructor(props)
    {
        super(props);
        this.state={
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        };
    }

    static getDerivedStateFromError(error)
    {
        return {hasError: true};
    }

    componentDidCatch(error, errorInfo)
    {
        console.error('[ERROR-BOUNDARY] Caught error:', error);
        console.error('[ERROR-BOUNDARY] Error info:', errorInfo);

        this.setState({
            error,
            errorInfo,
            errorId: Date.now(),
        });
    }

    resetError=() =>
    {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: null,
        });
    };

    render()
    {
        if (this.state.hasError)
        {
            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        background: '#0a0a0a',
                        color: '#fff',
                        padding: '20px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                >
                    <AlertTriangle
                        size={64}
                        color='#ef4444'
                        style={{marginBottom: '20px'}}
                    />
                    <h1 style={{fontSize: '28px', fontWeight: 'bold', marginBottom: '10px'}}>
                        Oops! Something went wrong
                    </h1>
                    <p style={{fontSize: '16px', color: '#a3a3a3', marginBottom: '20px', maxWidth: '500px', textAlign: 'center'}}>
                        We encountered an unexpected error. Don't worry, we've logged this incident.
                    </p>

                    {import.meta.env.DEV&&this.state.error&&(
                        <details
                            style={{
                                background: '#1a1a1a',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                maxWidth: '600px',
                                width: '100%',
                                cursor: 'pointer',
                                color: '#ef4444',
                            }}
                        >
                            <summary style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                Developer Details (Click to expand)
                            </summary>
                            <pre
                                style={{
                                    overflow: 'auto',
                                    fontSize: '12px',
                                    background: '#0a0a0a',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    marginTop: '10px',
                                }}
                            >
                                {this.state.error.toString()}
                                {'\n\n'}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </details>
                    )}

                    <div style={{display: 'flex', gap: '10px'}}>
                        <button
                            onClick={this.resetError}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '500',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background='#2563eb')}
                            onMouseOut={(e) => (e.currentTarget.style.background='#3b82f6')}
                        >
                            <RefreshCw size={18} />
                            Try Again
                        </button>
                        <button
                            onClick={() =>
                            {
                                window.location.href='/';
                            }}
                            style={{
                                padding: '12px 24px',
                                background: '#4b5563',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '500',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background='#5a6b7a')}
                            onMouseOut={(e) => (e.currentTarget.style.background='#4b5563')}
                        >
                            Go Home
                        </button>
                    </div>

                    <p style={{fontSize: '12px', color: '#737373', marginTop: '30px'}}>
                        Error ID: {this.state.errorId}
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
