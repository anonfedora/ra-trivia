export default function Custom500() {
    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f8fafc',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                border: '1px solid #e2e8f0'
            }}>
                <h1 style={{ 
                    fontSize: '24px', 
                    fontWeight: 'bold', 
                    color: '#1e293b',
                    marginBottom: '16px'
                }}>
                    500 - Server Error
                </h1>
                <p style={{ 
                    color: '#64748b', 
                    marginBottom: '24px',
                    lineHeight: '1.5'
                }}>
                    An unexpected error occurred. Please try again later.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    Reload Page
                </button>
            </div>
        </div>
    );
}
