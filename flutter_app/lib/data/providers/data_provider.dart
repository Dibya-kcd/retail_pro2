import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/product_model.dart';
import '../models/order_model.dart';
import '../models/customer_model.dart';
import '../../core/services/firebase_service.dart';

final productsProvider = StreamProvider<List<Product>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Product>(
    'products',
    (doc) => Product.fromFirestore(doc),
  );
});

final ordersProvider = StreamProvider<List<Order>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Order>(
    'orders',
    (doc) => Order.fromFirestore(doc),
  );
});

final customersProvider = StreamProvider<List<Customer>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Customer>(
    'customers',
    (doc) => Customer.fromFirestore(doc),
  );
});

final companiesProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Map<String, dynamic>>(
    'companies',
    (doc) => doc.data() as Map<String, dynamic>,
  );
});

final suppliersProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Map<String, dynamic>>(
    'suppliers',
    (doc) => doc.data() as Map<String, dynamic>,
  );
});

final movementsProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Map<String, dynamic>>(
    'movements',
    (doc) => doc.data() as Map<String, dynamic>,
  );
});

final collectionsProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return firebaseService.getDocumentsStream<Map<String, dynamic>>(
    'collections',
    (doc) => doc.data() as Map<String, dynamic>,
  );
});

class DataNotifier extends StateNotifier<Map<String, dynamic>> {
  final FirebaseService _firebaseService;

  DataNotifier(this._firebaseService) : super({});

  Future<void> addProduct(Product product) async {
    try {
      await _firebaseService.addDocument(
        'products',
        product.sku,
        product.toFirestore(),
      );
    } catch (e) {
      throw Exception('Failed to add product: $e');
    }
  }

  Future<void> updateProduct(String sku, Map<String, dynamic> data) async {
    try {
      await _firebaseService.updateDocument('products', sku, data);
    } catch (e) {
      throw Exception('Failed to update product: $e');
    }
  }

  Future<void> addOrder(Order order) async {
    try {
      await _firebaseService.addDocument(
        'orders',
        order.id,
        order.toFirestore(),
      );
    } catch (e) {
      throw Exception('Failed to add order: $e');
    }
  }

  Future<void> updateOrder(String orderId, Map<String, dynamic> data) async {
    try {
      await _firebaseService.updateDocument('orders', orderId, data);
    } catch (e) {
      throw Exception('Failed to update order: $e');
    }
  }

  Future<void> addCustomer(Customer customer) async {
    try {
      await _firebaseService.addDocument(
        'customers',
        customer.id,
        customer.toFirestore(),
      );
    } catch (e) {
      throw Exception('Failed to add customer: $e');
    }
  }

  Future<void> updateCustomer(String customerId, Map<String, dynamic> data) async {
    try {
      await _firebaseService.updateDocument('customers', customerId, data);
    } catch (e) {
      throw Exception('Failed to update customer: $e');
    }
  }

  Future<void> recordStockMovement({
    required String productId,
    required int quantity,
    required String type, // 'in' or 'out'
    required String reason,
    String? batchNumber,
    String? referenceId,
  }) async {
    try {
      final movement = {
        'productId': productId,
        'quantity': quantity,
        'type': type,
        'reason': reason,
        'batchNumber': batchNumber,
        'referenceId': referenceId,
        'timestamp': DateTime.now().toIso8601String(),
      };
      
      await _firebaseService.addDocument(
        'movements',
        'MOV-${DateTime.now().millisecondsSinceEpoch}',
        movement,
      );

      final currentProduct = await _firebaseService.getDocument<Product>(
        'products',
        productId,
        (doc) => Product.fromFirestore(doc),
      );

      if (currentProduct != null) {
        final newStock = type == 'in' 
            ? currentProduct.stock + quantity 
            : currentProduct.stock - quantity;
        
        await updateProduct(productId, {'stock': newStock});
      }
    } catch (e) {
      throw Exception('Failed to record stock movement: $e');
    }
  }
}

final dataProvider = StateNotifierProvider<DataNotifier, Map<String, dynamic>>((ref) {
  final firebaseService = ref.watch(firebaseServiceProvider);
  return DataNotifier(firebaseService);
});
