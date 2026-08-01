export function renderErrorPage(): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Something went wrong</title>
    <style>
      body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
      .container { text-align: center; padding: 2rem; }
      h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
      p { color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>⚠️ Server Error</h1>
      <p>We're sorry, but something went wrong. Our team has been notified.</p>
    </div>
  </body>
</html>
  `;
}
