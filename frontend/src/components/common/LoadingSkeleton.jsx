import React from 'react';

const LoadingSkeleton = ({ lines = 3, height = '20px', width = '100%', style = {} }) => {
    const skeletonStyle = {
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        marginBottom: '10px',
        animation: 'pulse 1.5s infinite ease-in-out',
        ...style
    };

    return (
        <div className="skeleton-wrapper" style={{ width }}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        ...skeletonStyle,
                        height,
                        width: i === lines - 1 && lines > 1 ? '70%' : '100%' // Last line shorter
                    }}
                />
            ))}
            <style>{`
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
};

export default LoadingSkeleton;
