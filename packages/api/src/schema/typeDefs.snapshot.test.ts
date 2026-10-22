import fs from 'fs';
import path from 'path';

// Issue #426 – fails when the public schema SDL changes without an intentional
// snapshot update (`pnpm --filter @stellar-analytics/api test -- -u`).
// The SDL is read from source rather than imported because the current
// typeDefs contain generic placeholders (e.g. `Connection<T>`) that `gql`
// cannot parse.
describe('GraphQL schema snapshot', () => {
  it('matches the committed schema snapshot', () => {
    const source = fs.readFileSync(path.join(__dirname, 'typeDefs.ts'), 'utf8');
    const match = source.match(/gql`([\s\S]*?)`;/);
    expect(match).not.toBeNull();
    const sdl = match![1]
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
    expect(sdl).toMatchSnapshot();
  });
});
