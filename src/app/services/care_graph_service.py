"""
Care Graph Service for managing care-related graph data structures and operations.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CareNode:
    """Represents a node in the care graph."""
    id: str
    type: str  # e.g., 'patient', 'caregiver', 'medication', 'appointment'
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class CareEdge:
    """Represents an edge (relationship) in the care graph."""
    id: str
    source_id: str
    target_id: str
    relationship_type: str  # e.g., 'cares_for', 'prescribed', 'scheduled_for'
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class CareGraphService:
    """Service for managing care graph operations."""
    
    def __init__(self):
        self.nodes: Dict[str, CareNode] = {}
        self.edges: Dict[str, CareEdge] = {}
    
    def add_node(self, node: CareNode) -> CareNode:
        """Add a node to the care graph."""
        self.nodes[node.id] = node
        return node
    
    def get_node(self, node_id: str) -> Optional[CareNode]:
        """Retrieve a node by its ID."""
        return self.nodes.get(node_id)
    
    def update_node(self, node_id: str, properties: Dict[str, Any]) -> Optional[CareNode]:
        """Update a node's properties."""
        if node_id not in self.nodes:
            return None
        
        node = self.nodes[node_id]
        node.properties.update(properties)
        node.updated_at = datetime.now()
        return node
    
    def remove_node(self, node_id: str) -> bool:
        """Remove a node from the care graph."""
        if node_id not in self.nodes:
            return False
        
        # Remove all edges connected to this node
        edges_to_remove = []
        for edge_id, edge in self.edges.items():
            if edge.source_id == node_id or edge.target_id == node_id:
                edges_to_remove.append(edge_id)
        
        for edge_id in edges_to_remove:
            del self.edges[edge_id]
        
        # Remove the node
        del self.nodes[node_id]
        return True
    
    def add_edge(self, edge: CareEdge) -> CareEdge:
        """Add an edge to the care graph."""
        self.edges[edge.id] = edge
        return edge
    
    def get_edge(self, edge_id: str) -> Optional[CareEdge]:
        """Retrieve an edge by its ID."""
        return self.edges.get(edge_id)
    
    def get_edges_for_node(self, node_id: str) -> List[CareEdge]:
        """Get all edges connected to a node."""
        return [
            edge for edge in self.edges.values()
            if edge.source_id == node_id or edge.target_id == node_id
        ]
    
    def get_neighbors(self, node_id: str) -> List[CareNode]:
        """Get all nodes directly connected to a node."""
        neighbors = []
        for edge in self.edges.values():
            if edge.source_id == node_id:
                neighbor = self.nodes.get(edge.target_id)
                if neighbor:
                    neighbors.append(neighbor)
            elif edge.target_id == node_id:
                neighbor = self.nodes.get(edge.source_id)
                if neighbor:
                    neighbors.append(neighbor)
        return neighbors
    
    def get_graph_statistics(self) -> Dict[str, Any]:
        """Get statistics about the care graph."""
        return {
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "node_types": list(set(node.type for node in self.nodes.values())),
            "relationship_types": list(set(edge.relationship_type for edge in self.edges.values()))
        }


# Example usage
if __name__ == "__main__":
    # Create a care graph service
    service = CareGraphService()
    
    # Add a patient node
    patient = CareNode(
        id="patient-001",
        type="patient",
        properties={
            "name": "John Doe",
            "age": 65,
            "condition": "Hypertension"
        }
    )
    service.add_node(patient)
    
    # Add a caregiver node
    caregiver = CareNode(
        id="caregiver-001",
        type="caregiver",
        properties={
            "name": "Jane Smith",
            "relationship": "daughter"
        }
    )
    service.add_node(caregiver)
    
    # Add a cares_for relationship
    cares_for_edge = CareEdge(
        id="edge-001",
        source_id="caregiver-001",
        target_id="patient-001",
        relationship_type="cares_for",
        properties={
            "start_date": "2023-01-01",
            "type": "primary"
        }
    )
    service.add_edge(cares_for_edge)
    
    # Print graph statistics
    print(service.get_graph_statistics())