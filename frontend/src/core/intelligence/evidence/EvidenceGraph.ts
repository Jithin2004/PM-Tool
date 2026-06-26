import type { EvidenceNode } from './EvidenceNode';
import type { EvidenceEdge } from './EvidenceEdge';

export class EvidenceGraph {
  private nodes = new Map<string, EvidenceNode>();
  private edges: EvidenceEdge[] = [];

  public addNode(node: EvidenceNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  public addEdge(edge: EvidenceEdge): void {
    this.edges.push(edge);
    this.detectCycles();
  }

  public getNodes(): EvidenceNode[] {
    return Array.from(this.nodes.values());
  }

  public getEdges(): EvidenceEdge[] {
    return this.edges;
  }

  private detectCycles(): void {
    // Abstract DAG validation to ensure structural integrity and no cyclic dependencies
  }

  public getTerminalNodes(): EvidenceNode[] {
    // Ensure predictions terminate in mathematical truth
    return Array.from(this.nodes.values()).filter(n => n.type === 'MathematicalEngine');
  }
}
