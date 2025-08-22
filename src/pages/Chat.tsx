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
  Bot,
  Trash2
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
      // Only fetch messages on initial load, not after every change
      fetchMessages();
    }
  }, [session?.id]); // Only re-run when session ID changes

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
      console.log('Fetching messages for session:', session.id);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
      
      console.log('Fetched messages:', data);
      const formattedMessages = data?.map((msg: any) => ({
        ...msg,
        role: msg.role as 'user' | 'assistant'
      })) || [];
      
      setMessages(formattedMessages);
      console.log('Set messages in state:', formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim() || !session || loading) return;

    setLoading(true);
    
    // Add user message to UI immediately  
    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      session_id: session.id,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      console.log('Sending message to chat-completion function:', messageText);
      
      // Get AI response
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          message: messageText,
          modelId: model?.id,
          sessionId: session.id,
          language: document.documentElement.lang || 'en'
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      // Add assistant response immediately
      if (data?.response) {
        console.log('Adding assistant response to UI:', data.response);
        const assistantMessage: ChatMessage = {
          id: `temp-assistant-${Date.now()}`,
          session_id: session.id,
          role: 'assistant',
          content: data.response,
          created_at: new Date().toISOString(),
          sources: data.images && data.images.length > 0 ? { images: data.images } : null
        };
        
        // Add assistant response without removing user message
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        console.warn('No response in data:', data);
        throw new Error('No response received from assistant');
      }

      // Don't do automatic background sync - let user manually refresh if needed
      console.log('Message exchange completed successfully');

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('common.error'),
        description: `Failed to send message: ${error.message || 'Unknown error'}`,
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

  const clearChat = async () => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', session.id);

      if (error) throw error;

      setMessages([]);
      toast({
        title: t('common.success'),
        description: 'Chat cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to clear chat',
        variant: 'destructive'
      });
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChat}
                  disabled={messages.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat
                </Button>
                <LanguageSelector />
              </div>
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
                        {message.sources?.images && message.sources.images.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-sm font-medium mb-2">📋 Related Diagrams:</p>
                            <div className="space-y-2">
                              {message.sources.images.map((image: any, index: number) => (
                                <div key={index} className="text-xs bg-muted p-2 rounded">
                                  <p className="font-medium">{image.description}</p>
                                  {image.page && <p className="text-muted-foreground">Page {image.page}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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