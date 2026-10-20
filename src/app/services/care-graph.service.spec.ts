/**
 * Test file for Care Graph Service (TypeScript version)
 */

import { CareGraphService, CareNode, CareEdge } from './care-graph.service';

describe('CareGraphService', () => {
  let service: CareGraphService;

  beforeEach(() => {
    service = new CareGraphService();
  });

  describe('addNode and getNode', () => {
    it('should add and retrieve a node', () => {
      const node: CareNode = {
        id: 'test-001',
        type: 'patient',
        properties: { name: 'Test Patient' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add node
      const addedNode = service.addNode(node);
      expect(addedNode.id).toBe('test-001');
      expect(addedNode.type).toBe('patient');

      // Get node
      const retrievedNode = service.getNode('test-001');
      expect(retrievedNode).not.toBeNull();
      expect(retrievedNode?.id).toBe('test-001');
      expect(retrievedNode?.properties.name).toBe('Test Patient');
    });

    it('should return null for nonexistent node', () => {
      const node = service.getNode('nonexistent');
      expect(node).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('should update a node\'s properties', () => {
      const node: CareNode = {
        id: 'test-002',
        type: 'patient',
        properties: { name: 'Original Name' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      service.addNode(node);

      // Update node
      const updatedNode = service.updateNode('test-002', {
        name: 'Updated Name',
        age: 30
      });

      expect(updatedNode).not.toBeNull();
      expect(updatedNode?.properties.name).toBe('Updated Name');
      expect(updatedNode?.properties.age).toBe(30);
      expect(updatedNode?.updatedAt.getTime()).not.toBe(updatedNode?.createdAt.getTime());
    });

    it('should return null when updating nonexistent node', () => {
      const result = service.updateNode('nonexistent', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('addEdge and getEdge', () => {
    it('should add and retrieve an edge', () => {
      // First add nodes
      const sourceNode: CareNode = {
        id: 'source-001',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const targetNode: CareNode = {
        id: 'target-001',
        type: 'patient',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      service.addNode(sourceNode);
      service.addNode(targetNode);

      // Add edge
      const edge: CareEdge = {
        id: 'edge-001',
        sourceId: 'source-001',
        targetId: 'target-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const addedEdge = service.addEdge(edge);
      expect(addedEdge.id).toBe('edge-001');
      expect(addedEdge.relationshipType).toBe('cares_for');

      // Get edge
      const retrievedEdge = service.getEdge('edge-001');
      expect(retrievedEdge).not.toBeNull();
      expect(retrievedEdge?.id).toBe('edge-001');
      expect(retrievedEdge?.sourceId).toBe('source-001');
      expect(retrievedEdge?.targetId).toBe('target-001');
    });
  });

  describe('getEdgesForNode', () => {
    it('should get all edges connected to a node', () => {
      // Add nodes
      const patient: CareNode = {
        id: 'patient-001',
        type: 'patient',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const caregiver1: CareNode = {
        id: 'caregiver-001',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const caregiver2: CareNode = {
        id: 'caregiver-002',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const medication: CareNode = {
        id: 'med-001',
        type: 'medication',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [patient, caregiver1, caregiver2, medication].forEach(node => service.addNode(node));

      // Add edges
      const edge1: CareEdge = {
        id: 'edge-001',
        sourceId: 'caregiver-001',
        targetId: 'patient-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const edge2: CareEdge = {
        id: 'edge-002',
        sourceId: 'caregiver-002',
        targetId: 'patient-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const edge3: CareEdge = {
        id: 'edge-003',
        sourceId: 'patient-001',
        targetId: 'med-001',
        relationshipType: 'prescribed',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [edge1, edge2, edge3].forEach(edge => service.addEdge(edge));

      // Get edges for patient
      const patientEdges = service.getEdgesForNode('patient-001');
      expect(patientEdges.length).toBe(3);

      // Get edges for caregiver1
      const caregiverEdges = service.getEdgesForNode('caregiver-001');
      expect(caregiverEdges.length).toBe(1);
      expect(caregiverEdges[0].id).toBe('edge-001');
    });
  });

  describe('getNeighbors', () => {
    it('should get all nodes directly connected to a node', () => {
      // Add nodes
      const patient: CareNode = {
        id: 'patient-001',
        type: 'patient',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const caregiver: CareNode = {
        id: 'caregiver-001',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const medication: CareNode = {
        id: 'med-001',
        type: 'medication',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [patient, caregiver, medication].forEach(node => service.addNode(node));

      // Add edges
      const edge1: CareEdge = {
        id: 'edge-001',
        sourceId: 'caregiver-001',
        targetId: 'patient-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const edge2: CareEdge = {
        id: 'edge-002',
        sourceId: 'patient-001',
        targetId: 'med-001',
        relationshipType: 'prescribed',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [edge1, edge2].forEach(edge => service.addEdge(edge));

      // Get neighbors for patient
      const neighbors = service.getNeighbors('patient-001');
      expect(neighbors.length).toBe(2);

      const neighborIds = neighbors.map(n => n.id);
      expect(neighborIds).toContain('caregiver-001');
      expect(neighborIds).toContain('med-001');
    });
  });

  describe('removeNode', () => {
    it('should remove a node and its connected edges', () => {
      // Add nodes
      const patient: CareNode = {
        id: 'patient-001',
        type: 'patient',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const caregiver: CareNode = {
        id: 'caregiver-001',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const medication: CareNode = {
        id: 'med-001',
        type: 'medication',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [patient, caregiver, medication].forEach(node => service.addNode(node));

      // Add edges
      const edge1: CareEdge = {
        id: 'edge-001',
        sourceId: 'caregiver-001',
        targetId: 'patient-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const edge2: CareEdge = {
        id: 'edge-002',
        sourceId: 'patient-001',
        targetId: 'med-001',
        relationshipType: 'prescribed',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [edge1, edge2].forEach(edge => service.addEdge(edge));

      // Verify initial state
      expect(service.nodes.size).toBe(3);
      expect(service.edges.size).toBe(2);

      // Remove patient node
      const result = service.removeNode('patient-001');
      expect(result).toBeTrue();

      // Verify node and edges removed
      expect(service.getNode('patient-001')).toBeNull();
      expect(service.getEdge('edge-001')).toBeNull();
      expect(service.getEdge('edge-002')).toBeNull();
      expect(service.nodes.size).toBe(2);
      expect(service.edges.size).toBe(0);

      // Verify other nodes still exist
      expect(service.getNode('caregiver-001')).not.toBeNull();
      expect(service.getNode('med-001')).not.toBeNull();
    });

    it('should return false when removing nonexistent node', () => {
      const result = service.removeNode('nonexistent');
      expect(result).toBeFalse();
    });
  });

  describe('getGraphStatistics', () => {
    it('should get graph statistics', () => {
      // Add nodes
      const patient: CareNode = {
        id: 'patient-001',
        type: 'patient',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const caregiver: CareNode = {
        id: 'caregiver-001',
        type: 'caregiver',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const medication: CareNode = {
        id: 'med-001',
        type: 'medication',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [patient, caregiver, medication].forEach(node => service.addNode(node));

      // Add edges
      const edge1: CareEdge = {
        id: 'edge-001',
        sourceId: 'caregiver-001',
        targetId: 'patient-001',
        relationshipType: 'cares_for',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const edge2: CareEdge = {
        id: 'edge-002',
        sourceId: 'patient-001',
        targetId: 'med-001',
        relationshipType: 'prescribed',
        properties: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      [edge1, edge2].forEach(edge => service.addEdge(edge));

      const stats = service.getGraphStatistics();
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(new Set(stats.nodeTypes)).toEqual(new Set(['patient', 'caregiver', 'medication']));
      expect(new Set(stats.relationshipTypes)).toEqual(new Set(['cares_for', 'prescribed']));
    });
  });
});