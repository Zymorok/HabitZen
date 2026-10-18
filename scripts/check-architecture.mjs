import { readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];
const core = join(root, 'packages/core/src');
function checkImport(specifier, path) {
  if (!specifier.startsWith('.')) {
    issues.push(path + ': ядро не должно импортировать внешнюю платформу: ' + specifier);
    return;
  }
  const target = resolve(dirname(path), specifier);
  const withinCore = relative(core, target);
  if (withinCore.startsWith('..') || isAbsolute(withinCore)) {
    issues.push(path + ': импорт выходит за пределы чистого ядра: ' + specifier);
  }
}
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (/\.ts$/.test(entry.name)) {
      const source = ts.createSourceFile(
        path,
        await readFile(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier
        ) {
          if (ts.isStringLiteral(node.moduleSpecifier))
            checkImport(node.moduleSpecifier.text, path);
        }
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteral(argument)) checkImport(argument.text, path);
          else issues.push(path + ': вычисляемый импорт в ядре запрещён');
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
await inspect(core);
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: статические и динамические импорты ядра не выходят в платформенные слои.');
}
