import { describe, it, expect } from 'vitest';
import { parseFrom, htmlToText } from '../packages/core/src/gmail/parse.js';

describe('parseFrom', () => {
  it('parses "Name <email>" pairs', () => {
    expect(parseFrom('Jane Doe <jane@example.com>')).toEqual({
      name: 'Jane Doe',
      address: 'jane@example.com',
    });
  });
  it('handles quoted display names', () => {
    expect(parseFrom('"The Netflix Team" <info@netflix.com>')).toEqual({
      name: 'The Netflix Team',
      address: 'info@netflix.com',
    });
  });
  it('handles bare addresses', () => {
    expect(parseFrom('orders@amazon.com')).toEqual({ name: null, address: 'orders@amazon.com' });
  });
  it('returns empty for null', () => {
    expect(parseFrom(null)).toEqual({ name: null, address: '' });
  });
});

describe('htmlToText', () => {
  it('strips tags and decodes entities', () => {
    const html = '<p>Total: <strong>$15.99</strong>&nbsp;USD</p><p>Thanks &amp; bye</p>';
    const t = htmlToText(html);
    expect(t).toContain('Total:');
    expect(t).toContain('$15.99');
    expect(t).toContain('Thanks & bye');
    expect(t).not.toContain('<');
  });
  it('drops script and style', () => {
    const html =
      '<style>body{color:red}</style><script>alert(1)</script><p>Hello</p>';
    expect(htmlToText(html)).toBe('Hello');
  });
});
