import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/providers/data_provider.dart';
import '../../../../data/models/product_model.dart';
import '../../../../data/models/order_model.dart';
import '../../../../widgets/common/loading_widget.dart';

class ReportsPage extends ConsumerWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports & Analytics'),
        actions: [
          IconButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Export functionality coming soon')),
              );
            },
            icon: const Icon(Icons.download),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            SizedBox(height: 24.h),
            _buildSalesReport(context, ordersAsync),
            SizedBox(height: 24.h),
            _buildInventoryReport(context, productsAsync),
            SizedBox(height: 24.h),
            _buildTopProducts(context, productsAsync, ordersAsync),
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
          'Reports & Analytics',
          style: Theme.of(context).textTheme.headlineLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: 4.h),
        Text(
          'Business insights and performance metrics',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onBackground.withOpacity(0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildSalesReport(BuildContext context, AsyncValue<List<Order>> ordersAsync) {
    return Container(
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
          ordersAsync.when(
            data: (orders) {
              final totalRevenue = orders.fold<double>(0.0, (sum, order) => sum + order.amount);
              final totalOrders = orders.length;
              final avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0.0;
              
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Total Revenue',
                          '₹${totalRevenue.toStringAsFixed(0)}',
                          Icons.trending_up,
                          Colors.green,
                        ),
                      ),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Total Orders',
                          totalOrders.toString(),
                          Icons.shopping_cart,
                          Colors.blue,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12.h),
                  _buildMetricCard(
                    context,
                    'Average Order Value',
                    '₹${avgOrderValue.toStringAsFixed(0)}',
                    Icons.receipt_long,
                    Colors.orange,
                  ),
                  SizedBox(height: 16.h),
                  Container(
                    height: 200.h,
                    child: _buildSalesChart(orders),
                  ),
                ],
              );
            },
            loading: () => const LoadingWidget(),
            error: (_, __) => const Text('Error loading sales data'),
          ),
        ],
      ),
    );
  }

  Widget _buildInventoryReport(BuildContext context, AsyncValue<List<Product>> productsAsync) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Inventory Summary',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 16.h),
          productsAsync.when(
            data: (products) {
              final totalProducts = products.length;
              final totalStock = products.fold<int>(0, (sum, product) => sum + product.stock);
              final lowStockCount = products.where((p) => p.isLowStock).length;
              final outOfStockCount = products.where((p) => p.isOutOfStock).length;
              final totalValue = products.fold<double>(0.0, (sum, product) => sum + (product.price * product.stock));
              
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Total Products',
                          totalProducts.toString(),
                          Icons.inventory,
                          Colors.blue,
                        ),
                      ),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Total Stock',
                          totalStock.toString(),
                          Icons.package,
                          Colors.green,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12.h),
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Low Stock Items',
                          lowStockCount.toString(),
                          Icons.warning,
                          Colors.orange,
                        ),
                      ),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: _buildMetricCard(
                          context,
                          'Out of Stock',
                          outOfStockCount.toString(),
                          Icons.cancel,
                          Colors.red,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12.h),
                  _buildMetricCard(
                    context,
                    'Total Inventory Value',
                    '₹${totalValue.toStringAsFixed(0)}',
                    Icons.account_balance,
                    Colors.purple,
                  ),
                ],
              );
            },
            loading: () => const LoadingWidget(),
            error: (_, __) => const Text('Error loading inventory data'),
          ),
        ],
      ),
    );
  }

  Widget _buildTopProducts(BuildContext context, AsyncValue<List<Product>> productsAsync, AsyncValue<List<Order>> ordersAsync) {
    return Container(
      padding: EdgeInsets.all(16.w),
      decoration: AppTheme.cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Top Performing Products',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 16.h),
          productsAsync.when(
            data: (products) {
              final sortedProducts = List<Product>.from(products)
                ..sort((a, b) => b.stock.compareTo(a.stock));
              final topProducts = sortedProducts.take(5).toList();
              
              if (topProducts.isEmpty) {
                return const Center(
                  child: Text('No products available'),
                );
              }

              return Column(
                children: topProducts.asMap().entries.map((entry) {
                  final index = entry.key;
                  final product = entry.value;
                  return Container(
                    margin: EdgeInsets.only(bottom: 8.h),
                    padding: EdgeInsets.all(12.w),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32.w,
                          height: 32.w,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(16.r),
                          ),
                          child: Center(
                            child: Text(
                              '${index + 1}',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14.sp,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                product.name,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'SKU: ${product.sku}',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '${product.stock}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: product.isLowStock ? Colors.orange : Colors.green,
                              ),
                            ),
                            Text(
                              'units',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
            loading: () => const LoadingWidget(),
            error: (_, __) => const Text('Error loading products'),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(BuildContext context, String title, String value, IconData icon, Color color) {
    return Container(
      padding: EdgeInsets.all(12.w),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12.r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: color,
            size: 20.w,
          ),
          SizedBox(height: 8.h),
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          SizedBox(height: 4.h),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesChart(List<Order> orders) {
    final Map<String, double> monthlyData = {};
    
    for (final order in orders) {
      try {
        final date = DateTime.parse(order.date);
        final monthKey = '${date.year}-${date.month.toString().padLeft(2, '0')}';
        monthlyData[monthKey] = (monthlyData[monthKey] ?? 0) + order.amount;
      } catch (e) {
        continue;
      }
    }

    final sortedKeys = monthlyData.keys.toList()..sort();
    final maxValue = monthlyData.values.isNotEmpty ? monthlyData.values.reduce((a, b) => a > b ? a : b) : 1000.0;

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: maxValue * 1.2,
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (_) => Colors.blueGrey.withOpacity(0.8),
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              final month = sortedKeys[group.x.toInt()];
              final value = rod.toY;
              return BarTooltipItem(
                '₹${value.toStringAsFixed(0)}',
                const TextStyle(color: Colors.white, fontSize: 12),
              );
            },
          ),
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() < sortedKeys.length) {
                  final month = sortedKeys[value.toInt()];
                  final parts = month.split('-');
                  return Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Text(
                      '${parts[1]}/${parts[0].substring(2)}',
                      style: const TextStyle(fontSize: 10),
                    ),
                  );
                }
                return const Text('');
              },
              reservedSize: 30,
            ),
          ),
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        barGroups: sortedKeys.asMap().entries.map((entry) {
          final index = entry.key;
          final month = entry.value;
          final sales = monthlyData[month] ?? 0;
          
          return BarChartGroupData(
            x: index,
            barRods: [
              BarChartRodData(
                toY: sales,
                color: Colors.blue,
                width: 16,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}
