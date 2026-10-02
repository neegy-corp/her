import ts from 'typescript';
import fs from 'node:fs';
const queries = new Set();
for (const filename of ['app/api/her/route.ts', 'lib/server.ts', 'lib/rounds.ts', 'lib/operator-store.ts']) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const constants = new Map();
  function value(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) return constants.get(node.text);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = value(node.left), right = value(node.right);
      if (typeof left === 'string' && typeof right === 'string') return left + right;
    }
  }
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, value(node.initializer));
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'prepare') {
      const query = value(node.arguments[0]);
      if (!query) throw new Error(`Non-static database query in ${filename}`);
      queries.add(query);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
fs.mkdirSync('supabase/functions/her-database', { recursive: true });
fs.writeFileSync('supabase/functions/her-database/queries.json', JSON.stringify([...queries].sort(), null, 2) + '\n');
console.log(`Registered ${queries.size} server-owned database queries.`);
