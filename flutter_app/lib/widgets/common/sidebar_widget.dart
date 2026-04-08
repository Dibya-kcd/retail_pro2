import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/auth_service.dart';

class SidebarWidget extends ConsumerWidget {
  final bool isExpanded;
  final VoidCallback onClose;
  final UserProfile? userProfile;

  const SidebarWidget({
    super.key,
    required this.isExpanded,
    required this.onClose,
    this.userProfile,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLocation = GoRouterState.of(context).uri.toString();
    final authService = ref.watch(authServiceProvider);

    final navItems = _getNavItems(userProfile?.role);

    return Container(
      width: isExpanded ? 288 : double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          right: BorderSide(
            color: Colors.grey.shade200,
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          _buildHeader(context, authService),
          const SizedBox(height: 24),
          Expanded(
            child: _buildNavigation(context, navItems, currentLocation),
          ),
          _buildFooter(context, authService),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AuthService authService) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.primaryColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.trending_up,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'DMS Pro',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          if (!isExpanded)
            IconButton(
              onPressed: onClose,
              icon: const Icon(Icons.close),
              color: AppTheme.primaryColor,
            ),
        ],
      ),
    );
  }

  Widget _buildNavigation(BuildContext context, List<NavItem> navItems, String currentLocation) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      itemCount: navItems.length,
      itemBuilder: (context, index) {
        final item = navItems[index];
        final isActive = currentLocation.startsWith(item.route);
        
        return Container(
          margin: const EdgeInsets.only(bottom: 4),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                context.go(item.route);
                if (!isExpanded) onClose();
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isActive ? AppTheme.primaryColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      item.icon,
                      size: 20,
                      color: isActive ? Colors.white : Colors.grey.shade600,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        item.label,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: isActive ? Colors.white : Colors.grey.shade600,
                        ),
                      ),
                    ),
                    if (item.badge != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isActive ? Colors.white.withOpacity(0.2) : Colors.red,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          item.badge!,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isActive ? Colors.white : Colors.white,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildFooter(BuildContext context, AuthService authService) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: Colors.grey.shade200,
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          _buildUserProfile(context),
          const SizedBox(height: 16),
          _buildLogoutButton(context, authService),
        ],
      ),
    );
  }

  Widget _buildUserProfile(BuildContext context) {
    if (userProfile == null) return const SizedBox.shrink();

    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Center(
            child: Text(
              userProfile!.name.isNotEmpty ? userProfile!.name[0].toUpperCase() : 'U',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                userProfile!.name,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                userProfile!.role,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLogoutButton(BuildContext context, AuthService authService) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () async {
          await authService.signOut();
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Icon(
                Icons.logout,
                size: 20,
                color: Colors.red.shade600,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Logout',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: Colors.red.shade600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<NavItem> _getNavItems(String? role) {
    final allItems = [
      NavItem(
        id: 'dashboard',
        label: 'Dashboard',
        icon: Icons.dashboard_outlined,
        route: '/dashboard',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Sales Representative', 'Warehouse Manager', 'Warehouse Operator', 'Accounts Executive', 'MIS Analyst'],
      ),
      NavItem(
        id: 'sales_app',
        label: 'Sales App',
        icon: Icons.phone_android_outlined,
        route: '/sales_app',
        roles: ['Super Admin', 'Sales Manager', 'Sales Representative'],
        badge: 'Mobile',
      ),
      NavItem(
        id: 'orders',
        label: 'Orders',
        icon: Icons.shopping_cart_outlined,
        route: '/orders',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Sales Representative', 'Accounts Executive'],
      ),
      NavItem(
        id: 'approvals',
        label: 'Approvals',
        icon: Icons.approval_outlined,
        route: '/approvals',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager'],
        badge: '3',
      ),
      NavItem(
        id: 'inventory',
        label: 'Inventory',
        icon: Icons.inventory_outlined,
        route: '/inventory',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Warehouse Manager', 'Warehouse Operator'],
      ),
      NavItem(
        id: 'customers',
        label: 'Customers',
        icon: Icons.people_outline,
        route: '/customers',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Sales Representative', 'Accounts Executive'],
      ),
      NavItem(
        id: 'suppliers',
        label: 'Suppliers',
        icon: Icons.business_outlined,
        route: '/suppliers',
        roles: ['Super Admin', 'Distribution Manager', 'Warehouse Manager'],
      ),
      NavItem(
        id: 'warehouse',
        label: 'Warehouse',
        icon: Icons.warehouse_outlined,
        route: '/warehouse',
        roles: ['Super Admin', 'Distribution Manager', 'Warehouse Manager', 'Warehouse Operator'],
      ),
      NavItem(
        id: 'returns',
        label: 'Returns',
        icon: Icons.assignment_return_outlined,
        route: '/returns',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Warehouse Manager', 'Accounts Executive'],
      ),
      NavItem(
        id: 'reports',
        label: 'Reports',
        icon: Icons.assessment_outlined,
        route: '/reports',
        roles: ['Super Admin', 'Distribution Manager', 'Sales Manager', 'Accounts Executive', 'MIS Analyst'],
      ),
      NavItem(
        id: 'users',
        label: 'Users',
        icon: Icons.manage_accounts_outlined,
        route: '/users',
        roles: ['Super Admin'],
      ),
    ];

    if (role == 'Super Admin') return allItems;
    
    return allItems.where((item) => item.roles.contains(role)).toList();
  }
}

class NavItem {
  final String id;
  final String label;
  final IconData icon;
  final String route;
  final List<String> roles;
  final String? badge;

  NavItem({
    required this.id,
    required this.label,
    required this.icon,
    required this.route,
    required this.roles,
    this.badge,
  });
}
