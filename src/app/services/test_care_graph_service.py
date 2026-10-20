"""
Test file for Care Graph Service
"""

import unittest
from datetime import datetime
from care_graph_service import CareGraphService, CareNode, CareEdge


class TestCareGraphService(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.service = CareGraphService()
    
    def test_add_and_get_node(self):
        """Test adding and retrieving a node."""
        node = CareNode(
            id="test-001",
            type="patient",
            properties={"name": "Test Patient"}
        )
        
        # Add node
        added_node = self.service.add_node(node)
        self.assertEqual(added_node.id, "test-001")
        self.assertEqual(added_node.type, "patient")
        
        # Get node
        retrieved_node = self.service.get_node("test-001")
        self.assertIsNotNone(retrieved_node)
        self.assertEqual(retrieved_node.id, "test-001")
        self.assertEqual(retrieved_node.properties["name"], "Test Patient")
    
    def test_get_nonexistent_node(self):
        """Test getting a node that doesn't exist."""
        node = self.service.get_node("nonexistent")
        self.assertIsNone(node)
    
    def test_update_node(self):
        """Test updating a node's properties."""
        node = CareNode(
            id="test-002",
            type="patient",
            properties={"name": "Original Name"}
        )
        self.service.add_node(node)
        
        # Update node
        updated_node = self.service.update_node("test-002", {
            "name": "Updated Name",
            "age": 30
        })
        
        self.assertIsNotNone(updated_node)
        self.assertEqual(updated_node.properties["name"], "Updated Name")
        self.assertEqual(updated_node.properties["age"], 30)
        self.assertNotEqual(updated_node.updated_at, updated_node.created_at)
    
    def test_update_nonexistent_node(self):
        """Test updating a node that doesn't exist."""
        result = self.service.update_node("nonexistent", {"name": "Test"})
        self.assertIsNone(result)
    
    def test_add_and_get_edge(self):
        """Test adding and retrieving an edge."""
        # First add nodes
        source_node = CareNode(id="source-001", type="caregiver")
        target_node = CareNode(id="target-001", type="patient")
        self.service.add_node(source_node)
        self.service.add_node(target_node)
        
        # Add edge
        edge = CareEdge(
            id="edge-001",
            source_id="source-001",
            target_id="target-001",
            relationship_type="cares_for"
        )
        added_edge = self.service.add_edge(edge)
        self.assertEqual(added_edge.id, "edge-001")
        self.assertEqual(added_edge.relationship_type, "cares_for")
        
        # Get edge
        retrieved_edge = self.service.get_edge("edge-001")
        self.assertIsNotNone(retrieved_edge)
        self.assertEqual(retrieved_edge.id, "edge-001")
        self.assertEqual(retrieved_edge.source_id, "source-001")
        self.assertEqual(retrieved_edge.target_id, "target-001")
    
    def test_get_edges_for_node(self):
        """Test getting all edges connected to a node."""
        # Add nodes
        patient = CareNode(id="patient-001", type="patient")
        caregiver1 = CareNode(id="caregiver-001", type="caregiver")
        caregiver2 = CareNode(id="caregiver-002", type="caregiver")
        medication = CareNode(id="med-001", type="medication")
        
        for node in [patient, caregiver1, caregiver2, medication]:
            self.service.add_node(node)
        
        # Add edges
        edge1 = CareEdge(
            id="edge-001",
            source_id="caregiver-001",
            target_id="patient-001",
            relationship_type="cares_for"
        )
        edge2 = CareEdge(
            id="edge-002",
            source_id="caregiver-002",
            target_id="patient-001",
            relationship_type="cares_for"
        )
        edge3 = CareEdge(
            id="edge-003",
            source_id="patient-001",
            target_id="med-001",
            relationship_type="prescribed"
        )
        
        for edge in [edge1, edge2, edge3]:
            self.service.add_edge(edge)
        
        # Get edges for patient
        patient_edges = self.service.get_edges_for_node("patient-001")
        self.assertEqual(len(patient_edges), 3)
        
        # Get edges for caregiver1
        caregiver_edges = self.service.get_edges_for_node("caregiver-001")
        self.assertEqual(len(caregiver_edges), 1)
        self.assertEqual(caregiver_edges[0].id, "edge-001")
    
    def test_get_neighbors(self):
        """Test getting all nodes directly connected to a node."""
        # Add nodes
        patient = CareNode(id="patient-001", type="patient")
        caregiver = CareNode(id="caregiver-001", type="caregiver")
        medication = CareNode(id="med-001", type="medication")
        
        for node in [patient, caregiver, medication]:
            self.service.add_node(node)
        
        # Add edges
        edge1 = CareEdge(
            id="edge-001",
            source_id="caregiver-001",
            target_id="patient-001",
            relationship_type="cares_for"
        )
        edge2 = CareEdge(
            id="edge-002",
            source_id="patient-001",
            target_id="med-001",
            relationship_type="prescribed"
        )
        
        for edge in [edge1, edge2]:
            self.service.add_edge(edge)
        
        # Get neighbors for patient
        neighbors = self.service.get_neighbors("patient-001")
        self.assertEqual(len(neighbors), 2)
        
        neighbor_ids = {n.id for n in neighbors}
        self.assertIn("caregiver-001", neighbor_ids)
        self.assertIn("med-001", neighbor_ids)
    
    def test_remove_node(self):
        """Test removing a node and its connected edges."""
        # Add nodes
        patient = CareNode(id="patient-001", type="patient")
        caregiver = CareNode(id="caregiver-001", type="caregiver")
        medication = CareNode(id="med-001", type="medication")
        
        for node in [patient, caregiver, medication]:
            self.service.add_node(node)
        
        # Add edges
        edge1 = CareEdge(
            id="edge-001",
            source_id="caregiver-001",
            target_id="patient-001",
            relationship_type="cares_for"
        )
        edge2 = CareEdge(
            id="edge-002",
            source_id="patient-001",
            target_id="med-001",
            relationship_type="prescribed"
        )
        
        for edge in [edge1, edge2]:
            self.service.add_edge(edge)
        
        # Verify initial state
        self.assertEqual(len(self.service.nodes), 3)
        self.assertEqual(len(self.service.edges), 2)
        
        # Remove patient node
        result = self.service.remove_node("patient-001")
        self.assertTrue(result)
        
        # Verify node and edges removed
        self.assertIsNone(self.service.get_node("patient-001"))
        self.assertIsNone(self.service.get_edge("edge-001"))
        self.assertIsNone(self.service.get_edge("edge-002"))
        self.assertEqual(len(self.service.nodes), 2)
        self.assertEqual(len(self.service.edges), 0)
        
        # Verify other nodes still exist
        self.assertIsNotNone(self.service.get_node("caregiver-001"))
        self.assertIsNotNone(self.service.get_node("med-001"))
    
    def test_remove_nonexistent_node(self):
        """Test removing a node that doesn't exist."""
        result = self.service.remove_node("nonexistent")
        self.assertFalse(result)
    
    def test_get_graph_statistics(self):
        """Test getting graph statistics."""
        # Add nodes
        patient = CareNode(id="patient-001", type="patient")
        caregiver = CareNode(id="caregiver-001", type="caregiver")
        medication = CareNode(id="med-001", type="medication")
        
        for node in [patient, caregiver, medication]:
            self.service.add_node(node)
        
        # Add edges
        edge1 = CareEdge(
            id="edge-001",
            source_id="caregiver-001",
            target_id="patient-001",
            relationship_type="cares_for"
        )
        edge2 = CareEdge(
            id="edge-002",
            source_id="patient-001",
            target_id="med-001",
            relationship_type="prescribed"
        )
        
        for edge in [edge1, edge2]:
            self.service.add_edge(edge)
        
        stats = self.service.get_graph_statistics()
        self.assertEqual(stats["node_count"], 3)
        self.assertEqual(stats["edge_count"], 2)
        self.assertEqual(set(stats["node_types"]), {"patient", "caregiver", "medication"})
        self.assertEqual(set(stats["relationship_types"]), {"cares_for", "prescribed"})


if __name__ == "__main__":
    unittest.main()