import React from 'react';

const ConversationList = ({ conversations, activeId, onSelect, onNew }) => {
    return (
        <div className="conversation-list" style={{ borderRight: '1px solid #e2e8f0', height: '100%', overflowY: 'auto' }}>
            <div className="flex-between" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0 }}>Messages</h3>
                <button className="btn-primary btn-sm" onClick={onNew}>+</button>
            </div>

            {conversations.map(conv => (
                <div
                    key={conv.id}
                    onClick={() => onSelect(conv)}
                    style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        background: activeId === conv.id ? 'var(--primary-light, #f1f5f9)' : 'transparent',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'background 0.15s',
                    }}
                    className="conversation-item"
                >
                    {/* ── Avatar / initials ── */}
                    <div style={{
                        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                        overflow: 'hidden', background: 'var(--primary-light, #e2e8f0)',
                        border: `2px solid ${activeId === conv.id ? 'var(--primary-color)' : 'transparent'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)',
                        transition: 'border-color 0.15s',
                    }}>
                        {conv.other_avatar
                            ? <img src={conv.other_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : conv.other_initials || '?'
                        }
                    </div>

                    {/* ── Text ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.display_name || 'Conversation'}
                        </div>
                        <div className="text-muted text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.last_message || 'No messages yet'}
                        </div>
                        <div className="text-muted text-xs" style={{ marginTop: '0.15rem', fontSize: '0.7rem' }}>
                            {new Date(conv.updated_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            ))}

            {conversations.length === 0 && (
                <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem' }}>
                    No conversations yet.
                </div>
            )}
        </div>
    );
};

export default ConversationList;
