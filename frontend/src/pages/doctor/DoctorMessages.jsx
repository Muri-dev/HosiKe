import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import { Send, User, Search } from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const DoctorMessages = () => {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // Fetch conversations (all users I have talked to)
    const fetchConversations = async () => {
        try {
            const response = await api.get('/conversations/');
            setConversations(response.data);
            if (!activeConversation && response.data.length > 0) {
                setActiveConversation(response.data[0]);
            }
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch messages for active conversation
    const fetchMessages = async () => {
        if (!activeConversation) return;
        try {
            const response = await api.get(`/conversations/${activeConversation.id}/messages/`);
            setMessages(response.data);
            scrollToBottom();
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeConversation) return;
        try {
            await api.post(`/conversations/${activeConversation.id}/messages/`, { content: newMessage });
            setNewMessage('');
            fetchMessages(); // Refresh
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [activeConversation]);

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="grid-2" style={{ height: 'calc(100vh - 100px)', gap: '0' }}>
            {/* Sidebar List */}
            <div className="card" style={{ borderRadius: 'var(--radius) 0 0 var(--radius)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div className="p-1 border-bottom">
                    <h3>Messages</h3>
                    <div className="search-bar" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f0f2f5', padding: '0.5rem', borderRadius: 'var(--radius)' }}>
                        <Search size={16} />
                        <input placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none' }} />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setActiveConversation(conv)}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                background: activeConversation?.id === conv.id ? '#f0f9ff' : 'transparent'
                            }}
                        >
                            <div className="flex-between">
                                <strong>Conversation {conv.id}</strong> {/* Replace with participant name if available */}
                                <span className="text-xs text-muted">{new Date(conv.updated_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-muted text-truncate">Click to view messages</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="card" style={{ borderRadius: '0 var(--radius) var(--radius) 0', display: 'flex', flexDirection: 'column' }}>
                {activeConversation ? (
                    <>
                        <div className="p-1 border-bottom bg-light">
                            <strong>Chat</strong>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8f9fa' }}>
                            {messages.map((msg, idx) => (
                                <div key={idx} style={{
                                    textAlign: msg.sender_id === 1 ? 'right' : 'left', // Need to know 'me' ID, simplified here
                                    marginBottom: '0.5rem'
                                }}>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '1rem',
                                        background: '#fff',
                                        border: '1px solid #e1e4e8',
                                        maxWidth: '70%'
                                    }}>
                                        <div className="text-xs text-muted mb-0">{msg.sender}</div>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-1 border-top flex-between gap-1">
                            <input
                                className="form-control"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button className="btn-primary btn-icon" onClick={handleSendMessage}><Send size={18} /></button>
                        </div>
                    </>
                ) : (
                    <div className="center-content h-100 text-muted">Select a conversation</div>
                )}
            </div>
        </div>
    );
};

export default DoctorMessages;
