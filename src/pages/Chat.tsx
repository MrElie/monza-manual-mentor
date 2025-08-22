import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  MessageSquare, 
  Camera, 
  Mic, 
  ArrowLeft, 
  Loader2,
  User,
  Bot
} from 'lucide-react';
import { CarModel, ChatSession, ChatMessage } from '@/types/database';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder from '@/components/VoiceRecorder';
import LanguageSelector from '@/components/LanguageSelector';

const Chat = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [model, setModel] = useState<CarModel | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modelId) {
      fetchModel();
      createOrGetSession();
    }
  }, [modelId, user]);

  useEffect(() => {
    if (session) {
      fetchMessages();
    }
  }, [session]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchModel = async () => {
    if (!modelId) return;

    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('*, brand:car_brands(*)')
        .eq('id', modelId)
        .single();

      if (error) throw error;
      setModel(data);
    } catch (error) {
      console.error('Error fetching model:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to load vehicle model',
        variant: 'destructive'
      });
    }
  };

  const createOrGetSession = async () => {
    if (!user || !modelId) return;

    try {
      // Check for existing session
      const { data: existingSessions } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('model_id', modelId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingSessions && existingSessions.length > 0) {
        setSession(existingSessions[0]);
      } else {
        // Create new session
        const { data: newSession, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            model_id: modelId,
            title: `${model?.display_name || 'Vehicle'} Repair Chat`
          })
          .select()
          .single();

        if (error) throw error;
        setSession(newSession);
      }
    } catch (error) {
      console.error('Error creating/getting session:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to initialize chat session',
        variant: 'destructive'
      });
    }
  };

  const fetchMessages = async () => {
    if (!session) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data?.map((msg: any) => ({
        ...msg,
        role: msg.role as 'user' | 'assistant'
      })) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim() || !session || loading) return;

    setLoading(true);
    
    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: session.id,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      // Get AI response
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          message: messageText,
          modelId: model?.id,
          sessionId: session.id,
          language: document.documentElement.lang || 'en'
        }
      });

      if (error) throw error;

      // Refresh messages to get the saved ones with proper IDs
      await fetchMessages();

      toast({
        title: t('common.success'),
        description: 'Message sent successfully'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to send message',
        variant: 'destructive'
      });
      
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageAnalysis = (analysis: string) => {
    const analysisMessage = `Image Analysis Result:\n\n${analysis}`;
    sendMessage(analysisMessage);
    setActiveTab('text');
  };

  const handleVoiceTranscription = (text: string) => {
    if (text.trim()) {
      sendMessage(text);
      setActiveTab('text');
    }
  };

  if (!model) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Button>
              <div>
                <h1 className="font-semibold text-lg">
                  {model.brand?.display_name} {model.display_name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('chat.title')}
                </p>
              </div>
            </div>
            <LanguageSelector />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.length === 0 && (
                <Card className="text-center py-8">
                  <CardContent>
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      Welcome to your repair assistant!
                    </h3>
                    <p className="text-muted-foreground">
                      Ask questions about your {model.display_name}, share images, or use voice commands.
                    </p>
                  </CardContent>
                </Card>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <div className={`flex-1 max-w-xs sm:max-w-md lg:max-w-lg ${
                    message.role === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    <Badge 
                      variant={message.role === 'user' ? 'default' : 'secondary'}
                      className="mb-2"
                    >
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </Badge>
                    <Card className={message.role === 'user' ? 'bg-primary text-primary-foreground' : ''}>
                      <CardContent className="p-3">
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap m-0">{message.content}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Badge variant="secondary" className="mb-2">Assistant</Badge>
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            {t('chat.processing')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-background p-4">
            <div className="max-w-4xl mx-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('chat.textMode')}
                  </TabsTrigger>
                  <TabsTrigger value="camera">
                    <Camera className="h-4 w-4 mr-2" />
                    {t('navigation.camera')}
                  </TabsTrigger>
                  <TabsTrigger value="voice">
                    <Mic className="h-4 w-4 mr-2" />
                    {t('navigation.voice')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-4">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={t('chat.typeMessage')}
                      disabled={loading}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => sendMessage()}
                      disabled={!inputMessage.trim() || loading}
                      className="bg-[var(--automotive-gradient)]"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="camera" className="mt-4">
                  <CameraCapture
                    onImageAnalysis={handleImageAnalysis}
                    modelId={model.id}
                  />
                </TabsContent>

                <TabsContent value="voice" className="mt-4">
                  <VoiceRecorder
                    onTranscription={handleVoiceTranscription}
                    modelId={model.id}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;