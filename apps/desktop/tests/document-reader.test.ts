import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { highlightMatches } from '../src/DocumentReaderModal.js';

test('DocumentReaderModal - highlightMatches', async (t) => {
  await t.test('returns plain text when query is empty or undefined', () => {
    assert.equal(highlightMatches('Testo semplice', ''), 'Testo semplice');
    assert.equal(highlightMatches('Testo semplice', undefined), 'Testo semplice');
    assert.equal(highlightMatches('Testo semplice', '   '), 'Testo semplice');
  });

  await t.test('highlights exact match with case insensitivity and React elements', () => {
    const text = 'Il progetto LIMEN è avviato.';
    const result = highlightMatches(text, 'limen');
    assert(Array.isArray(result));
    assert.equal(result.length, 3); // 'Il progetto ', <mark>, ' è avviato.'
    assert.equal(result[0], 'Il progetto ');
    assert.equal(result[2], ' è avviato.');
    
    // Validate mark element
    const mark = result[1] as React.ReactElement;
    assert.equal(mark.type, 'mark');
    assert.equal(mark.props.children, 'LIMEN');
  });

  await t.test('normalizes diacritics and accents (caffè vs caffe)', () => {
    const text = 'Prendiamo un caffè con Acme.';
    const result = highlightMatches(text, 'caffe');
    assert(Array.isArray(result));
    assert.equal(result.length, 3);
    const mark = result[1] as React.ReactElement;
    assert.equal(mark.type, 'mark');
    assert.equal(mark.props.children, 'caffè');
  });

  await t.test('handles multiple occurrences in long passages without XSS injection', () => {
    const text = '<script>alert("hack")</script> and test script here';
    const result = highlightMatches(text, 'script');
    assert(Array.isArray(result));
    // No raw HTML string containing <mark> should be returned as raw html string
    assert(!result.some(r => typeof r === 'string' && r.includes('<mark>')));
    // Three mark elements for the three 'script' matches (<script>, </script>, script)
    const marks = result.filter(r => React.isValidElement(r) && r.type === 'mark');
    assert.equal(marks.length, 3);
  });

  await t.test('preserves Unicode and emojis', () => {
    const text = 'Documento 🚀 con emoji e numeri 12345.';
    const result = highlightMatches(text, 'emoji');
    assert(Array.isArray(result));
    const mark = result.find(r => React.isValidElement(r) && r.type === 'mark') as React.ReactElement;
    assert.equal(mark.props.children, 'emoji');
    assert.equal(result[0], 'Documento 🚀 con ');
  });
});
