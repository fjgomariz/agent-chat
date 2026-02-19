import React, { useState, useEffect, useRef } from 'react';
import type { Message, ConversationState } from '../types';
import { agentClient } from '../services/agentClient';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

const STORAGE_KEY = 'agent-chat-conversation';

export const Chat: React.FC = () => {
  const [conversation, setConversation] = useState<ConversationState>({
    messages: [],
  });
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        parsed.messages = parsed.messages.map((msg: Message) => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
        }));
        setConversation(parsed);
      }
    } catch (error) {
      console.error('Error loading conversation from localStorage:', error);
    }
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch (error) {
      console.error('Error saving conversation to localStorage:', error);
    }
  }, [conversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, isTyping, streamingMessage]);

  const handleSendMessage = async (messageText: string) => {
    setError(null);
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    setIsTyping(true);
    setStreamingMessage('');

    try {
      // Prepare history (exclude timestamps for API)
      const history = conversation.messages.map(({ role, content }) => ({
        role,
        content,
      }));

      // Send message with streaming callback
      const response = await agentClient.sendMessage(
        {
          conversationId: conversation.conversationId,
          message: messageText,
          history,
        },
        (chunk) => {
          // Handle streaming chunk
          setStreamingMessage((prev) => prev + chunk);
        }
      );

      // Add assistant message - use response.answer which contains the full message
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setConversation((prev) => ({
        conversationId: response.conversationId,
        messages: [...prev.messages, assistantMessage],
      }));

      setStreamingMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to send message. Please try again.'
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setConversation({ messages: [] });
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleRetry = () => {
    setError(null);
    // Get the last user message and resend it
    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find((msg) => msg.role === 'user');
    
    if (lastUserMessage) {
      // Remove the last user message and retry
      setConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -1),
      }));
      handleSendMessage(lastUserMessage.content);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Agent Chat
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Powered by Azure Container Apps
            </p>
          </div>
          {conversation.messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {conversation.messages.length === 0 && !isTyping && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Start a Conversation
              </h2>
              <p className="text-gray-600">
                Send a message to begin chatting with the AI agent
              </p>
            </div>
          </div>
        )}

        {conversation.messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {isTyping && (
          streamingMessage ? (
            <MessageBubble 
              message={{ 
                role: 'assistant', 
                content: streamingMessage,
                timestamp: new Date()
              }} 
            />
          ) : (
            <TypingIndicator />
          )
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={handleRetry}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isTyping} />
    </div>
  );
};
