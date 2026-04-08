import 'package:cloud_firestore/cloud_firestore.dart';

class Customer {
  final String id;
  final String name;
  final String address;
  final String phone;
  final String email;
  final String type;
  final double creditLimit;
  final double outstanding;
  final String gst;
  final bool isActive;
  final DateTime? createdAt;
  final String? assignedSalesRep;
  final List<String>? territories;

  Customer({
    required this.id,
    required this.name,
    required this.address,
    required this.phone,
    required this.email,
    required this.type,
    required this.creditLimit,
    required this.outstanding,
    required this.gst,
    required this.isActive,
    this.createdAt,
    this.assignedSalesRep,
    this.territories,
  });

  factory Customer.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Customer(
      id: data['id'] ?? '',
      name: data['name'] ?? '',
      address: data['address'] ?? '',
      phone: data['phone'] ?? '',
      email: data['email'] ?? '',
      type: data['type'] ?? '',
      creditLimit: (data['creditLimit'] ?? 0.0).toDouble(),
      outstanding: (data['outstanding'] ?? 0.0).toDouble(),
      gst: data['gst'] ?? '',
      isActive: data['isActive'] ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      assignedSalesRep: data['assignedSalesRep'],
      territories: List<String>.from(data['territories'] ?? []),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'phone': phone,
      'email': email,
      'type': type,
      'creditLimit': creditLimit,
      'outstanding': outstanding,
      'gst': gst,
      'isActive': isActive,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'assignedSalesRep': assignedSalesRep,
      'territories': territories,
    };
  }

  Customer copyWith({
    String? id,
    String? name,
    String? address,
    String? phone,
    String? email,
    String? type,
    double? creditLimit,
    double? outstanding,
    String? gst,
    bool? isActive,
    DateTime? createdAt,
    String? assignedSalesRep,
    List<String>? territories,
  }) {
    return Customer(
      id: id ?? this.id,
      name: name ?? this.name,
      address: address ?? this.address,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      type: type ?? this.type,
      creditLimit: creditLimit ?? this.creditLimit,
      outstanding: outstanding ?? this.outstanding,
      gst: gst ?? this.gst,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      assignedSalesRep: assignedSalesRep ?? this.assignedSalesRep,
      territories: territories ?? this.territories,
    );
  }

  double get availableCredit => creditLimit - outstanding;
  bool get isOverCreditLimit => outstanding > creditLimit;
  double get creditUtilization => creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
}

typedef CustomerType = String;
const List<CustomerType> customerTypes = [
  'Retailer',
  'Wholesaler',
  'Distributor',
  'Institutional',
];
