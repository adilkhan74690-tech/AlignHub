import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { Message, User } from '../types';
import { Send, MessageCircle, AlertCircle, Sparkles } from 'lucide-react';
import Avatar from './Avatar';

interface TeamChatProps {
  workspaceId: string;
  initialMessages: Message[];
  currentUser: User;
}

export default function TeamChat({ workspaceId, initialMessages, currentUser }: TeamChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const socket = getSocket();

  // Load initial messages and setup sockets
  useEffect(() => {
    setMessages(initialMessages);

    // Join channel
    socket.emit('join_workspace', { workspaceId });

    // Listen to new incoming messages
    socket.on('new_message', (msg: Message) => {
      if (msg.workspaceId === workspaceId) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    });

    // Listen to typing events
    socket.on('typing_started', ({ userId, name }: { userId: string; name: string }) => {
      if (userId !== currentUser.id) {
        setTypingUsers(prev => {
          if (prev.some(u => u.userId === userId)) return prev;
          return [...prev, { userId, name }];
        });
      }
    });

    socket.on('typing_stopped', ({ userId }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    });

    return () => {
      socket.emit('leave_workspace', { workspaceId });
      socket.off('new_message');
      socket.off('typing_started');
      socket.off('typing_stopped');
    };
  }, [workspaceId, initialMessages]);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    // Typing state management
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { workspaceId });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing_stop', { workspaceId });
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    // Send via socket
    socket.emit('send_message', { workspaceId, content: content.trim() });
    setContent('');

    // Clear typing timeout and emit typing stop immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    socket.emit('typing_stop', { workspaceId });
  };

  return (
    <div className="bg-white/0 flex flex-col h-full flex-1" id="team-chat-panel">
      {/* Tab Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-xl">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900 text-sm">Real-Time Team Room</h3>
          <p className="text-slate-400 text-[10px] font-medium leading-none mt-1">Connect with members instantly</p>
        </div>
      </div>

      {/* Messages Scroll Box */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scroll-smooth" id="chat-messages-container">
        {messages.length === 0 ? (
          <div className="text-center py-24 text-slate-400 space-y-2">
            <MessageCircle className="w-10 h-10 mx-auto opacity-35" />
            <p className="text-xs font-semibold">Start the Conversation!</p>
            <p className="text-[10px] opacity-75">Send a quick message to coordinate roles, discuss deadlines, or align project objectives.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUser.id;
            return (
              <div
                key={msg._id}
                className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                id={`chat-msg-${msg._id}`}
              >
                <Avatar
                  name={msg.userName}
                  size="sm"
                  className="self-end shadow-sm"
                />

                {/* Message Bubble wrapper */}
                <div className={`space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                  {!isMe && (
                    <span className="text-[10px] font-bold text-slate-600 px-1">{msg.userName}</span>
                  )}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${
                      isMe
                        ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-none shadow-md shadow-indigo-100'
                        : 'bg-gradient-to-tr from-slate-100 to-slate-50 text-slate-800 rounded-bl-none border border-slate-200/40'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 px-1.5 block">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicators Bubble */}
        {typingUsers.map((u) => (
          <div key={u.userId} className="flex gap-2 items-center text-[10px] text-slate-400 italic font-medium pl-3 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>{u.name} is typing...</span>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSendMessage} className="flex gap-3" id="chat-input-form">
        <input
          type="text"
          value={content}
          onChange={handleInputChange}
          placeholder="Type your message here..."
          className="flex-1 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors min-h-[44px]"
        />
        <button
          type="submit"
          disabled={!content.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-3.5 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer shadow-md shadow-indigo-100"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
