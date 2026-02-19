// Type definitions for the chat application

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  history: Message[];
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
}

export interface ConversationState {
  conversationId?: string;
  messages: Message[];
}

export interface AgentClientConfig {
  baseUrl: string;
  chatEndpoint?: string;
  timeout?: number;
}

// SSE event data structure
export interface SSEEvent {
  conversationId?: string;
  answer?: string;
  error?: string;
  done?: boolean;
}
