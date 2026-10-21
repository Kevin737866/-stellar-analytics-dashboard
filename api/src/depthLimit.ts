import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type DefinitionNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

// Issue #418: reject queries nested deeper than the configured limit before
// they reach the resolvers. See docs/graphql-query-limits.md.
export const MAX_QUERY_DEPTH = Number(process.env.GRAPHQL_MAX_DEPTH ?? 10);

function selectionDepth(
  selectionSet: SelectionSetNode | undefined,
  fragments: Map<string, FragmentDefinitionNode>,
  visited: Set<string>
): number {
  if (!selectionSet) return 0;
  let max = 0;
  for (const selection of selectionSet.selections) {
    let depth = 0;
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith('__')) continue;
      depth = selection.selectionSet
        ? 1 + selectionDepth(selection.selectionSet, fragments, visited)
        : 1;
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      depth = selectionDepth(selection.selectionSet, fragments, visited);
    } else {
      const name = selection.name.value;
      const fragment = fragments.get(name);
      if (!fragment || visited.has(name)) continue;
      visited.add(name);
      depth = selectionDepth(fragment.selectionSet, fragments, visited);
      visited.delete(name);
    }
    max = Math.max(max, depth);
  }
  return max;
}

export function depthLimit(maxDepth: number = MAX_QUERY_DEPTH) {
  return (context: ValidationContext): ASTVisitor => {
    const definitions = context.getDocument().definitions as readonly DefinitionNode[];
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const def of definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) fragments.set(def.name.value, def);
    }
    return {
      OperationDefinition(node) {
        const depth = selectionDepth(node.selectionSet, fragments, new Set());
        if (depth > maxDepth) {
          const name = node.name?.value ?? 'anonymous';
          context.reportError(
            new GraphQLError(
              `Operation "${name}" exceeds maximum query depth of ${maxDepth} (depth ${depth}).`,
              { nodes: [node] }
            )
          );
        }
      },
    };
  };
}
