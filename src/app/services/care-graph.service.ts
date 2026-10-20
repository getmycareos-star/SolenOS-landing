/**
 * Care Graph Service for managing care-related graph data structures and operations.
 */

export interface CareNode {
  id: string;
  type: string; // e.g., 'patient', 'caregiver', 'medication', 'appointment'
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string; // e.g., 'cares_for', 'prescribed', 'scheduled_for'
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class CareGraphService {
  private nodes: Map<string, CareNode> = new Map();
  private edges: Map<string, CareEdge> = new Map();

  /**
   * Add a node to the care graph.
   */
  addNode(node: CareNode): CareNode {
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Retrieve a node by its ID.
   */
  getNode(nodeId: string): CareNode | null {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Update a node's properties.
   */
  updateNode(nodeId: string, properties: Record<string, any>): CareNode | null {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }

    node.properties = { ...node.properties, ...properties };
    node.updatedAt = new Date();
    return node;
  }

  /**
   * Remove a node from the care graph.
   * Also removes all edges connected to this node.
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) {
      return false;
    }

    // Remove all edges connected to this node
    for (const [edgeId, edge] of this.edges.entries()) {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        this.edges.delete(edgeId);
      }
    }

    // Remove the node
    this.nodes.delete(nodeId);
    return true;
  }

  /**
   * Add an edge to the care graph.
   */
  addEdge(edge: CareEdge): CareEdge {
    this.edges.set(edge.id, edge);
    return edge;
  }

  /**
   * Retrieve an edge by its ID.
   */
  getEdge(edgeId: string): CareEdge | null {
    return this.edges.get(edgeId) || null;
  }

  /**
   * Get all edges connected to a node.
   */
  getEdgesForNode(nodeId: string): CareEdge[] {
    return Array.from(this.edges.values()).filter(
      edge => edge.sourceId === nodeId || edge.targetId === nodeId
    );
  }

  /**
   * Get all nodes directly connected to a node.
   */
  getNeighbors(nodeId: string): CareNode[] {
    const neighbors: CareNode[] = [];
    
    for (const edge of this.edges.values()) {
      if (edge.sourceId === nodeId) {
        const neighbor = this.nodes.get(edge.targetId);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      } else if (edge.targetId === nodeId) {
        const neighbor = this.nodes.get(edge.sourceId);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }
    
    return neighbors;
  }

  /**
   * Get statistics about the care graph.
   */
  getGraphStatistics(): {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: string[];
    relationshipTypes: string[];
  } {
    const nodeTypes = new Set<string>();
    const relationshipTypes = new Set<string>();
    
    for (const node of this.nodes.values()) {
      nodeTypes.add(node.type);
    }
    
    for (const edge of this.edges.values()) {
      relationshipTypes.add(edge.relationshipType);
    }
    
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodeTypes: Array.from(nodeTypes),
      relationshipTypes: Array.from(relationshipTypes)
    };
  }
}