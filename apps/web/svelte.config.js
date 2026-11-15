import adapter from '@sveltejs/adapter-node';
import { mdsvex } from 'mdsvex';
import { createHighlighter } from 'shiki';

const highlighter = await createHighlighter({
  'themes': ['github-dark-default'],
  'langs': ['lua', 'json', 'bash', 'typescript', 'javascript'],
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
  'extensions': ['.svelte', '.md'],
  'preprocess': [
    mdsvex({
      'extensions': ['.md'],
      'smartypants': false,
      'highlight': {
        'highlighter': (code, lang) => {
          const language = lang ?? '';
          const html = highlighter.codeToHtml(code, {
            'lang': language === '' ? 'text' : language,
            'theme': 'github-dark-default',
          });
          return `{@html \`${html.replace(/`/g, '\\`')}\`}`;
        },
      },
    }),
  ],
  'kit': {
    'adapter': adapter(),
    'alias': {
      '$styles': 'src/app.css',
    },
  },
};

export default config;
