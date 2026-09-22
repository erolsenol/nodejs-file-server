import { Counter, Histogram, Registry } from 'prom-client';

export interface FileServerMetrics {
  readonly registry: Registry;
  readonly requestsTotal: Counter<'method' | 'route' | 'status'>;
  readonly requestDurationSeconds: Histogram<'method' | 'route' | 'status'>;
  readonly uploadsTotal: Counter<'status'>;
}

export function createMetrics(): FileServerMetrics {
  const registry = new Registry();
  const labels = ['method', 'route', 'status'] as const;
  const requestsTotal = new Counter({ name: 'fileserver_http_requests_total', help: 'Total HTTP requests handled by the file server', labelNames: labels, registers: [registry] });
  const requestDurationSeconds = new Histogram({ name: 'fileserver_http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames: labels, buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5], registers: [registry] });
  const uploadsTotal = new Counter({ name: 'fileserver_uploads_total', help: 'Total file upload attempts', labelNames: ['status'], registers: [registry] });
  return { registry, requestsTotal, requestDurationSeconds, uploadsTotal };
}
