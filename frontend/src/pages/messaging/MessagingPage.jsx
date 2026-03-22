import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import Modal from '../../components/common/Modal';

const MessagingPage = ({ embedded = false }) => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // New Conversation
    const [showNewModal, setShowNewModal] = useState(false);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchConversations = async () => {
        try {
            const response = await api.get('/conversations/');
            // Enhance data with display logic
            const formatted = response.data.map(c => {
                const other = c.participants.find(p => p.username !== user?.username) || c.participants[0] || { username: 'Unknown' };
                return {
                    ...c,
                    display_name: `${other.first_name} ${other.last_name}`.trim() || other.username,
                    display_name_full: `${other.first_name} ${other.last_name} (${other.role})`.trim() || other.username,
                    other_avatar: other.avatar || null,
                    other_initials: (other.first_name?.[0] || other.username?.[0] || '?').toUpperCase(),
                };
            });
            setConversations(formatted);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMessages = async (convId) => {
        setLoadingMessages(true);
        try {
            const response = await api.get(`/conversations/${convId}/messages/`);
            const msgs = response.data.map(m => ({
                ...m,
                is_me: m.sender_name === user.username // simplified check
            }));
            setMessages(msgs);
        } catch (error) {
            console.error(error);
        }
        setLoadingMessages(false);
    };

    const handleSelectConversation = async (conv) => {
        setActiveConv(conv);
        fetchMessages(conv.id);
        // Mark read
        try {
            await api.post(`/conversations/${conv.id}/mark-read/`);
            // Optionally trigger a global refresh of unread count if we had a context for it
        } catch (e) { console.error(e); }
    };

    const handleSendMessage = async (content) => {
        try {
            const response = await api.post(`/conversations/${activeConv.id}/messages/`, { content });
            const newMsg = { ...response.data, is_me: true };
            setMessages([...messages, newMsg]);
            // update conversation last updated?
            fetchConversations();
        } catch (error) {
            alert("Failed to send");
        }
    };

    const handleNewConversation = async (recipientId) => {
        try {
            const response = await api.post('/conversations/start/', { recipient_id: recipientId });
            setShowNewModal(false);
            fetchConversations();
            // Select it?
            handleSelectConversation(response.data); // might need formatting
        } catch (error) {
            alert("Failed to start conversation");
        }
    };

    // Search users for new conversation
    const searchUsers = async () => {
        try {
            // Need a search endpoint or filter users. Admin has users endpoint, but regular users?
            // Maybe expose a simple user search for all authenticated users?
            // "search web" isn't it.
            // Let's assume we can query /admin/users if admin, but others?
            // I might need a public 'search users' endpoint.
            // For now, let's use a dummy list or try user endpoint if role allows.
            // Actually, `UserViewSet` is Admin only.
            // I need a generic 'user search' endpoint for messaging.
            // I'll leave this empty for now or add to backend.
        } catch (error) { }
    };

    useEffect(() => {
        fetchConversations();
        // Poll for new messages?
        const interval = setInterval(() => {
            if (activeConv) fetchMessages(activeConv.id);
            fetchConversations();
        }, 10000); // 10s polling
        return () => clearInterval(interval);
    }, [activeConv]);

    return (
        <div style={{ display: 'flex', height: embedded ? '100%' : 'calc(100vh - 100px)', border: embedded ? 'none' : '1px solid #e2e8f0', borderRadius: embedded ? 0 : '0.5rem', background: 'white' }}>
            <div style={{ width: '300px' }}>
                <ConversationList
                    conversations={conversations}
                    activeId={activeConv?.id}
                    onSelect={handleSelectConversation}
                    onNew={() => setShowNewModal(true)}
                />
            </div>
            <div style={{ flex: 1 }}>
                <ChatWindow
                    conversation={activeConv}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    loading={loadingMessages}
                />
            </div>

            <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Message">
                <div>
                    <div className="form-group mb-1">
                        <label>Search User</label>
                        <input
                            placeholder="Type name or role..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (e.target.value.length > 1) {
                                    api.get(`/search/users/?q=${e.target.value}`)
                                        .then(res => setUsers(res.data))
                                        .catch(console.error);
                                } else {
                                    setUsers([]);
                                }
                            }}
                            className="form-control"
                        />
                    </div>

                    <div className="user-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {users.map(u => (
                            <div
                                key={u.id}
                                onClick={() => handleNewConversation(u.id)}
                                style={{
                                    padding: '0.75rem',
                                    borderBottom: '1px solid #eee',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                                className="user-item hover-bg-light"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                        overflow: 'hidden', background: '#e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)',
                                        border: '2px solid var(--border-color)',
                                    }}>
                                        {u.avatar
                                            ? <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : (u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()
                                        }
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</div>
                                        <div className="text-sm text-muted">@{u.username} • <span className="badge">{u.role}</span></div>
                                    </div>
                                </div>
                                <button className="btn-sm btn-secondary">Message</button>
                            </div>
                        ))}
                        {users.length === 0 && searchQuery.length > 1 && (
                            <p className="text-center text-muted">No users found.</p>
                        )}
                        {searchQuery.length <= 1 && (
                            <p className="text-center text-muted text-sm">Type to search...</p>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MessagingPage;
