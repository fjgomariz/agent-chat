# AI Agent Chat Frontend

A polished React web frontend that implements a classic chat interface (question/answer) for interacting with an AI Agent API hosted in Azure Container Apps.

## Features

- 🎨 **Clean, Modern UI**: Beautiful chat interface with left/right message bubbles
- ⚡ **Real-time Streaming**: Support for Server-Sent Events (SSE) streaming responses
- 💾 **Persistent History**: Conversation history saved in localStorage
- 🔄 **Smart Fallback**: Automatic fallback to non-streaming if streaming fails
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- ⌨️ **Keyboard Shortcuts**: Press Enter to send, Shift+Enter for new line
- 🔔 **Error Handling**: User-friendly error messages with retry functionality
- 📊 **Telemetry**: OpenTelemetry integration with Azure Application Insights for distributed tracing
- 🐳 **Containerized**: Production-ready Docker setup with nginx
- 🚀 **CI/CD Ready**: GitHub Actions workflow for automated deployment

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for styling
- **OpenTelemetry** with Azure Application Insights for distributed tracing
- **Azure Container Apps** for hosting
- **Docker** with multi-stage builds
- **nginx** for serving the SPA

## Project Structure

```
agent-chat/
├── src/
│   ├── components/
│   │   ├── Chat.tsx              # Main chat component
│   │   ├── MessageBubble.tsx     # Individual message display
│   │   ├── ChatInput.tsx         # Input box and send button
│   │   └── TypingIndicator.tsx   # "Assistant is typing..." indicator
│   ├── services/
│   │   └── agentClient.ts        # API client for agent endpoint
│   ├── telemetry.ts              # OpenTelemetry configuration
│   ├── types.ts                  # TypeScript type definitions
│   ├── App.tsx                   # Root application component
│   └── main.tsx                  # Application entry point
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD pipeline
├── Dockerfile                    # Multi-stage Docker build
├── nginx.conf                    # nginx configuration for SPA
└── README.md
```

## Local Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/fjgomariz/agent-chat.git
cd agent-chat
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
VITE_AGENT_API_BASE_URL=https://your-agent-api.azurecontainerapps.io
```

4. **Run the development server**

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_AGENT_API_BASE_URL` | Base URL of the AI Agent API | Yes | - |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Application Insights connection string for telemetry | No | - |

### Build-time vs Runtime Configuration

⚠️ **Important**: Vite environment variables are embedded at **build time**, not runtime. This means:

- For local development: Use `.env` file
- For Docker: Pass environment variables during the **build** stage
- For Azure Container Apps: Set environment variables in the container app configuration, but rebuild the image when changing the API URL

If you need runtime configuration, consider one of these approaches:
1. Inject the URL through a `config.js` file served by nginx
2. Use a backend proxy to avoid CORS
3. Rebuild and redeploy when the API URL changes

## Application Telemetry

The application includes built-in telemetry using **OpenTelemetry** and **Azure Application Insights** for distributed tracing and monitoring.

### Features

- **Automatic HTTP Tracing**: All fetch API calls are automatically instrumented
- **Request Correlation**: Traces are correlated between frontend and backend using W3C Trace Context headers
- **Custom Spans**: Chat operations include custom spans with detailed attributes
- **Error Tracking**: Exceptions and errors are automatically captured
- **Performance Monitoring**: Request durations and response times are tracked

### Configuration

To enable telemetry, set the Application Insights connection string:

```env
VITE_APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://your-region.in.applicationinsights.azure.com/
```

**Getting the Connection String:**

1. Go to Azure Portal
2. Navigate to your Application Insights resource
3. Click on **Overview** in the left menu
4. Copy the **Connection String** value

### How It Works

The telemetry system:

1. **Initializes on Startup**: OpenTelemetry is configured in `src/telemetry.ts` and initialized before the React app renders
2. **Instruments Fetch API**: The `FetchInstrumentation` automatically creates spans for all HTTP requests
3. **Propagates Context**: W3C Trace Context headers (`traceparent`, `tracestate`) are added to outgoing requests
4. **Creates Custom Spans**: The `AgentClient` creates custom spans for chat operations with attributes like message length, conversation ID, and streaming status
5. **Exports to Azure**: Telemetry data is batched and sent to Azure Application Insights

### Viewing Telemetry Data

In Azure Application Insights:

1. **Transaction Search**: View individual requests and traces
2. **Application Map**: See dependencies and correlations between frontend and backend
3. **Performance**: Analyze response times and identify bottlenecks
4. **Failures**: Track errors and exceptions
5. **Live Metrics**: Monitor real-time telemetry

### Request Correlation

When the frontend calls the backend API, the OpenTelemetry instrumentation automatically:

1. Creates a span for the HTTP request
2. Generates a unique trace ID and span ID
3. Adds `traceparent` header to the request: `00-<trace-id>-<span-id>-01`
4. The backend (if instrumented with OpenTelemetry) reads this header and creates child spans with the same trace ID

This creates a distributed trace that shows the complete request flow from frontend to backend.

### Disabling Telemetry

If you don't want to use telemetry:

1. Simply omit the `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable
2. The application will log a warning and continue without telemetry
3. No telemetry data will be collected or sent

## Backend Integration

### API Contract

The frontend integrates with your AI Agent API using the following contract:

**Endpoint**: `POST {VITE_AGENT_API_BASE_URL}/chat`

**Request Format**:
```json
{
  "conversationId": "<string | optional>",
  "message": "<user text>",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response Format** (Non-streaming):
```json
{
  "conversationId": "<string>",
  "answer": "<assistant text>"
}
```

**Response Format** (SSE Streaming):
```
data: {"conversationId": "abc123", "answer": "chunk1"}
data: {"answer": "chunk2"}
data: {"answer": "chunk3", "done": true}
```

### Authentication

Currently configured for **public endpoints** (no authentication). To add authentication:

1. **API Key Authentication**:

Edit `src/services/agentClient.ts` and uncomment:
```typescript
headers['X-API-Key'] = 'your-api-key';
```

2. **Azure Entra ID (Bearer Token)**:

Edit `src/services/agentClient.ts` and uncomment:
```typescript
headers['Authorization'] = `Bearer ${token}`;
```

Then integrate with MSAL.js or your preferred auth library to obtain the token.

## Docker

### Build Locally

```bash
docker build -t agent-chat-frontend .
```

### Run Locally

```bash
docker run -p 8080:80 agent-chat-frontend
```

Access the application at `http://localhost:8080`

### Build with Custom Configuration

Since Vite environment variables are embedded at build time, you must pass them as build arguments:

```bash
docker build \
  --build-arg VITE_AGENT_API_BASE_URL=https://your-api.azurecontainerapps.io \
  --build-arg VITE_APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..." \
  -t agent-chat-frontend .
```

**Important**: When deploying to Azure Container Apps, environment variables are baked into the image during the GitHub Actions build step, not set at runtime.

## Deployment to Azure Container Apps

### Prerequisites

1. **Azure Container Registry (ACR)**
   ```bash
   az acr create --name <your-acr-name> --resource-group <resource-group> --sku Basic
   ```

2. **Azure Container Apps Environment**
   ```bash
   az containerapp env create \
     --name <environment-name> \
     --resource-group <resource-group> \
     --location <location>
   ```

3. **Azure Container App**
   ```bash
   az containerapp create \
     --name <app-name> \
     --resource-group <resource-group> \
     --environment <environment-name> \
     --image <acr-name>.azurecr.io/agent-chat-frontend:latest \
     --target-port 80 \
     --ingress external \
     --env-vars VITE_AGENT_API_BASE_URL=https://your-agent-api.azurecontainerapps.io
   ```

### GitHub Actions Setup

1. **Create Azure Service Principal**

```bash
az ad sp create-for-rbac \
  --name "github-actions-agent-chat" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group> \
  --sdk-auth
```

Copy the JSON output.

2. **Configure GitHub Secrets**

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AZURE_CREDENTIALS` | Service principal credentials (JSON from step 1) | `{"clientId": "...", ...}` |
| `ACR_NAME` | Azure Container Registry name | `myacr` |
| `RESOURCE_GROUP` | Azure resource group name | `my-resource-group` |
| `CONTAINER_APP_NAME` | Container app name | `agent-chat-frontend` |
| `VITE_AGENT_API_BASE_URL` | Agent API base URL | `https://agent-api.azurecontainerapps.io` |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights connection string (optional) | `InstrumentationKey=...;IngestionEndpoint=...` |

3. **Deploy**

Push to the `main` branch or manually trigger the workflow:

```bash
git push origin main
```

Or trigger manually from GitHub Actions tab.

### Verify Deployment

```bash
az containerapp show \
  --name <app-name> \
  --resource-group <resource-group> \
  --query properties.configuration.ingress.fqdn
```

Visit the returned URL to access your application.

## CORS Configuration

If you encounter CORS errors, configure your Agent API to allow requests from your frontend URL:

### Required CORS Settings

- **Allowed Origins**: `https://<your-frontend-app>.azurecontainerapps.io` (or `*` for development)
- **Allowed Methods**: `GET, POST, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization, X-API-Key`
- **Allow Credentials**: `true` (if using cookies/auth)

### Example (Express.js)

```javascript
const cors = require('cors');

app.use(cors({
  origin: 'https://your-frontend.azurecontainerapps.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));
```

### Example (Azure Container Apps)

Configure CORS in your container app:

```bash
az containerapp cors enable \
  --name <agent-api-app> \
  --resource-group <resource-group> \
  --allowed-origins "https://<frontend-app>.azurecontainerapps.io" \
  --allowed-methods "GET,POST,OPTIONS" \
  --allowed-headers "Content-Type,Authorization,X-API-Key"
```

## Troubleshooting

### CORS Errors

**Symptom**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution**:
1. Check that CORS is properly configured on the Agent API
2. Verify the allowed origins include your frontend URL
3. Ensure `OPTIONS` preflight requests are handled correctly
4. Check that required headers are in the allowed list

### Wrong Endpoint / 404 Errors

**Symptom**: `HTTP 404: Not Found`

**Solution**:
1. Verify `VITE_AGENT_API_BASE_URL` is set correctly
2. Check that the chat endpoint path is correct (default: `/chat`)
3. Test the API endpoint directly with curl or Postman
4. Ensure the agent API is deployed and running

### 401/403 Authentication Errors

**Symptom**: `HTTP 401: Unauthorized` or `HTTP 403: Forbidden`

**Solution**:
1. If the API requires authentication, update `src/services/agentClient.ts`
2. Add appropriate auth headers (API key or Bearer token)
3. Verify credentials are valid and not expired
4. Check that the service principal has required permissions

### Connection Timeout

**Symptom**: `Request timeout` error after 30 seconds

**Solution**:
1. Check that the agent API is responding quickly
2. Verify network connectivity between frontend and API
3. Increase timeout in `src/services/agentClient.ts` if needed
4. Check Azure Container Apps logs for API errors

### Streaming Not Working

**Symptom**: Messages appear all at once instead of streaming

**Solution**:
1. Verify the agent API supports SSE (Server-Sent Events)
2. Check that the API sends proper SSE format: `data: {...}\n\n`
3. Application will automatically fall back to non-streaming if SSE fails
4. Check browser console for SSE errors

### Environment Variable Not Working

**Symptom**: API URL is not being used correctly

**Solution**:
1. Remember that Vite variables are embedded at **build time**
2. Rebuild the Docker image after changing environment variables
3. For Azure Container Apps, update environment variables AND rebuild/redeploy
4. Verify the variable name starts with `VITE_` prefix
5. Check that `.env` file is in the root directory (for local dev)

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [GitHub Issues](https://github.com/fjgomariz/agent-chat/issues)
3. Contact the maintainers
