import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/services/auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

final userProfileProvider = FutureProvider<UserProfile?>((ref) {
  final authState = ref.watch(authStateProvider);
  final user = authState.value;
  
  if (user == null) return Future.value(null);
  
  final authService = ref.watch(authServiceProvider);
  return authService.getUserProfile(user.uid);
});

final filteredNavItemsProvider = Provider<List<NavItem>>((ref) {
  final userProfile = ref.watch(userProfileProvider);
  
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

  final profile = userProfile.value;
  if (profile == null) return allItems.where((item) => item.id == 'dashboard').toList();
  
  if (profile.role == 'Super Admin') return allItems;
  
  return allItems.where((item) => item.roles.contains(profile.role)).toList();
});

class NavItem {
  final String id;
  final String label;
  final IconData icon;
  final String route;
  final List<String> roles;

  NavItem({
    required this.id,
    required this.label,
    required this.icon,
    required this.route,
    required this.roles,
  });
}
