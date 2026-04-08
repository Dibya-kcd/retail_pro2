import 'package:cloud_firestore/cloud_firestore.dart';

class Product {
  final String id;
  final String sku;
  final String name;
  final String category;
  final String brand;
  final double price;
  final double ptr;
  final int stock;
  final int minStock;
  final String barcode;
  final double gst;
  final bool isActive;
  final DateTime? createdAt;
  final String? companyId;
  final String? supplierId;

  Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.brand,
    required this.price,
    required this.ptr,
    required this.stock,
    required this.minStock,
    required this.barcode,
    required this.gst,
    required this.isActive,
    this.createdAt,
    this.companyId,
    this.supplierId,
  });

  factory Product.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Product(
      id: data['id'] ?? '',
      sku: data['sku'] ?? '',
      name: data['name'] ?? '',
      category: data['category'] ?? '',
      brand: data['brand'] ?? '',
      price: (data['price'] ?? 0.0).toDouble(),
      ptr: (data['ptr'] ?? 0.0).toDouble(),
      stock: data['stock'] ?? 0,
      minStock: data['minStock'] ?? 0,
      barcode: data['barcode'] ?? '',
      gst: (data['gst'] ?? 0.0).toDouble(),
      isActive: data['isActive'] ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      companyId: data['companyId'],
      supplierId: data['supplierId'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'sku': sku,
      'name': name,
      'category': category,
      'brand': brand,
      'price': price,
      'ptr': ptr,
      'stock': stock,
      'minStock': minStock,
      'barcode': barcode,
      'gst': gst,
      'isActive': isActive,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'companyId': companyId,
      'supplierId': supplierId,
    };
  }

  Product copyWith({
    String? id,
    String? sku,
    String? name,
    String? category,
    String? brand,
    double? price,
    double? ptr,
    int? stock,
    int? minStock,
    String? barcode,
    double? gst,
    bool? isActive,
    DateTime? createdAt,
    String? companyId,
    String? supplierId,
  }) {
    return Product(
      id: id ?? this.id,
      sku: sku ?? this.sku,
      name: name ?? this.name,
      category: category ?? this.category,
      brand: brand ?? this.brand,
      price: price ?? this.price,
      ptr: ptr ?? this.ptr,
      stock: stock ?? this.stock,
      minStock: minStock ?? this.minStock,
      barcode: barcode ?? this.barcode,
      gst: gst ?? this.gst,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      companyId: companyId ?? this.companyId,
      supplierId: supplierId ?? this.supplierId,
    );
  }

  bool get isLowStock => stock <= minStock;
  bool get isOutOfStock => stock == 0;
  String get stockStatus {
    if (isOutOfStock) return 'Out of Stock';
    if (isLowStock) return 'Low Stock';
    return 'In Stock';
  }
}
