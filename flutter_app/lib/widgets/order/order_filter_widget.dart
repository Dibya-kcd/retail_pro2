import 'package:flutter/material.dart';
import '../../data/models/order_model.dart';

class OrderFilterWidget extends StatefulWidget {
  final OrderStatus? selectedStatus;
  final OrderType? selectedType;
  final Function(OrderStatus?) onStatusChanged;
  final Function(OrderType?) onTypeChanged;

  const OrderFilterWidget({
    super.key,
    this.selectedStatus,
    this.selectedType,
    required this.onStatusChanged,
    required this.onTypeChanged,
  });

  @override
  State<OrderFilterWidget> createState() => _OrderFilterWidgetState();
}

class _OrderFilterWidgetState extends State<OrderFilterWidget> {
  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Container(
        padding: const EdgeInsets.all(24),
        constraints: const BoxConstraints(
          maxWidth: 400,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Filter Orders',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'Status',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: orderStatuses.map((status) {
                final isSelected = widget.selectedStatus == status;
                return FilterChip(
                  label: Text(status),
                  selected: isSelected,
                  onSelected: (selected) {
                    widget.onStatusChanged(selected ? status : null);
                  },
                  backgroundColor: Colors.grey.shade100,
                  selectedColor: Colors.blue.withOpacity(0.2),
                  checkmarkColor: Colors.blue,
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            Text(
              'Order Type',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: orderTypes.map((type) {
                final isSelected = widget.selectedType == type;
                return FilterChip(
                  label: Text(type),
                  selected: isSelected,
                  onSelected: (selected) {
                    widget.onTypeChanged(selected ? type : null);
                  },
                  backgroundColor: Colors.grey.shade100,
                  selectedColor: Colors.green.withOpacity(0.2),
                  checkmarkColor: Colors.green,
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () {
                    widget.onStatusChanged(null);
                    widget.onTypeChanged(null);
                    Navigator.of(context).pop();
                  },
                  child: const Text('Clear All'),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Apply'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
