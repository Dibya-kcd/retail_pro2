import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../data/models/order_model.dart';
import '../../data/models/product_model.dart';

class ChartWidget {
  static Widget buildSalesChart(List<Order> orders) {
    final Map<String, double> salesData = {};
    
    for (final order in orders) {
      try {
        final date = DateTime.parse(order.date);
        final monthKey = '${date.year}-${date.month.toString().padLeft(2, '0')}';
        salesData[monthKey] = (salesData[monthKey] ?? 0) + order.amount;
      } catch (e) {
        continue;
      }
    }

    final sortedKeys = salesData.keys.toList()..sort();
    final maxSales = salesData.values.isNotEmpty ? salesData.values.reduce((a, b) => a > b ? a : b) : 1000.0;

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: maxSales * 1.2,
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              final month = sortedKeys[group.x.toInt()];
              final value = rod.toY;
              return BarTooltipItem(
                '$month\n₹${value.toStringAsFixed(0)}',
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
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) {
                return Text(
                  '₹${(value / 1000).toStringAsFixed(0)}K',
                  style: const TextStyle(fontSize: 10),
                );
              },
            ),
          ),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        barGroups: sortedKeys.asMap().entries.map((entry) {
          final index = entry.key;
          final month = entry.value;
          final sales = salesData[month] ?? 0;
          
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

  static Widget buildStockChart(List<Product> products) {
    final inStock = products.where((p) => !p.isLowStock && !p.isOutOfStock).length;
    final lowStock = products.where((p) => p.isLowStock && !p.isOutOfStock).length;
    final outOfStock = products.where((p) => p.isOutOfStock).length;
    final total = products.length;

    if (total == 0) {
      return const Center(
        child: Text(
          'No products available',
          style: TextStyle(fontSize: 14, color: Colors.grey),
        ),
      );
    }

    return PieChart(
      PieChartData(
        sectionsSpace: 2,
        centerSpaceRadius: 40,
        sections: [
          PieChartSectionData(
            color: Colors.green,
            value: inStock.toDouble(),
            title: '${((inStock / total) * 100).toStringAsFixed(0)}%',
            radius: 50,
            titleStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          PieChartSectionData(
            color: Colors.orange,
            value: lowStock.toDouble(),
            title: '${((lowStock / total) * 100).toStringAsFixed(0)}%',
            radius: 50,
            titleStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          PieChartSectionData(
            color: Colors.red,
            value: outOfStock.toDouble(),
            title: '${((outOfStock / total) * 100).toStringAsFixed(0)}%',
            radius: 50,
            titleStyle: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
        pieTouchData: PieTouchData(
          touchCallback: (FlTouchEvent event, pieTouchResponse) {
            // Handle touch events if needed
          },
        ),
      ),
    );
  }

  static Widget buildEmptyChart(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.bar_chart,
            size: 48,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}
