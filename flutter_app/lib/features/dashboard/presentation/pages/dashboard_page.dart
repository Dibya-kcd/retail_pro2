import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/providers/data_provider.dart';
import '../../../../data/models/product_model.dart';
import '../../../../data/models/order_model.dart';
import '../../../../data/models/customer_model.dart';
import '../../../../widgets/common/stats_card_widget.dart';
import '../../../../widgets/common/chart_widget.dart';
import '../../../../widgets/common/activity_widget.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);
    final ordersAsync = ref.watch(ordersProvider);
    final customersAsync = ref.watch(customersProvider);

    return Scaffold(
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            SizedBox(height: 24.h),
            _buildStatsGrid(context, productsAsync, ordersAsync, customersAsync),
            SizedBox(height: 24.h),
            Row(
              children: [
                Expanded(
                  child: _buildSalesChart(context, ordersAsync),
                ),
                SizedBox(width: 16.w),
                Expanded(
                  child: _buildStockChart(context, productsAsync),
                ),
              ],
            ),
            SizedBox(height: 24.h),
            _buildRecentActivity(context, ordersAsync),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dashboard',
          style: Theme.of(context).textTheme.headlineLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: 4.h),
        Text(
          'Welcome back! Here\'s your business overview',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onBackground.withOpacity(0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsGrid(
    BuildContext context,
    AsyncValue<List<Product>> productsAsync,
    AsyncValue<List<Order>> ordersAsync,
    AsyncValue<List<Customer>> customersAsync,
  ) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 4,
      crossAxisSpacing: 16.w,
      mainAxisSpacing: 16.h,
      childAspectRatio: 1.2,
      children: [
        StatsCardWidget(
          title: 'Today\'s Sales',
          value: ordersAsync.when(
            data: (orders) {
              final today = DateTime.now();
              final todayOrders = orders.where((order) {
                try {
                  final orderDate = DateTime.parse(order.date);
                  return orderDate.year == today.year &&
                      orderDate.month == today.month &&
                      orderDate.day == today.day;
                } catch (e) {
                  return false;
                }
              }).toList();
              final total = todayOrders.fold<double>(
                0.0,
                (sum, order) => sum + order.amount,
              );
              return '₹${(total / 1000).toStringAsFixed(1)}K';
            },
            loading: () => '...',
            error: (_, __) => 'Error',
          ),
          icon: Icons.trending_up,
          color: Colors.green,
        ),
        StatsCardWidget(
          title: 'Pending Orders',
          value: ordersAsync.when(
            data: (orders) => orders
                .where((order) => order.isPending || order.isOnHold)
                .length
                .toString(),
            loading: () => '...',
            error: (_, __) => 'Error',
          ),
          icon: Icons.shopping_cart,
          color: Colors.orange,
        ),
        StatsCardWidget(
          title: 'Out of Stock',
          value: productsAsync.when(
            data: (products) => products
                .where((product) => product.isOutOfStock)
                .length
                .toString(),
            loading: () => '...',
            error: (_, __) => 'Error',
          ),
          icon: Icons.inventory_2,
          color: Colors.red,
        ),
        StatsCardWidget(
          title: 'Low Stock',
          value: productsAsync.when(
            data: (products) => products
                .where((product) => product.isLowStock && !product.isOutOfStock)
                .length
                .toString(),
            loading: () => '...',
            error: (_, __) => 'Error',
          ),
          icon: Icons.warning,
          color: Colors.blue,
        ),
      ],
    );
  }

  Widget _buildSalesChart(BuildContext context, AsyncValue<List<Order>> ordersAsync) {
    return Container(
      height: 300.h,
      padding: EdgeInsets.all(16.w),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sales Overview',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 16.h),
          Expanded(
            child: ordersAsync.when(
              data: (orders) => ChartWidget.buildSalesChart(orders),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text('Error loading data')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockChart(BuildContext context, AsyncValue<List<Product>> productsAsync) {
    return Container(
      height: 300.h,
      padding: EdgeInsets.all(16.w),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Stock Status',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 16.h),
          Expanded(
            child: productsAsync.when(
              data: (products) => ChartWidget.buildStockChart(products),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Center(child: Text('Error loading data')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentActivity(BuildContext context, AsyncValue<List<Order>> ordersAsync) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Recent Activity',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: () => context.go('/orders'),
                child: Text(
                  'View All',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          ordersAsync.when(
            data: (orders) {
              final recentOrders = orders.take(5).toList();
              if (recentOrders.isEmpty) {
                return Container(
                  height: 200.h,
                  child: Center(
                    child: Text(
                      'No recent orders',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onBackground.withOpacity(0.5),
                      ),
                    ),
                  ),
                );
              }
              return Column(
                children: recentOrders
                    .map((order) => ActivityWidget(order: order))
                    .toList(),
              );
            },
            loading: () => Container(
              height: 200.h,
              child: const Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => Container(
              height: 200.h,
              child: const Center(child: Text('Error loading orders')),
            ),
          ),
        ],
      ),
    );
  }
}
