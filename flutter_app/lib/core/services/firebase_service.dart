import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FirebaseService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  CollectionReference getCollection(String collectionName) {
    return _firestore.collection(collectionName);
  }

  Future<List<T>> getDocuments<T>(
    String collectionName,
    T Function(DocumentSnapshot) fromFirestore,
  ) async {
    try {
      final snapshot = await _firestore.collection(collectionName).get();
      return snapshot.docs.map(fromFirestore).toList();
    } catch (e) {
      throw Exception('Failed to get documents from $collectionName: $e');
    }
  }

  Stream<List<T>> getDocumentsStream<T>(
    String collectionName,
    T Function(DocumentSnapshot) fromFirestore,
  ) {
    return _firestore
        .collection(collectionName)
        .snapshots()
        .map((snapshot) => snapshot.docs.map(fromFirestore).toList());
  }

  Future<T?> getDocument<T>(
    String collectionName,
    String documentId,
    T Function(DocumentSnapshot) fromFirestore,
  ) async {
    try {
      final snapshot = await _firestore.collection(collectionName).doc(documentId).get();
      return snapshot.exists ? fromFirestore(snapshot) : null;
    } catch (e) {
      throw Exception('Failed to get document from $collectionName: $e');
    }
  }

  Future<void> addDocument(
    String collectionName,
    String documentId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _firestore.collection(collectionName).doc(documentId).set(data);
    } catch (e) {
      throw Exception('Failed to add document to $collectionName: $e');
    }
  }

  Future<void> updateDocument(
    String collectionName,
    String documentId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _firestore.collection(collectionName).doc(documentId).update(data);
    } catch (e) {
      throw Exception('Failed to update document in $collectionName: $e');
    }
  }

  Future<void> deleteDocument(String collectionName, String documentId) async {
    try {
      await _firestore.collection(collectionName).doc(documentId).delete();
    } catch (e) {
      throw Exception('Failed to delete document from $collectionName: $e');
    }
  }

  Future<List<T>> queryDocuments<T>(
    String collectionName,
    Query Function(CollectionReference) queryBuilder,
    T Function(DocumentSnapshot) fromFirestore,
  ) async {
    try {
      final query = queryBuilder(_firestore.collection(collectionName));
      final snapshot = await query.get();
      return snapshot.docs.map(fromFirestore).toList();
    } catch (e) {
      throw Exception('Failed to query documents from $collectionName: $e');
    }
  }

  Stream<List<T>> queryDocumentsStream<T>(
    String collectionName,
    Query Function(CollectionReference) queryBuilder,
    T Function(DocumentSnapshot) fromFirestore,
  ) {
    final query = queryBuilder(_firestore.collection(collectionName));
    return query.snapshots().map((snapshot) => snapshot.docs.map(fromFirestore).toList());
  }

  Future<void> bootstrapData(String collectionName) async {
    final Map<String, List<Map<String, dynamic>>> bootstrapData = {
      'companies': [
        {
          'id': 'COMP-001',
          'name': 'DMS Pro Solutions',
          'address': '123 Business Park, Tech City',
          'phone': '+1-555-0123',
          'email': 'info@dmssolutions.com',
          'gst': '27AAAPL1234C1ZV',
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
      ],
      'suppliers': [
        {
          'id': 'SUP-001',
          'name': 'Global Supplies Ltd',
          'address': '456 Industrial Area, Manufacturing City',
          'phone': '+1-555-0456',
          'email': 'contact@globalsupplies.com',
          'gst': '27AAAPL5678C1ZV',
          'paymentTerms': 'Net 30',
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
      ],
      'products': [
        {
          'id': 'PROD-001',
          'sku': 'SKU-001',
          'name': 'Premium Water Bottle 1L',
          'category': 'Beverages',
          'brand': 'AquaPure',
          'price': 25.0,
          'ptr': 20.0,
          'stock': 150,
          'minStock': 20,
          'barcode': '123456789001',
          'gst': 18.0,
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
        {
          'id': 'PROD-002',
          'sku': 'SKU-002',
          'name': 'Mineral Water 500ml',
          'category': 'Beverages',
          'brand': 'AquaPure',
          'price': 15.0,
          'ptr': 12.0,
          'stock': 200,
          'minStock': 30,
          'barcode': '123456789002',
          'gst': 18.0,
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
      ],
      'customers': [
        {
          'id': 'C-001',
          'name': 'Krishna General Store',
          'address': '789 Market Street, Retail Zone',
          'phone': '+1-555-0789',
          'email': 'krishna@store.com',
          'type': 'Retailer',
          'creditLimit': 50000.0,
          'outstanding': 12500.0,
          'gst': '27AAAPL9012C1ZV',
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
        {
          'id': 'C-002',
          'name': 'City Wholesalers',
          'address': '321 Wholesale Avenue, Commercial District',
          'phone': '+1-555-0321',
          'email': 'info@citywholesalers.com',
          'type': 'Wholesaler',
          'creditLimit': 200000.0,
          'outstanding': 85000.0,
          'gst': '27AAAPL3456C1ZV',
          'isActive': true,
          'createdAt': FieldValue.serverTimestamp(),
        },
      ],
      'orders': [
        {
          'id': 'ORD-2024-001',
          'customerId': 'C-001',
          'customerName': 'Krishna General Store',
          'amount': 4250.0,
          'status': 'Delivered',
          'workflow': 'Completed',
          'channel': 'Web Portal',
          'orderType': 'Regular',
          'date': '2024-01-15',
          'items': [
            {'sku': 'SKU-001', 'name': 'Premium Water Bottle 1L', 'qty': 100, 'price': 25.0},
            {'sku': 'SKU-002', 'name': 'Mineral Water 500ml', 'qty': 150, 'price': 15.0},
          ],
          'createdAt': FieldValue.serverTimestamp(),
        },
      ],
    };

    if (bootstrapData.containsKey(collectionName)) {
      final documents = bootstrapData[collectionName]!;
      for (final doc in documents) {
        await _firestore.collection(collectionName).doc(doc['id']).set(doc);
      }
    }
  }
}

final firebaseServiceProvider = Provider<FirebaseService>((ref) {
  return FirebaseService();
});
