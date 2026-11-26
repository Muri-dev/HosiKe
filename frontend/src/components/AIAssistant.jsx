import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { Sparkles, Send, X, RefreshCw, Bot, User as UserIcon, Trash2 } from 'lucide-react';

function renderFormattedText(text) {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
            return <div key={idx} style={{ height: '0.45rem' }} />;
        }
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ');
        const content = isBullet ? trimmed.slice(2) : line;

        const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return (
                    <code
                        key={pIdx}
                        style={{
                            background: 'rgba(13, 148, 136, 0.1)',
                            color: '#0f766e',
                            padding: '0.08rem 0.32rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.82em',
                        }}
                    >
                        {part.slice(1, -1)}
                    </code>
                );
            }
            return part;
        });

        if (isBullet) {
            return (
                <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.2rem', marginTop: '0.2rem' }}>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>•</span>
                    <span>{parts}</span>
                </div>
            );
        }
        return (
            <div key={idx} style={{ marginTop: idx === 0 ? 0 : '0.2rem' }}>
                {parts}
            </div>
        );
    });
}

function getSummaryChips(role, summary) {
    if (!summary) return [];
    if (role === 'patient') {
        return [
            { label: 'Active Rx', value: summary.active_prescriptions ?? 0 },
            { label: 'Doses Left', value: summary.remaining_doses_total ?? 0 },
            { label: 'Upcoming Appts', value: summary.upcoming_appointments ?? 0 },
        ];
    }
    if (role === 'nurse') {
        return [
            { label: 'Queue', value: summary.queue_count ?? 0 },
            { label: 'Tasks', value: summary.pending_tasks ?? 0 },
            { label: 'Meds Due', value: summary.pending_medications ?? 0 },
        ];
    }
    if (role === 'doctor') {
        return [
            { label: 'Today', value: summary.appointments_today ?? 0 },
            { label: 'Approvals', value: summary.pending_approvals ?? 0 },
            { label: 'Vitals Review', value: summary.vitals_pending_review ?? 0 },
        ];
    }
    return [
        { label: 'Patients', value: summary.total_patients ?? 0 },
        { label: 'Today Appts', value: summary.appointments_today ?? 0 },
        { label: 'Pending', value: summary.pending_appointments ?? 0 },
    ];
}

const AIAssistant = ({ user, isOpen, setIsOpen }) => {
    const location = useLocation();
    const role = user?.role || 'patient';
    const [contextInfo, setContextInfo] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [sending, setSending] = useState(false);
    const [input, setInput] = useState('');
    const [modeLabel, setModeLabel] = useState('Live DB');
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: `Hello **${user?.first_name || user?.username || 'there'}**! I am **HosiKe AI** (${role} mode).\nAsk me anything about your live hospital data—I update automatically whenever records change.`,
        },
    ]);
    const listEndRef = useRef(null);

    const refreshContext = useCallback(async () => {
        setSyncing(true);
        try {
            const res = await api.get('/ai/context/');
            setContextInfo(res.data);
        } catch (err) {
            console.error('AI context sync failed:', err);
        } finally {
            setSyncing(false);
        }
    }, []);

    // Fetch live context on mount, on route changes, and whenever any write mutation succeeds
    useEffect(() => {
        refreshContext();
    }, [refreshContext, location.pathname]);

    useEffect(() => {
        const handleDataUpdated = () => {
            refreshContext();
        };
        window.addEventListener('hosike:data-updated', handleDataUpdated);
        return () => window.removeEventListener('hosike:data-updated', handleDataUpdated);
    }, [refreshContext]);

    // Auto-refresh every 20s while drawer is open so external staff/patient updates appear automatically
    useEffect(() => {
        if (!isOpen) return undefined;
        refreshContext();
        const timer = setInterval(refreshContext, 20000);
        return () => clearInterval(timer);
    }, [isOpen, refreshContext]);

    useEffect(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending, isOpen]);

    const sendQuestion = async (questionText) => {
        const trimmed = (questionText ?? input).trim();
        if (!trimmed || sending) return;

        const userMsg = { role: 'user', text: trimmed };
        const nextHistory = [...messages, userMsg];
        setMessages(nextHistory);
        if (questionText === undefined) setInput('');
        setSending(true);

        try {
            const res = await api.post('/ai/chat/', {
                message: trimmed,
                history: nextHistory.slice(-6),
            });
            const data = res.data;
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', text: data.reply, timestamp: data.generated_at },
            ]);
            setContextInfo({
                role: data.role,
                generated_at: data.generated_at,
                summary: data.summary,
                suggestions: data.suggestions,
            });
            const modeMap = {
                gemini: 'Gemini AI + Live DB',
                openai: 'OpenAI + Live DB',
                groq: 'Groq Llama + Live DB',
                ollama: 'Ollama + Live DB',
            };
            setModeLabel(modeMap[data.mode] || 'Smart Live AI');
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'Could not reach the HosiKe AI service right now. Please make sure the backend server is running and try again.',
                },
            ]);
        } finally {
            setSending(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendQuestion();
    };

    const resetChat = () => {
        setMessages([
            {
                role: 'assistant',
                text: `Chat cleared. I'm synced with your latest live **${role}** records—ask anything!`,
            },
        ]);
        refreshContext();
    };

    const chips = getSummaryChips(role, contextInfo?.summary);
    const suggestions = contextInfo?.suggestions || [];

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    title="Open HosiKe AI Assistant"
                    style={{
                        position: 'fixed',
                        right: '1.5rem',
                        bottom: '1.5rem',
                        zIndex: 90,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                        color: '#ffffff',
                        padding: '0.8rem 1.15rem',
                        borderRadius: '9999px',
                        boxShadow: '0 10px 25px rgba(13, 148, 136, 0.35)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                    }}
                >
                    <Sparkles size={18} />
                    <span>Ask HosiKe AI</span>
                </button>
            )}

            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        right: '1.25rem',
                        bottom: '1.25rem',
                        width: 'min(430px, calc(100vw - 2rem))',
                        height: 'min(640px, calc(100vh - 5rem))',
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.85rem',
                        boxShadow: '0 20px 50px rgba(15, 31, 46, 0.22)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 100,
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                            color: '#ffffff',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.18)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Bot size={18} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                                    HosiKe AI Assistant
                                </div>
                                <div style={{ fontSize: '0.72rem', opacity: 0.9, textTransform: 'capitalize' }}>
                                    {role} • {modeLabel}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                                onClick={refreshContext}
                                title="Sync live database now"
                                style={{
                                    background: 'rgba(255,255,255,0.16)',
                                    color: '#fff',
                                    borderRadius: '0.4rem',
                                    padding: '0.35rem',
                                    display: 'flex',
                                }}
                            >
                                <RefreshCw size={15} />
                            </button>
                            <button
                                onClick={resetChat}
                                title="Clear conversation"
                                style={{
                                    background: 'rgba(255,255,255,0.16)',
                                    color: '#fff',
                                    borderRadius: '0.4rem',
                                    padding: '0.35rem',
                                    display: 'flex',
                                }}
                            >
                                <Trash2 size={15} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                title="Close"
                                style={{
                                    background: 'rgba(255,255,255,0.16)',
                                    color: '#fff',
                                    borderRadius: '0.4rem',
                                    padding: '0.35rem',
                                    display: 'flex',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Live auto-updating status bar */}
                    <div
                        style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid var(--border-color)',
                            padding: '0.55rem 0.85rem',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: chips.length ? '0.4rem' : 0 }}>
                            <span>
                                <strong style={{ color: '#0d9488' }}>● Live</strong>{' '}
                                {syncing ? 'Syncing latest records...' : contextInfo?.generated_at ? `Synced ${contextInfo.generated_at}` : 'Connected'}
                            </span>
                            <span>Auto-updates</span>
                        </div>
                        {chips.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {chips.map((c) => (
                                    <span
                                        key={c.label}
                                        style={{
                                            fontSize: '0.72rem',
                                            background: '#ffffff',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '9999px',
                                            padding: '0.15rem 0.55rem',
                                            color: 'var(--text-main)',
                                        }}
                                    >
                                        {c.label}: <strong>{c.value}</strong>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Messages */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            background: '#ffffff',
                        }}
                    >
                        {messages.map((m, idx) => {
                            const isUser = m.role === 'user';
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        flexDirection: isUser ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isUser ? '#0f1f2e' : '#ccfbf1',
                                            color: isUser ? '#ffffff' : '#0f766e',
                                        }}
                                    >
                                        {isUser ? <UserIcon size={14} /> : <Bot size={14} />}
                                    </div>
                                    <div
                                        style={{
                                            maxWidth: '84%',
                                            padding: '0.6rem 0.8rem',
                                            borderRadius: '0.7rem',
                                            fontSize: '0.84rem',
                                            lineHeight: 1.45,
                                            background: isUser ? '#0d9488' : '#f1f5f9',
                                            color: isUser ? '#ffffff' : 'var(--text-main)',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {isUser ? m.text : renderFormattedText(m.text)}
                                    </div>
                                </div>
                            );
                        })}
                        {sending && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '2rem' }}>
                                Querying live hospital data...
                            </div>
                        )}
                        <div ref={listEndRef} />
                    </div>

                    {/* Suggested quick prompts */}
                    {suggestions.length > 0 && (
                        <div
                            style={{
                                padding: '0.45rem 0.75rem',
                                borderTop: '1px solid var(--border-color)',
                                background: '#f8fafc',
                                display: 'flex',
                                gap: '0.35rem',
                                overflowX: 'auto',
                            }}
                        >
                            {suggestions.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => sendQuestion(s)}
                                    disabled={sending}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.72rem',
                                        padding: '0.28rem 0.6rem',
                                        borderRadius: '9999px',
                                        border: '1px solid #99f6e4',
                                        background: '#f0fdfa',
                                        color: '#0f766e',
                                        fontWeight: 500,
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            padding: '0.65rem 0.75rem',
                            borderTop: '1px solid var(--border-color)',
                            background: '#ffffff',
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                        }}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={`Ask about ${role === 'patient' ? 'prescriptions, remaining doses, appointments...' : 'patients, schedule, tasks, vitals...'}`}
                            style={{
                                flex: 1,
                                padding: '0.55rem 0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.85rem',
                                outline: 'none',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={sending || !input.trim()}
                            style={{
                                background: '#0d9488',
                                color: '#ffffff',
                                padding: '0.55rem 0.8rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: sending || !input.trim() ? 0.55 : 1,
                            }}
                        >
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
