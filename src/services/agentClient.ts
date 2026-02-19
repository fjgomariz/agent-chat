import type { ChatRequest, ChatResponse, SSEEvent } from '../types';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const DEFAULT_CHAT_ENDPOINT = '/chat';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Get tracer for creating custom spans
const tracer = trace.getTracer('agent-chat-frontend', '1.0.0');

export class AgentClient {
  private baseUrl: string;
  private chatEndpoint: string;
  private timeout: number;

  constructor(
    baseUrl: string = import.meta.env.VITE_AGENT_API_BASE_URL || '',
    chatEndpoint: string = DEFAULT_CHAT_ENDPOINT,
    timeout: number = DEFAULT_TIMEOUT
  ) {
    this.baseUrl = baseUrl;
    this.chatEndpoint = chatEndpoint;
    this.timeout = timeout;
  }

  /**
   * Send a message to the agent API with streaming support
   * @param request Chat request payload
   * @param onChunk Callback for streaming chunks
   * @returns Promise resolving to the final response
   */
  async sendMessage(
    request: ChatRequest,
    onChunk?: (chunk: string) => void
  ): Promise<ChatResponse> {
    // Create a custom span for the chat operation
    return tracer.startActiveSpan('chat.sendMessage', async (span) => {
      try {
        // Add attributes to the span
        span.setAttribute('chat.conversationId', request.conversationId || 'new');
        span.setAttribute('chat.messageLength', request.message.length);
        span.setAttribute('chat.historyLength', request.history.length);
        span.setAttribute('chat.streaming', !!onChunk);

        const url = `${this.baseUrl}${this.chatEndpoint}`;

        // TODO: Add authentication headers here when needed
        // For API Key authentication:
        //   headers['X-API-Key'] = 'your-api-key';
        // For Azure Entra ID (Bearer token):
        //   headers['Authorization'] = `Bearer ${token}`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Try streaming first if onChunk callback is provided
        if (onChunk) {
          try {
            const response = await this.sendMessageWithStreaming(url, request, headers, onChunk);
            span.setStatus({ code: SpanStatusCode.OK });
            span.setAttribute('chat.responseLength', response.answer.length);
            return response;
          } catch (error) {
            console.warn('Streaming failed, falling back to non-streaming:', error);
            span.addEvent('streaming_fallback', {
              reason: error instanceof Error ? error.message : 'unknown',
            });
            // Fall back to non-streaming
          }
        }

        // Non-streaming request
        const response = await this.sendMessageNonStreaming(url, request, headers);
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('chat.responseLength', response.answer.length);
        return response;
      } catch (error) {
        // Record error in span
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Send message with SSE streaming
   * 
   * NOTE: EventSource does not support custom headers in its constructor.
   * If authentication is required for streaming endpoints, consider:
   * 1. Passing auth tokens as query parameters (less secure)
   * 2. Using cookies for authentication (server must set appropriate CORS)
   * 3. Implementing a server-side proxy that adds headers
   * 4. Using fetch with ReadableStream instead of EventSource
   */
  private async sendMessageWithStreaming(
    url: string,
    request: ChatRequest,
    _headers: Record<string, string>, // Headers cannot be used with EventSource
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${url}?${new URLSearchParams({
          message: request.message,
          conversationId: request.conversationId || '',
          history: JSON.stringify(request.history),
        })}`
      );

      let accumulatedAnswer = '';
      let conversationId = '';

      const cleanup = (timerId: ReturnType<typeof setTimeout> | undefined) => {
        eventSource.close();
        if (timerId) clearTimeout(timerId);
      };

      // Set timeout
      const timeoutId = setTimeout(() => {
        cleanup(undefined);
        reject(new Error('Request timeout'));
      }, this.timeout);

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          
          if (data.error) {
            cleanup(timeoutId);
            reject(new Error(data.error));
            return;
          }

          if (data.conversationId) {
            conversationId = data.conversationId;
          }

          if (data.answer) {
            accumulatedAnswer += data.answer;
            onChunk(data.answer);
          }

          if (data.done) {
            cleanup(timeoutId);
            resolve({
              conversationId: conversationId || request.conversationId || '',
              answer: accumulatedAnswer,
            });
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        cleanup(timeoutId);
        reject(new Error('SSE connection error'));
      };
    });
  }

  /**
   * Send message without streaming (standard HTTP POST)
   */
  private async sendMessageNonStreaming(
    url: string,
    request: ChatRequest,
    headers: Record<string, string>
  ): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: ChatResponse = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }
}

// Export a singleton instance
export const agentClient = new AgentClient();
