import { loader } from 'fumadocs-core/source';
import { docs } from 'fumadocs-mdx:collections';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
