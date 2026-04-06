import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, BrainCircuit, Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from "@/lib/utils";
import { SimpleAgent, type AgentMessage } from "@/lib/agent";

interface ChatSession {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
}

const agent = new SimpleAgent();

const Chat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse sessions', e);
      }
    }
    return [{
      id: 'default',
      title: '新对话',
      messages: [{ role: 'assistant', content: '你好！我是你的 AI 助手。有什么我可以帮你的吗？' }],
      createdAt: Date.now()
    }];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(sessions[0]?.id || 'default');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_DASHSCOPE_API_KEY;
    if (!key || key === 'your_api_key_here') {
      setApiKeyMissing(true);
    }
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [currentSession?.messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [{ role: 'assistant', content: '你好！我是新对话。有什么我可以帮你的吗？' }],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length === 1) return;
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions[0].id);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    if (currentSession.title === '新对话') {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, title: userInput.slice(0, 20) } : s
      ));
    }

    const initialHistory = [...currentSession.messages];
    await agent.process(userInput, initialHistory, (updatedMessages) => {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId ? { ...s, messages: updatedMessages } : s
      ));
    });
    
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "bg-secondary/30 border-r transition-all duration-300 ease-in-out flex flex-col",
        isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
      )}>
        <div className="p-4 flex flex-col h-full w-72">
          <Button onClick={createNewSession} variant="outline" className="w-full flex justify-start gap-2 mb-6 bg-background shadow-sm hover:shadow-md transition-all">
            <Plus size={18} />
            <span className="font-medium">开启新对话</span>
          </Button>
          
          {apiKeyMissing && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 leading-snug">
              <p className="font-bold mb-1">⚠️ 未配置 API Key</p>
              请在 <code className="bg-amber-100 px-1 rounded">.env.local</code> 中填入通义千问 Key。
            </div>
          )}
          
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">历史会话</h3>
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm",
                    currentSessionId === s.id 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare size={16} className="shrink-0" />
                  <span className="flex-1 truncate font-medium">{s.title}</span>
                  <Trash2 
                    size={14} 
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      currentSessionId === s.id ? "hover:text-red-300" : "hover:text-destructive"
                    )}
                    onClick={(e) => deleteSession(e, s.id)}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header */}
        <header className="h-16 border-b flex items-center px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hover:bg-secondary rounded-full"
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="font-semibold text-lg truncate max-w-md">{currentSession.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold">AI Assistant</span>
              <span className="text-[10px] text-green-500 font-medium animate-pulse">Online</span>
            </div>
            <Avatar className="w-10 h-10 border-2 border-white shadow-sm ring-1 ring-border/50">
              <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=Assistant&backgroundColor=c0aede" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot size={20} />
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Message Container - Centered Content */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="max-w-3xl mx-auto py-10 px-6 space-y-8">
              {currentSession.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="w-10 h-10 border-2 border-white shadow-md shrink-0 ring-1 ring-border/50">
                    {m.role === 'user' ? (
                      <>
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=User&backgroundColor=b6e3f4`} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                          <User size={18} />
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage src={m.role === 'thought' ? "" : `https://api.dicebear.com/7.x/bottts/svg?seed=Assistant&backgroundColor=c0aede`} />
                        <AvatarFallback className={cn(
                          m.role === 'thought' ? "bg-amber-100 text-amber-600" : "bg-primary text-primary-foreground"
                        )}>
                          {m.role === 'thought' ? <BrainCircuit size={18} /> : <Bot size={18} />}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  
                  <div className={cn(
                    "flex flex-col gap-1 max-w-[85%] overflow-hidden",
                    m.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "rounded-2xl px-5 py-3 shadow-sm leading-relaxed text-[15px] w-full",
                      m.role === 'user' 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : m.role === 'thought' 
                          ? "bg-amber-50/80 text-amber-700 italic border border-amber-100 rounded-tl-none flex items-center gap-2" 
                          : "bg-secondary/50 text-foreground border border-border/50 rounded-tl-none prose prose-slate max-w-none dark:prose-invert"
                    )}>
                      {m.role === 'thought' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />}
                      {m.role === 'assistant' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneLight}
                                  language={match[1]}
                                  PreTag="div"
                                  customStyle={{ margin: 0, padding: '1rem', borderRadius: '0.5rem', background: '#f8fafc' }}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={cn("bg-slate-100 px-1 rounded text-pink-600", className)} {...props}>
                                  {children}
                                </code>
                              );
                            },
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-4">
                                <table className="border-collapse border border-slate-200 w-full text-sm">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-bold">{children}</th>,
                            td: ({ children }) => <td className="border border-slate-200 px-3 py-2">{children}</td>,
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Centered Content */}
        <footer className="p-6 md:p-8 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0">
          <div className="max-w-3xl mx-auto w-full relative group">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-end bg-background border border-input rounded-2xl shadow-xl focus-within:ring-2 focus-within:ring-primary/20 transition-all p-2 pr-3"
            >
              <Input
                placeholder="发送消息给 AI..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 border-none shadow-none focus-visible:ring-0 min-h-[56px] text-base px-4 bg-transparent resize-none"
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-10 w-10 rounded-xl shadow-md shrink-0 mb-1" 
                disabled={isLoading || !input.trim()}
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground text-center mt-3 tracking-wide">
              基于 Shadcn UI 构建的智能 Agent 系统 · 支持多轮对话与历史持久化
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Chat;
