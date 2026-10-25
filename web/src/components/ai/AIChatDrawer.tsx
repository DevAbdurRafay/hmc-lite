import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { Badge } from '../common/Badge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ai_generated?: boolean;
}

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your HCM Lite AI Assistant. How can I assist you with company policies, attendance data, or leave planning today?`,
      ai_generated: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const role = user?.role || 'EMPLOYEE';

  const suggestedPrompts = {
    ADMIN: [
      'What is our headcount and attrition rate?',
      'Summarize monthly payroll cost',
      'What is this month\'s attendance rate?',
    ],
    HR: [
      'Who came late most often this month?',
      'What is this month\'s attendance rate?',
      'How many employees are currently active?',
    ],
    EMPLOYEE: [
      'How many sick leaves do I have left?',
      'What are the official office hours and grace period?',
      'I need next Monday and Tuesday off for a wedding',
    ],
  }[role] || [];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const response = await apiFetch<{ response: string; ai_generated: boolean }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      });

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          ai_generated: response.ai_generated,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: err.message || 'Unable to connect to AI service. Please try again.',
          ai_generated: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="relative w-full sm:w-[480px] h-full glass-panel border-l border-white/15 p-5 sm:p-6 z-10 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 light:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white light:text-slate-900">HCM Assistant</h3>
                <Badge variant="purple" size="sm">Active</Badge>
              </div>
              <p className="text-xs text-slate-400 light:text-slate-500">Live Database Grounding • Roman Urdu Enabled</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                    : 'glass-card text-slate-200 light:text-slate-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.ai_generated && (
                  <div className="mt-2 pt-1 border-t border-white/10 text-[10px] text-purple-300/80 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> AI-generated • Grounded in system rules
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                <Bot className="w-4 h-4" />
              </div>
              <div className="glass-card rounded-2xl p-3 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Assistant is querying database...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts & Input Box */}
        <div className="pt-3 border-t border-white/10 light:border-slate-200">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] border border-white/10 transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask assistant or type Roman Urdu..."
              className="flex-1 glass-input px-3.5 py-2.5 text-xs sm:text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium disabled:opacity-40 transition-all flex items-center justify-center min-h-[44px]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
