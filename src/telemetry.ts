import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

/**
 * Initialize OpenTelemetry with Azure Application Insights
 * This function sets up distributed tracing for the web application
 * and correlates requests when calling the API.
 * 
 * Note: For browser applications, we use the OTLP HTTP exporter to send
 * telemetry data to Azure Application Insights ingestion endpoint.
 */
export function initializeTelemetry(): void {
  // Get the Application Insights connection string from environment
  const connectionString = import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;

  // Skip initialization if connection string is not configured
  if (!connectionString) {
    console.warn('Application Insights connection string not configured. Telemetry will not be collected.');
    return;
  }

  try {
    // Parse the connection string to extract the ingestion endpoint
    const ingestionEndpoint = extractIngestionEndpoint(connectionString);
    
    if (!ingestionEndpoint) {
      console.error('Failed to parse Application Insights connection string');
      return;
    }

    // Configure OTLP HTTP exporter for Azure Application Insights
    // Azure Application Insights accepts OTLP data at /v1/traces endpoint
    const exporter = new OTLPTraceExporter({
      url: `${ingestionEndpoint}/v1/traces`,
      headers: {
        // Azure Application Insights requires the instrumentation key in the header
        'x-ms-instrumentation-key': extractInstrumentationKey(connectionString) || '',
      },
    });

    // Create a resource with service information
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'agent-chat-frontend',
      [ATTR_SERVICE_VERSION]: '1.0.0',
    });

    // Create the tracer provider with resource and span processor
    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // Register the provider globally
    provider.register();

    // Instrument fetch API to automatically trace HTTP requests
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          // Propagate trace context to correlate frontend and backend requests
          propagateTraceHeaderCorsUrls: [
            // Match all URLs to ensure proper correlation
            /.*/,
          ],
          // Clear timing resources to prevent memory leaks
          clearTimingResources: true,
        }),
      ],
    });

    console.log('OpenTelemetry initialized successfully with Azure Application Insights');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
}

/**
 * Extract the ingestion endpoint from Application Insights connection string
 * Connection string format: InstrumentationKey=...;IngestionEndpoint=https://...;...
 */
function extractIngestionEndpoint(connectionString: string): string | null {
  const match = connectionString.match(/IngestionEndpoint=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Extract the instrumentation key from Application Insights connection string
 * Connection string format: InstrumentationKey=...;IngestionEndpoint=https://...;...
 */
function extractInstrumentationKey(connectionString: string): string | null {
  const match = connectionString.match(/InstrumentationKey=([^;]+)/);
  return match ? match[1] : null;
}
