import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/providers/data_provider.dart';
import '../../../../data/models/customer_model.dart';
import '../../../../widgets/common/loading_widget.dart';
import '../../../../widgets/common/error_dialog.dart';
import '../../../../widgets/customer/customer_card_widget.dart';

class CustomersPage extends ConsumerStatefulWidget {
  const CustomersPage({super.key});

  @override
  ConsumerState<CustomersPage> createState() => _CustomersPageState();
}

class _CustomersPageState extends ConsumerState<CustomersPage>
    with TickerProviderStateMixin {
  late TabController _tabController;
  String _searchQuery = '';
  CustomerType? _selectedType;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final customersAsync = ref.watch(customersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customers'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: Theme.of(context).colorScheme.primary,
          unselectedLabelColor: Colors.grey.shade600,
          indicatorColor: Theme.of(context).colorScheme.primary,
          tabs: const [
            Tab(text: 'All Customers'),
            Tab(text: 'Active'),
            Tab(text: 'Over Limit'),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _showAddCustomerDialog,
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
                _buildCustomersList(customersAsync, null),
                _buildCustomersList(customersAsync, 'active'),
                _buildCustomersList(customersAsync, 'overlimit'),
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
          hintText: 'Search customers by name, email, or phone...',
          prefixIcon: const Icon(Icons.search),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    if (_selectedType == null) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16.w),
      child: Wrap(
        spacing: 8.w,
        children: [
          Chip(
            label: Text('Type: $_selectedType'),
            onDeleted: () {
              setState(() {
                _selectedType = null;
              });
            },
            backgroundColor: Colors.blue.withOpacity(0.1),
            deleteIconColor: Colors.blue,
          ),
        ],
      ),
    );
  }

  Widget _buildCustomersList(AsyncValue<List<Customer>> customersAsync, String? filter) {
    return customersAsync.when(
      data: (customers) {
        var filteredCustomers = customers.where((customer) {
          if (_searchQuery.isNotEmpty) {
            final matchesSearch = customer.name.toLowerCase().contains(_searchQuery) ||
                customer.email.toLowerCase().contains(_searchQuery) ||
                customer.phone.toLowerCase().contains(_searchQuery);
            if (!matchesSearch) return false;
          }

          if (_selectedType != null && customer.type != _selectedType) return false;

          switch (filter) {
            case 'active':
              return customer.isActive;
            case 'overlimit':
              return customer.isOverCreditLimit;
            default:
              return true;
          }
        }).toList();

        if (filteredCustomers.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.people_outline,
                  size: 24,
                  color: Colors.grey.shade400,
                ),
                const SizedBox(height: 16),
                Text(
                  'No customers found',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: filteredCustomers.length,
          itemBuilder: (context, index) {
            final customer = filteredCustomers[index];
            return CustomerCardWidget(
              customer: customer,
              onTap: () => _showCustomerDetails(customer),
            );
          },
        );
      },
      loading: () => const LoadingWidget(message: 'Loading customers...'),
      error: (error, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 24,
              color: Colors.red.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'Error loading customers',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Colors.red.shade600,
              ),
            ),
            const SizedBox(height: 8),
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

  void _showAddCustomerDialog() {
    // TODO: Implement add customer dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Add customer functionality coming soon')),
    );
  }

  void _showCustomerDetails(Customer customer) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(customer.name),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Type: ${customer.type}'),
              Text('Email: ${customer.email}'),
              Text('Phone: ${customer.phone}'),
              Text('Address: ${customer.address}'),
              Text('GST: ${customer.gst}'),
              SizedBox(height: 8.h),
              Text(
                'Credit Limit: ₹${customer.creditLimit.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(
                'Outstanding: ₹${customer.outstanding.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(
                'Available Credit: ₹${customer.availableCredit.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8.h),
              LinearProgressIndicator(
                value: customer.creditUtilization / 100,
                backgroundColor: Colors.grey.shade300,
                valueColor: AlwaysStoppedAnimation<Color>(
                  customer.isOverCreditLimit ? Colors.red : Colors.green,
                ),
              ),
              SizedBox(height: 4.h),
              Text(
                'Credit Utilization: ${customer.creditUtilization.toStringAsFixed(1)}%',
                style: TextStyle(
                  fontSize: 12.sp,
                  color: customer.isOverCreditLimit ? Colors.red : Colors.green,
                ),
              ),
              SizedBox(height: 8.h),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                decoration: BoxDecoration(
                  color: customer.isActive ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8.r),
                ),
                child: Text(
                  customer.isActive ? 'Active' : 'Inactive',
                  style: TextStyle(
                    color: customer.isActive ? Colors.green : Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
