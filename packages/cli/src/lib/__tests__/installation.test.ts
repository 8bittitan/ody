import { describe, expect, test } from 'bun:test';

import { Installation } from '../installation';

describe('Installation.needsUpdate', () => {
  test('returns false for equal versions', () => {
    expect(Installation.needsUpdate('1.2.3', '1.2.3')).toBe(false);
  });

  test('returns true when the remote version is newer', () => {
    expect(Installation.needsUpdate('1.2.4', '1.2.3')).toBe(true);
  });

  test('returns false when the local version is newer', () => {
    expect(Installation.needsUpdate('1.2.3', '1.2.4')).toBe(false);
  });

  test('normalizes a leading v prefix before comparing', () => {
    expect(Installation.needsUpdate('v1.2.4', '1.2.3')).toBe(true);
  });

  test('treats a release as newer than the matching prerelease', () => {
    expect(Installation.needsUpdate('1.2.3', '1.2.3-beta.1')).toBe(true);
  });

  test('returns false when the remote prerelease is older than the local release', () => {
    expect(Installation.needsUpdate('1.2.3-beta.1', '1.2.3')).toBe(false);
  });
});
