import React from 'react';

// Web version: a fully sandboxed frame (no scripts, no same-origin access).
export function HtmlViewer({ html, style }) {
  return React.createElement('iframe', {
    title: 'Document preview',
    srcDoc: html,
    sandbox: '',
    style: { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff', ...(style || {}) },
  });
}
