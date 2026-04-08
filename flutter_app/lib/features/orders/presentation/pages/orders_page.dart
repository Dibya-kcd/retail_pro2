import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/providers/data_provider.dart';
import '../../../../data/models/order_model.dart';
import '../../../../widgets/common/loading_widget.dart';
import '../../../../widgets/common/error_dialog.dart';
import '../../../../widgets/order/order_card_widget.dart';
import '../../../../widgets/order/order_filter_widget.dart';

class OrdersPage extends ConsumerStatefulWidget {
  const OrdersPage({super.key});

  @override
  ConsumerState<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends ConsumerState<OrdersPage>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';
  OrderStatus? _selectedStatus;
  OrderType? _selectedType;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: Theme.of(context).colorScheme.primary,
          unselectedLabelColor: Colors.grey.shade600,
          indicatorColor: Theme.of(context).colorScheme.primary,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Pending'),
            Tab(text: 'Processing'),
            Tab(text: 'Delivered'),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _showFilterDialog,
            icon: const Icon(Icons.filter_list),
          ),
          IconButton(
            onPressed: _showAddOrderDialog,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          _buildFilterChips(),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildOrdersList(ordersAsync, null),
                _buildOrdersList(ordersAsync, 'Pending'),
                _buildOrdersList(ordersAsync, 'Processing'),
                _buildOrdersList(ordersAsync, 'Delivered'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: EdgeInsets.all(16.w),
      child: TextField(
        onChanged: (value) {
          setState(() {
            _searchQuery = value.toLowerCase();
          });
        },
        decoration: InputDecoration(
          hintText: 'Search orders by ID, customer name...',
          prefixIcon: const Icon(Icons.search),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12.r),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12.r),
            borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    if (_selectedStatus == null && _selectedType == null) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16.w),
      child: Wrap(
        spacing: 8.w,
        children: [
          if (_selectedStatus != null)
            Chip(
              label: Text('Status: $_selectedStatus'),
              onDeleted: () {
                setState(() {
                  _selectedStatus = null;
                });
              },
              backgroundColor: Colors.blue.withOpacity(0.1),
              deleteIconColor: Colors.blue,
            ),
          if (_selectedType != null)
            Chip(
              label: Text('Type: $_selectedType'),
              onDeleted: () {
                setState(() {
                  _selectedType = null;
                });
              },
              backgroundColor: Colors.green.withOpacity(0.1),
              deleteIconColor: Colors.green,
            ),
        ],
      ),
    );
  }

  Widget _buildOrdersList(AsyncValue<List<Order>> ordersAsync, String? status) {
    return ordersAsync.when(
      data: (orders) {
        var filteredOrders = orders.where((order) {
          if (_searchQuery.isNotEmpty) {
            final matchesSearch = order.id.toLowerCase().contains(_searchQuery) ||
                order.customerName.toLowerCase().contains(_searchQuery);
            if (!matchesSearch) return false;
          }

          if (status != null && order.status != status) return false;
          if (_selectedStatus != null && order.status != _selectedStatus) return false;
          if (_selectedType != null && order.orderType != _selectedType) return false;

          return true;
        }).toList();

        if (filteredOrders.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.shopping_cart_outlined,
                  size: 64.w,
                  color: Colors.grey.shade400,
                ),
                SizedBox(height: 16.h),
                Text(
                  'No orders found',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: EdgeInsets.all(16.w),
          itemCount: filteredOrders.length,
          itemBuilder: (context, index) {
            final order = filteredOrders[index];
            return OrderCardWidget(
              order: order,
              onTap: () => _showOrderDetails(order),
              onStatusChange: (newStatus) => _updateOrderStatus(order, newStatus),
            );
          },
        );
      },
      loading: () => const LoadingWidget(message: 'Loading orders...'),
      error: (error, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64.w,
              color: Colors.red.shade400,
            ),
            SizedBox(height: 16.h),
            Text(
              'Error loading orders',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Colors.red.shade600,
              ),
            ),
            SizedBox(height: 8.h),
            Text(
              error.toString(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => OrderFilterWidget(
        selectedStatus: _selectedStatus,
        selectedType: _selectedType,
        onStatusChanged: (status) {
          setState(() {
            _selectedStatus = status;
          });
        },
        onTypeChanged: (type) {
          setState(() {
            _selectedType = type;
          });
        },
      ),
    );
  }

  void _showAddOrderDialog() {
    // TODO: Implement add order dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Add order functionality coming soon')),
    );
  }

  void _showOrderDetails(Order order) {
    // TODO: Implement order details dialog
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Order details for ${order.id}')),
    );
  }

  void _updateOrderStatus(Order order, String newStatus) async {
    try {
      final dataProvider = ref.read(dataProvider.notifier);
      await dataProvider.updateOrder(order.id, {'status': newStatus});
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Order status updated to $newStatus'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ErrorDialog.show(
          context,
          title: 'Error',
          message: 'Failed to update order status: $e',
        );
      }
    }
  }
}
