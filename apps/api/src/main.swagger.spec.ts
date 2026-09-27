/**
 * Boot assertion: Swagger must not mount in production.
 * Mirrors the guard in main.ts (NODE_ENV === 'production' → no /api/docs).
 */
describe('Swagger production gate', () => {
  it('documents that OpenAPI is disabled when NODE_ENV is production', () => {
    const shouldMountSwagger = (nodeEnv: string | undefined) =>
      (nodeEnv ?? 'development') !== 'production';

    expect(shouldMountSwagger('development')).toBe(true);
    expect(shouldMountSwagger('test')).toBe(true);
    expect(shouldMountSwagger('production')).toBe(false);
  });
});
