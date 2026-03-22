import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

const ChatWindow = ({ conversation, messages, onSendMessage, loading }) => {
    const [newMessage, setNewMessage] = useState('');
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        onSendMessage(newMessage);
        setNewMessage('');
    };

    if (!conversation) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>Select a conversation to start chatting</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <strong>{conversation.display_name}</strong>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {loading ? <p>Loading messages...</p> : messages.map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            alignSelf: msg.is_me ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            background: msg.is_me ? 'var(--primary-color)' : '#eff6ff',
                            color: msg.is_me ? 'white' : 'inherit',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            borderBottomRightRadius: msg.is_me ? 0 : '0.5rem',
                            borderBottomLeftRadius: !msg.is_me ? 0 : '0.5rem'
                        }}
                    >
                        <div style={{ fontSize: '0.9rem' }}>{msg.content}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem', textAlign: 'right' }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    className="form-control"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem' }}
                />
                <button type="submit" className="btn-primary" disabled={!newMessage.trim()} style={{ padding: '0', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                    <Send size={24} />
                </button>
            </form>
        </div>
    );
};

export default ChatWindow;
