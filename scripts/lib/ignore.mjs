// Which website files would Firebase Hosting refuse to upload? (the "ignore" list in firebase.json)
// A small matcher so `npm run deploy:web` can check this BEFORE publishing, instead of icons silently going missing.

export function globToRegExp(pattern) {
  const p = String(pattern).replace(/^\.\//, '');
  let re = '';
  for (let i = 0; i < p.length; i += 1) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        const slashAfter = p[i + 2] === '/';
        re += slashAfter ? '(?:.*/)?' : '.*';
        i += slashAfter ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$+?.()|{}[]'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

// A file is ignored if the file itself, or any folder above it, matches a pattern.
export function isIgnored(relativePath, patterns) {
  const parts = String(relativePath).split('/');
  const candidates = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
  return patterns.some((pattern) => {
    const re = globToRegExp(pattern);
    return candidates.some((candidate) => re.test(candidate));
  });
}
