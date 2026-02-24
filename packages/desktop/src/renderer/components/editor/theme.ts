import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from '@codemirror/view';

/**
 * Custom syntax highlight style that harmonizes with the app's
 * indigo/teal design system. Colors are defined as CSS custom
 * properties (--syntax-*) in globals.css with light/dark variants.
 */
const odyHighlightStyle = HighlightStyle.define([
  {
    tag: tags.keyword,
    color: 'var(--syntax-keyword)',
  },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.macroName],
    color: 'var(--syntax-property)',
  },
  {
    tag: [tags.propertyName],
    color: 'var(--syntax-property)',
  },
  {
    tag: [tags.function(tags.variableName), tags.labelName],
    color: 'var(--syntax-function)',
  },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: 'var(--syntax-number)',
  },
  {
    tag: [tags.definition(tags.name), tags.separator],
    color: 'var(--color-light)',
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.changed,
      tags.annotation,
      tags.modifier,
      tags.self,
      tags.namespace,
    ],
    color: 'var(--syntax-type)',
  },
  {
    tag: tags.number,
    color: 'var(--syntax-number)',
  },
  {
    tag: [tags.operator, tags.operatorKeyword],
    color: 'var(--syntax-operator)',
  },
  {
    tag: [tags.url, tags.escape, tags.regexp, tags.special(tags.string)],
    color: 'var(--syntax-link)',
  },
  {
    tag: [tags.meta, tags.comment],
    color: 'var(--syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: tags.strong,
    fontWeight: 'bold',
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
  },
  {
    tag: tags.strikethrough,
    textDecoration: 'line-through',
  },
  {
    tag: tags.link,
    color: 'var(--syntax-link)',
    textDecoration: 'underline',
  },
  {
    tag: tags.heading,
    fontWeight: 'bold',
    color: 'var(--syntax-heading)',
  },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: 'var(--syntax-number)',
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted],
    color: 'var(--syntax-string)',
  },
  {
    tag: tags.invalid,
    color: 'var(--syntax-deleted)',
  },
]);

/**
 * Combined syntax highlighting extension.
 */
export const odySyntax = syntaxHighlighting(odyHighlightStyle);

/**
 * Editor chrome theme that maps CodeMirror UI elements to the app's
 * CSS custom properties. Applied on top of a base dark theme.
 */
export const odyEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-light)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-panel)',
    color: 'var(--color-dim)',
    borderRight: '1px solid var(--color-edge)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgb(0 245 212 / 5%)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgb(0 245 212 / 5%)',
    color: 'var(--color-light)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgb(0 245 212 / 20%) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-primary)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-tooltip': {
    border: '1px solid var(--color-edge)',
    backgroundColor: 'var(--color-panel)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgb(0 245 212 / 15%)',
    outline: '1px solid rgb(0 245 212 / 30%)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgb(0 245 212 / 10%)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-dim)',
  },
});

/**
 * Diff view chrome overrides — extends odyEditorTheme with
 * merge-specific styles.
 */
export const odyDiffTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-light)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-panel)',
    color: 'var(--color-dim)',
    borderRight: '1px solid var(--color-edge)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-mergeView .cm-changedLine': {
    backgroundColor: 'rgb(0 245 212 / 8%)',
  },
});
