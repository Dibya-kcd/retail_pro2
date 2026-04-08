import 'package:cloud_firestore/cloud_firestore.dart';

class Order {
  final String id;
  final String customerId;
  final String customerName;
  final double amount;
  final String status;
  final String workflow;
  final String channel;
  final String orderType;
  final String date;
  final List<OrderItem> items;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? approvedBy;
  final String? deliveredBy;

  Order({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.amount,
    required this.status,
    required this.workflow,
    required this.channel,
    required this.orderType,
    required this.date,
    required this.items,
    this.createdAt,
    this.updatedAt,
    this.approvedBy,
    this.deliveredBy,
  });

  factory Order.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Order(
      id: data['id'] ?? '',
      customerId: data['customerId'] ?? '',
      customerName: data['customerName'] ?? '',
      amount: (data['amount'] ?? 0.0).toDouble(),
      status: data['status'] ?? '',
      workflow: data['workflow'] ?? '',
      channel: data['channel'] ?? '',
      orderType: data['orderType'] ?? '',
      date: data['date'] ?? '',
      items: (data['items'] as List<dynamic>?)
          ?.map((item) => OrderItem.fromMap(item as Map<String, dynamic>))
          .toList() ?? [],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      approvedBy: data['approvedBy'],
      deliveredBy: data['deliveredBy'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'id': id,
      'customerId': customerId,
      'customerName': customerName,
      'amount': amount,
      'status': status,
      'workflow': workflow,
      'channel': channel,
      'orderType': orderType,
      'date': date,
      'items': items.map((item) => item.toMap()).toList(),
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : FieldValue.serverTimestamp(),
      'approvedBy': approvedBy,
      'deliveredBy': deliveredBy,
    };
  }

  Order copyWith({
    String? id,
    String? customerId,
    String? customerName,
    double? amount,
    String? status,
    String? workflow,
    String? channel,
    String? orderType,
    String? date,
    List<OrderItem>? items,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? approvedBy,
    String? deliveredBy,
  }) {
    return Order(
      id: id ?? this.id,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      amount: amount ?? this.amount,
      status: status ?? this.status,
      workflow: workflow ?? this.workflow,
      channel: channel ?? this.channel,
      orderType: orderType ?? this.orderType,
      date: date ?? this.date,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      approvedBy: approvedBy ?? this.approvedBy,
      deliveredBy: deliveredBy ?? this.deliveredBy,
    );
  }

  bool get isPending => status == 'Pending';
  bool get isApproved => status == 'Approved';
  bool get isOnHold => status == 'On Hold';
  bool get isProcessing => status == 'Processing';
  bool get isDelivered => status == 'Delivered';
  bool get isCancelled => status == 'Cancelled';
  bool get requiresApproval => amount > 50000 || workflow == 'Manager Approval';
}

class OrderItem {
  final String sku;
  final String name;
  final int qty;
  final double price;

  OrderItem({
    required this.sku,
    required this.name,
    required this.qty,
    required this.price,
  });

  factory OrderItem.fromMap(Map<String, dynamic> map) {
    return OrderItem(
      sku: map['sku'] ?? '',
      name: map['name'] ?? '',
      qty: map['qty'] ?? 0,
      price: (map['price'] ?? 0.0).toDouble(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'sku': sku,
      'name': name,
      'qty': qty,
      'price': price,
    };
  }

  double get total => price * qty;
}

typedef OrderStatus = String;
const List<OrderStatus> orderStatuses = [
  'Pending',
  'Approved',
  'On Hold',
  'Processing',
  'Delivered',
  'Cancelled',
];

typedef OrderType = String;
const List<OrderType> orderTypes = [
  'Regular',
  'Urgent',
  'Sample',
  'Return',
];

typedef OrderChannel = String;
const List<OrderChannel> orderChannels = [
  'Web Portal',
  'Mobile App',
  'Sales Rep',
  'Phone',
  'Email',
];
