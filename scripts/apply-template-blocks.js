#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function replaceBlock(target, source, name) {
  const start = new RegExp(`// \\<template:${name}\\>`);
  const end = new RegExp(`// \\</template:${name}\\>`);

  const tStart = target.search(start);
  const tEnd = target.search(end);
  const sStart = source.search(start);
  const sEnd = source.search(end);

  if (tStart === -1 || tEnd === -1 || sStart === -1 || sEnd === -1) {
    return { content: target, changed: false, reason: 'missing-markers' };
  }

  const tPre = target.slice(0, tStart);
  const tPost = target.slice(target.indexOf('\n', tEnd) + 1 || tEnd + 1);

  const sBlockStart = source.indexOf('\n', sStart) + 1;
  const sBlockEnd = source.search(end);
  const sBlock = source.slice(sBlockStart, sBlockEnd).replace(/^[\n\r]+|[\n\r]+$/g, '') + '\n';

  const replaced = tPre + source.slice(sStart, sStart + ('// <template:'.length + name.length + 3)) // keep start marker line format
    ? tPre + source.match(start)[0] + '\n' + sBlock + source.match(end)[0] + '\n' + tPost
    : tPre + source.match(start)[0] + '\n' + sBlock + source.match(end)[0] + '\n' + tPost;

  // Simpler: construct explicitly using markers from target to preserve comments spacing
  const tStartLine = target.match(start)[0];
  const tEndLine = target.match(end)[0];
  const result = tPre + tStartLine + '\n' + sBlock + tEndLine + '\n' + tPost;

  if (result !== target) {
    return { content: result, changed: true };
  }
  return { content: target, changed: false };
}

function apply(templateFile, projectFile, blocks) {
  const src = read(templateFile);
  const dst = read(projectFile);
  if (!src || !dst) {
    console.error(`apply-template-blocks: skip (missing files). template=${!!src} target=${!!dst}`);
    process.exit(0);
  }

  let updated = dst;
  let anyChanged = false;
  for (const b of blocks) {
    const { content, changed } = replaceBlock(updated, src, b);
    updated = content;
    anyChanged = anyChanged || changed;
  }

  if (process.env.DRY_RUN === '1') {
    if (anyChanged) {
      console.log(`Would update blocks [${blocks.join(', ')}] in ${projectFile}`);
    } else {
      console.log(`No block changes needed for ${projectFile}`);
    }
    return;
  }

  if (anyChanged) {
    fs.writeFileSync(projectFile, updated, 'utf8');
    console.log(`Updated ${projectFile} blocks: ${blocks.join(', ')}`);
  } else {
    console.log(`No changes applied to ${projectFile}`);
  }
}

function main() {
  const [templateFile, projectFile] = process.argv.slice(2);
  if (!templateFile || !projectFile) {
    console.error('Usage: node scripts/apply-template-blocks.js <templateFile> <projectFile>');
    process.exit(1);
  }
  apply(templateFile, projectFile, ['bootstrap', 'startup']);
}

if (require.main === module) {
  main();
}